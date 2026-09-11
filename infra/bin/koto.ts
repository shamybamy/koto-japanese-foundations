#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { KotoStack } from "../lib/koto-stack";

const app = new cdk.App();
const stage = String(app.node.tryGetContext("stage") ?? "dev");
const region = String(app.node.tryGetContext("region") ?? "ap-southeast-1");
new KotoStack(app, "KotoLearningStack", {
  stackName: `KotoLearningStack-${stage}`,
  description: "Koto Japanese foundations: Cognito, API Gateway, Lambda and DynamoDB",
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    // Keep the default deterministic instead of inheriting a developer's
    // unrelated AWS CLI region. Pass `-c region=...` to deploy elsewhere.
    region,
  },
});
