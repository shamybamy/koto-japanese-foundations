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

    const userPool = new cognito.UserPool(this, "Learners", {
      userPoolName: "koto-learners",
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      standardAttributes: { email: { required: true, mutable: true } },
      passwordPolicy: { minLength: 8, requireDigits: true, requireLowercase: true, requireUppercase: false, requireSymbols: false },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    const userPoolClient = userPool.addClient("WebClient", {
      authFlows: { userPassword: true, userSrp: true },
      preventUserExistenceErrors: true,
    });

    const learnerData = this.table("LearnerData", "itemKey");
    const reviewCards = this.table("ReviewCards", "cardKey");
    reviewCards.addGlobalSecondaryIndex({
      indexName: "due-index",
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "due", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
      readCapacity: 1,
      writeCapacity: 1,
    });
    const reviewLogs = this.table("ReviewLogs", "logKey");

    const apiLogGroup = new logs.LogGroup(this, "ApiLogs", {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
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
      },
    });
    learnerData.grantReadWriteData(apiHandler);
    reviewCards.grantReadWriteData(apiHandler);
    reviewLogs.grantReadWriteData(apiHandler);

    const api = new apigateway.RestApi(this, "Api", {
      restApiName: "koto-api",
      deployOptions: { stageName: "v1", loggingLevel: apigateway.MethodLoggingLevel.ERROR, dataTraceEnabled: false },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ["content-type", "authorization"],
      },
    });
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, "Authorizer", { cognitoUserPools: [userPool] });
    const integration = new apigateway.LambdaIntegration(apiHandler);
    const auth = { authorizationType: apigateway.AuthorizationType.COGNITO, authorizer };
    const add = (method: string, resource: apigateway.IResource) => resource.addMethod(method, integration, auth);

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
  }

  private table(id: string, sortKey: string) {
    return new dynamodb.Table(this, id, {
      tableName: `koto-${id.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`).replace(/^-/, "")}`,
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: sortKey, type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PROVISIONED,
      readCapacity: 1,
      writeCapacity: 1,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: false },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
  }
}
