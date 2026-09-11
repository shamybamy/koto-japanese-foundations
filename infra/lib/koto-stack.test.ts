import * as cdk from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { KotoStack } from "./koto-stack";

function stackFor(context: Record<string, unknown>) {
  const app = new cdk.App({ context });
  return new KotoStack(app, "KotoLearningStack", {
    stackName: `KotoLearningStack-${String(context.stage ?? "dev")}`,
    env: { account: "111111111111", region: "ap-southeast-1" },
  });
}

describe("KotoStack", () => {
  it("creates an isolated, low-maintenance development stack", () => {
    const stack = stackFor({ stage: "dev", allowedOrigins: "http://localhost:3000,https://dev.example.com" });
    const template = Template.fromStack(stack);
    const tables = Object.values(template.findResources("AWS::DynamoDB::Table"));

    expect(stack.stackName).toBe("KotoLearningStack-dev");
    expect(tables).toHaveLength(3);
    expect(tables.every((table) => table.Properties.BillingMode === "PAY_PER_REQUEST")).toBe(true);
    expect(tables.every((table) => table.DeletionPolicy === "Delete")).toBe(true);
    expect(tables.filter((table) => table.Properties.TimeToLiveSpecification?.AttributeName === "expiresAt")).toHaveLength(1);
    template.hasResourceProperties("AWS::ApiGateway::Stage", {
      MethodSettings: Match.arrayWith([Match.objectLike({ MetricsEnabled: false })]),
    });
    template.hasResourceProperties("AWS::Lambda::Function", {
      Environment: { Variables: Match.objectLike({
        DUE_INDEX: "due-index",
        ALLOWED_ORIGINS: "http://localhost:3000,https://dev.example.com",
        DEPLOYMENT_STAGE: "dev",
      }) },
    });

    const clients = Object.values(template.findResources("AWS::Cognito::UserPoolClient"));
    expect(clients).toHaveLength(1);
    expect(clients[0].Properties.ExplicitAuthFlows).toContain("ALLOW_USER_SRP_AUTH");
    expect(clients[0].Properties.ExplicitAuthFlows).not.toContain("ALLOW_USER_PASSWORD_AUTH");
    expect(clients[0].Properties.AllowedOAuthFlowsUserPoolClient).toBe(false);
    expect(clients[0].Properties.AllowedOAuthFlows).toBeUndefined();

    const methods = Object.values(template.findResources("AWS::ApiGateway::Method"));
    const options = methods.filter((method) => method.Properties.HttpMethod === "OPTIONS");
    expect(options).toHaveLength(7);
    expect(options.every((method) => method.Properties.AuthorizationType === "NONE")).toBe(true);
    expect(options.every((method) => method.Properties.Integration.Type === "AWS_PROXY")).toBe(true);

    template.hasResourceProperties("AWS::ApiGateway::Authorizer", {
      Type: "COGNITO_USER_POOLS",
      AuthorizerResultTtlInSeconds: 0,
    });

    const gatewayResponses = Object.values(template.findResources("AWS::ApiGateway::GatewayResponse"));
    expect(gatewayResponses).toHaveLength(4);
    expect(gatewayResponses.every((response) => response.Properties.ResponseParameters["gatewayresponse.header.Access-Control-Allow-Origin"] === "'http://localhost:3000'")).toBe(true);
  });

  it("retains and protects production data with point-in-time recovery", () => {
    const template = Template.fromStack(stackFor({ stage: "prod", allowedOrigins: "https://koto.example.com" }));
    const tables = Object.values(template.findResources("AWS::DynamoDB::Table"));

    expect(tables.every((table) => table.DeletionPolicy === "Retain")).toBe(true);
    expect(tables.every((table) => table.Properties.DeletionProtectionEnabled === true)).toBe(true);
    expect(tables.every((table) => table.Properties.PointInTimeRecoverySpecification?.PointInTimeRecoveryEnabled === true)).toBe(true);
    template.hasResourceProperties("AWS::ApiGateway::Stage", {
      MethodSettings: Match.arrayWith([Match.objectLike({ MetricsEnabled: true })]),
    });
    template.hasResourceProperties("AWS::Cognito::UserPool", { DeletionProtection: "ACTIVE" });
  });

  it("refuses wildcard or implicit CORS origins in production", () => {
    expect(() => stackFor({ stage: "prod", allowedOrigins: "*" })).toThrow(/non-wildcard/);
    expect(() => stackFor({ stage: "prod" })).toThrow(/explicit/);
    expect(() => stackFor({ stage: "prod", allowedOrigins: "http://koto.example.com" })).toThrow(/HTTPS/);
    expect(() => stackFor({ stage: "dev", allowedOrigins: "http://localhost:3000", gatewayErrorOrigin: "https://untrusted.example.com" })).toThrow(/gatewayErrorOrigin/);
  });
});
