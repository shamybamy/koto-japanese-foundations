import * as path from "node:path";
import { fileURLToPath } from "node:url";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

export class KotoStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const stage = String(this.node.tryGetContext("stage") ?? "dev");
    if (!/^[a-z][a-z0-9-]{0,19}$/.test(stage)) {
      throw new Error("CDK context 'stage' must start with a letter and contain only lowercase letters, numbers, or hyphens");
    }
    const isProduction = stage === "prod" || stage === "production";
    const enableBackups = isProduction || this.node.tryGetContext("enableBackups") === true || this.node.tryGetContext("enableBackups") === "true";
    const removalPolicy = isProduction ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY;
    const rawAllowedOrigins = this.node.tryGetContext("allowedOrigins");
    const allowedOrigins = typeof rawAllowedOrigins === "string"
      ? rawAllowedOrigins.split(",").map((origin) => origin.trim()).filter(Boolean)
      : ["http://localhost:3000", "http://127.0.0.1:3000"];
    const validOrigin = (origin: string) => {
      if (origin === "*") return true;
      try {
        const url = new URL(origin);
        return (url.protocol === "http:" || url.protocol === "https:")
          && url.origin === origin
          && !url.username
          && !url.password;
      } catch {
        return false;
      }
    };
    if (!allowedOrigins.length || allowedOrigins.some((origin) => !validOrigin(origin))) {
      throw new Error("CDK context 'allowedOrigins' must be '*' or a comma-separated list of URL origins without paths");
    }
    if (isProduction && (rawAllowedOrigins === undefined || allowedOrigins.includes("*"))) {
      throw new Error("Production deployments require explicit, non-wildcard 'allowedOrigins' CDK context");
    }
    if (isProduction && allowedOrigins.some((origin) => !origin.startsWith("https://"))) {
      throw new Error("Production deployments require HTTPS 'allowedOrigins'");
    }

    const userPool = new cognito.UserPool(this, "Learners", {
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      standardAttributes: { email: { required: true, mutable: true } },
      passwordPolicy: { minLength: 8, requireDigits: true, requireLowercase: true, requireUppercase: false, requireSymbols: false },
      deletionProtection: isProduction,
      removalPolicy,
    });
    const userPoolClient = userPool.addClient("WebClient", {
      authFlows: { userSrp: true },
      disableOAuth: true,
      enableTokenRevocation: true,
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
      preventUserExistenceErrors: true,
    });

    const learnerData = this.table("LearnerData", "itemKey", removalPolicy, enableBackups, "expiresAt", isProduction);
    const reviewCards = this.table("ReviewCards", "cardKey", removalPolicy, enableBackups, undefined, isProduction);
    reviewCards.addGlobalSecondaryIndex({
      indexName: "due-index",
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "due", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
    const reviewLogs = this.table("ReviewLogs", "logKey", removalPolicy, enableBackups, undefined, isProduction);

    const apiLogGroup = new logs.LogGroup(this, "ApiLogs", {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy,
    });
    const apiAccessLogGroup = new logs.LogGroup(this, "ApiAccessLogs", {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy,
    });
    const apiHandler = new NodejsFunction(this, "ApiHandler", {
      entry: path.join(currentDirectory, "../functions/api.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      memorySize: 512,
      timeout: cdk.Duration.seconds(15),
      logGroup: apiLogGroup,
      bundling: { minify: true, sourceMap: true },
      environment: {
        LEARNER_DATA_TABLE: learnerData.tableName,
        REVIEW_CARDS_TABLE: reviewCards.tableName,
        REVIEW_LOGS_TABLE: reviewLogs.tableName,
        DUE_INDEX: "due-index",
        ALLOWED_ORIGINS: allowedOrigins.join(","),
        DEPLOYMENT_STAGE: stage,
        NODE_OPTIONS: "--enable-source-maps",
      },
    });
    learnerData.grantReadWriteData(apiHandler);
    reviewCards.grantReadWriteData(apiHandler);
    reviewLogs.grantReadWriteData(apiHandler);

    const api = new apigateway.RestApi(this, "Api", {
      restApiName: `koto-api-${stage}`,
      deployOptions: {
        stageName: "v1",
        loggingLevel: apigateway.MethodLoggingLevel.ERROR,
        dataTraceEnabled: false,
        // Detailed per-method metrics can incur CloudWatch custom-metric charges.
        // Keep them off for the disposable development stack.
        metricsEnabled: isProduction,
        throttlingBurstLimit: 40,
        throttlingRateLimit: 20,
        accessLogDestination: new apigateway.LogGroupLogDestination(apiAccessLogGroup),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields(),
      },
    });
    const rawGatewayErrorOrigin = this.node.tryGetContext("gatewayErrorOrigin");
    const gatewayErrorOrigin = typeof rawGatewayErrorOrigin === "string" ? rawGatewayErrorOrigin.trim() : allowedOrigins[0];
    if (!allowedOrigins.includes(gatewayErrorOrigin)) {
      throw new Error("CDK context 'gatewayErrorOrigin' must be one of 'allowedOrigins'");
    }
    // GatewayResponse cannot conditionally select from several allowed origins.
    // Use one designated origin for generic API Gateway errors; Lambda responses
    // and dynamic OPTIONS preflight still enforce the complete allowlist.
    const gatewayOrigin = `'${gatewayErrorOrigin}'`;
    const gatewayResponseHeaders = {
      "Access-Control-Allow-Origin": gatewayOrigin,
      Vary: "'Origin'",
      "Cache-Control": "'no-store'",
      "Content-Type": "'application/json'",
    };
    const gatewayResponseTemplates = {
      "application/json": '{"error":"Request rejected by API Gateway","code":"$context.error.responseType"}',
    };
    [
      ["Default4xx", apigateway.ResponseType.DEFAULT_4XX],
      ["Default5xx", apigateway.ResponseType.DEFAULT_5XX],
      ["Unauthorized", apigateway.ResponseType.UNAUTHORIZED],
      ["AccessDenied", apigateway.ResponseType.ACCESS_DENIED],
    ].forEach(([responseId, type]) => api.addGatewayResponse(responseId as string, {
      type: type as apigateway.ResponseType,
      responseHeaders: gatewayResponseHeaders,
      templates: gatewayResponseTemplates,
    }));
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, "Authorizer", {
      cognitoUserPools: [userPool],
      // Re-evaluate the JWT for every request so a result cached just before
      // token expiry cannot outlive that token.
      resultsCacheTtl: cdk.Duration.seconds(0),
    });
    const integration = new apigateway.LambdaIntegration(apiHandler);
    const auth = { authorizationType: apigateway.AuthorizationType.COGNITO, authorizer };
    const add = (method: string, resource: apigateway.IResource) => {
      resource.addMethod(method, integration, auth);
      resource.addMethod("OPTIONS", integration, { authorizationType: apigateway.AuthorizationType.NONE });
    };

    const reviews = api.root.addResource("reviews");
    add("GET", reviews.addResource("queue"));
    add("POST", reviews.addResource("submit"));
    add("POST", api.root.addResource("lessons").addResource("check"));
    const kana = api.root.addResource("kana");
    add("POST", kana.addResource("learn"));
    const groups = kana.addResource("groups").addResource("{id}");
    add("POST", groups.addResource("start"));
    add("GET", groups.addResource("status"));
    add("GET", api.root.addResource("dashboard"));

    new cdk.CfnOutput(this, "CognitoUserPoolId", { value: userPool.userPoolId });
    new cdk.CfnOutput(this, "CognitoUserPoolClientId", { value: userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, "ApiUrl", { value: api.url });
    new cdk.CfnOutput(this, "AwsRegion", { value: this.region });
    new cdk.CfnOutput(this, "DeploymentStage", { value: stage });
    new cdk.CfnOutput(this, "AllowedOrigins", { value: allowedOrigins.join(",") });
  }

  private table(
    id: string,
    sortKey: string,
    removalPolicy: cdk.RemovalPolicy,
    enableBackups: boolean,
    timeToLiveAttribute?: string,
    deletionProtection = false,
  ) {
    return new dynamodb.Table(this, id, {
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: sortKey, type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: enableBackups },
      timeToLiveAttribute,
      deletionProtection,
      removalPolicy,
    });
  }
}
