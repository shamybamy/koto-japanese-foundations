# Redeploying Koto on AWS for private local testing

This guide recreates Koto's disposable AWS development backend after a full cleanup. The website runs on `http://localhost:3000`; Amplify Hosting and a GitHub connection are not required.

The deployment creates a Cognito user pool, three DynamoDB tables, one Lambda function, an API Gateway REST API, and two short-retention CloudWatch log groups. Development backups and API Gateway detailed metrics are disabled to reduce cost. AWS can change prices and Free Tier eligibility, so check the Billing console and keep the zero-spend budget enabled before deploying.

## 1. Open the repository and select Node

```bash
cd "/Users/samuelwong/Documents/Japanese Learning Website"
nvm install
nvm use
node --version
npm --version
```

Expected Node version: `v24.19.0`. Use npm 11.6.2 or a newer version beginning with `11.`.

Run `npm ci` if `node_modules` is absent, `package.json` or `package-lock.json` changed, or this is a fresh checkout:

```bash
npm ci
```

## 2. Run local checks

```bash
npm run typecheck
npm run lint
npm run test:run
npm run build
```

Resolve failures before creating cloud resources.

## 3. Authenticate the AWS CLI

The `koto-dev` profile uses temporary browser-authorized credentials rather than a permanent access key:

```bash
aws login --profile koto-dev --region ap-southeast-1
aws configure set region ap-southeast-1 --profile koto-dev
aws sts get-caller-identity --profile koto-dev
aws configure get region --profile koto-dev
```

Privately confirm that the account is the intended development account and the region is `ap-southeast-1`. Never paste account IDs, credentials, tokens, or authentication codes into chat or source control.

## 4. Synthesize the development stack

```bash
npm exec -- cdk synth KotoLearningStack \
  --profile koto-dev \
  -c stage=dev \
  -c region=ap-southeast-1 \
  -c allowedOrigins=http://localhost:3000
```

This creates a local CloudFormation template in `cdk.out`; it does not deploy Koto.

## 5. Bootstrap the account and region

Print the account ID privately:

```bash
aws sts get-caller-identity \
  --profile koto-dev \
  --query Account \
  --output text
```

Replace the placeholder below with that 12-digit account ID, without angle brackets:

```bash
npm exec -- cdk bootstrap aws://<YOUR-12-DIGIT-ACCOUNT-ID>/ap-southeast-1 \
  --profile koto-dev
```

Each fully cleaned account/region needs to be bootstrapped once before deployment.

## 6. Review the proposed deployment

```bash
npm exec -- cdk diff KotoLearningStack \
  --profile koto-dev \
  -c stage=dev \
  -c region=ap-southeast-1 \
  -c allowedOrigins=http://localhost:3000
```

Expect additions for one Cognito user pool/client, three DynamoDB tables, one Lambda, one REST API, two log groups, and supporting IAM resources. Stop if the account, region, stage, origins, or resource set is unexpected.

## 7. Deploy the backend

```bash
npm exec -- cdk deploy KotoLearningStack \
  --profile koto-dev \
  -c stage=dev \
  -c region=ap-southeast-1 \
  -c allowedOrigins=http://localhost:3000 \
  --outputs-file cdk-outputs.json
```

Review the IAM summary and approve only the expected `KotoLearningStack-dev` deployment. Wait for `CREATE_COMPLETE` or `UPDATE_COMPLETE`.

## 8. Connect the local frontend

Create the ignored environment file if it does not exist:

```bash
cp .env.example .env.local
git check-ignore .env.local
```

Open `.env.local` and `cdk-outputs.json`. Under `KotoLearningStack-dev`, copy the three relevant outputs into this format:

```dotenv
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_COGNITO_USER_POOL_ID=<CognitoUserPoolId>
NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID=<CognitoUserPoolClientId>
NEXT_PUBLIC_API_URL=<ApiUrl>
```

Remove the angle-bracket placeholders, do not add quotes, and preserve the API URL's trailing slash. These are public client configuration values, not AWS administrative credentials, but the generated files should remain outside source control.

## 9. Run and smoke-test Koto

```bash
npm run dev
```

Open `http://localhost:3000`, register and verify a new throwaway account, sign in, complete one lesson, reload, and confirm that progress persists. A full cleanup permanently removes earlier Cognito users and DynamoDB records, so they do not return after redeployment.

## 10. End the administrative session

AWS login is not required merely to run the local frontend against an already deployed backend. When AWS administration is finished:

```bash
aws logout --profile koto-dev
```

Run `aws login --profile koto-dev --region ap-southeast-1` again before a later CDK update, diff, destroy, or AWS CLI inspection if the temporary session has expired.

## 11. Fully clean up again

This permanently deletes cloud test users, progress, API resources, and logs. Keep the repository; it is the reproducible infrastructure blueprint.

First destroy Koto:

```bash
npm exec -- cdk destroy KotoLearningStack \
  --profile koto-dev \
  -c stage=dev \
  -c region=ap-southeast-1
```

Then verify in CloudFormation that `KotoLearningStack-dev` is gone. Remove the separate `CDKToolkit` bootstrap stack only after Koto has been deleted. If CloudFormation retains or cannot delete its asset bucket or ECR repository because they contain objects/images, empty only the specifically named CDK bootstrap storage resources, retry deletion, and verify those resources are gone.

Finally inspect the Singapore region for leftover Koto or CDK bootstrap resources and check Billing and Cost Management. Billing data can arrive after a delay, so cleanup prevents new usage but does not erase usage that occurred before deletion.
