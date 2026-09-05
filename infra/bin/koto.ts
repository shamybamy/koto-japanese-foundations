#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { KotoStack } from "../lib/koto-stack";

const app = new cdk.App();
new KotoStack(app, "KotoLearningStack", {
  description: "Koto Japanese foundations: Cognito, API Gateway, Lambda and DynamoDB",
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? "ap-southeast-1",
  },
});
