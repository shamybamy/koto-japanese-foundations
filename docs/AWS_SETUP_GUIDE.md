# Koto AWS setup guide

This is the operator-side work that source code cannot perform for you: opening and securing an AWS account, authenticating the command line, deploying Koto's CDK stack, connecting the resulting values to the website, hosting it with Amplify, and setting up basic cost and operations safeguards.

Do the first deployment as a development environment. Do not call it production until the account, persistence, privacy, accessibility, and expert-content checks in `docs/TESTING_GUIDE.md` have passed.

## What the repository already provides

`infra/` defines these resources for you:

- A Cognito user pool and public web app client for verified email/password accounts and password recovery.
- An authenticated API Gateway REST API.
- A Node.js Lambda that validates and grades lesson, kana-learning, and FSRS review requests.
- DynamoDB storage for learner state, review cards, and append-only review logs, including a due-date index.
- Short-retention CloudWatch API logs.
- CloudFormation outputs for the user-pool ID, app-client ID, and API URL.
- Explicit `dev`/`prod` deployment safeguards: development resources can be removed cleanly; production enables Cognito/DynamoDB deletion protection, data retention, and DynamoDB point-in-time recovery.

`amplify.yml` defines the frontend install/build/artifact settings. Text-to-speech remains a browser feature, so you do **not** need Amazon Polly. Koto does not use speech-recognition input or Amazon Transcribe.

The repository cannot create or secure your AWS/GitHub accounts, accept billing terms, choose your budget, authorize GitHub, read verification email, purchase a domain, review privacy wording, or decide when the app is safe to call production. Those are the steps below.

## 1. Create and secure the AWS account

1. [Create an AWS account](https://aws.amazon.com/resources/create-account/) with an email address you control and complete its billing/identity steps.
2. Choose one home region and use it consistently. Koto defaults to **Asia Pacific (Singapore), `ap-southeast-1`**.
3. Sign in as the root user once, enable MFA, store recovery information safely, and then stop using root for daily work. AWS explicitly recommends MFA and no root access keys in its [root-user best practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/root-user-best-practices.html).
4. Before enabling IAM Identity Center, decide which access path applies. **On AWS's current free plan, creating an AWS Organization upgrades the account to pay-as-you-go and immediately expires free-plan credits.** AWS states this in [Enable IAM Identity Center](https://docs.aws.amazon.com/singlesignon/latest/userguide/enable-identity-center.html). Do not click the final **Enable with AWS Organizations** button until you consciously accept that billing consequence.

### Option A — IAM Identity Center (preferred for an existing organization or pay-as-you-go account)

1. Open **IAM Identity Center → Enable**, choose an organization instance, and keep multi-account permissions enabled. Use the single-Region option unless you have deliberately budgeted for the extra KMS resources of a multi-Region instance.
2. In **IAM Identity Center → Users**, add your everyday administrator with an email address you control. Accept the invitation, choose its password, and register MFA.
3. Open **Multi-account permissions → AWS accounts**, select this account, and choose **Assign users or groups**. Select the new user, create/select `AdministratorAccess`, and submit the assignment. AWS's [default-directory quick start](https://docs.aws.amazon.com/singlesignon/latest/userguide/quick-start-default-idc.html) shows the user/permission-set/account sequence.
4. In **IAM Identity Center → Settings**, record the AWS access-portal URL and Identity Center region. Sign out of root, use the portal to sign in, and verify the assigned account and role appear.

Broad administrator access is practical for the first CDK bootstrap, but replace it afterward with a reviewed Koto deployment permission set.

### Option B — preserve a new free-plan account's credits (recommended for this walkthrough)

An account instance of IAM Identity Center supports application assignments, not the AWS-account permission-set flow required by the CLI steps below. If preserving free-plan credits matters, do **not** create an AWS Organization solely for Koto.

AWS CLI 2.32 or newer can use your authenticated console session to issue temporary local-development credentials for up to 12 hours. For this small first deployment, use `aws login` as described in section 4. This avoids both an AWS Organization and long-lived IAM access keys. Sign out with `aws logout --profile koto-dev` when the deployment session ends.

Root has sufficient permission for this temporary first deployment without an additional policy. For ongoing administration, move to a reviewed non-root identity with the permissions Koto actually needs; do not make routine root access the permanent workflow. AWS documents the temporary console-credential method in [Login for AWS local development](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sign-in.html).

Whichever option you use, give the account an unmistakable name such as `koto-development` and verify that the console region selector says **Singapore** before creating resources.

Never create an access key for the root user, put AWS keys in `.env.local`, paste tokens into chat, or commit credentials to GitHub.

## 2. Create cost guardrails before deployment

An AWS “free” or trial account does not guarantee a zero bill. Offers, credits, eligibility, prices, and limits can change by account and region.

1. Open **Billing and Cost Management → Budgets → Create budget**.
2. Create a **Zero spend budget** from the simplified template.
3. Create a second monthly cost budget at a small amount you are willing to pay, with actual and forecast alerts sent to an email you monitor.
4. Confirm any notification-subscription email.
5. Optionally enable Cost Anomaly Detection for another warning channel.

AWS's current console procedure is documented in [Creating a budget](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-create.html). A budget alerts you; unless you deliberately configure an action, it does not automatically switch the app off.

## 3. Install local prerequisites

Install:

- Git and access to `https://github.com/shamybamy/koto-japanese-foundations`.
- [nvm](https://github.com/nvm-sh/nvm) (or an equivalent version manager); the repository pins Node.js 24.19.0 and requires a compatible npm 11 release (11.6.2 or newer within major version 11). Corepack is not required.
- [AWS CLI version 2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html).

From the repository root:

```bash
nvm install
nvm use
npm --version
npm ci
npm run typecheck
npm run lint
npm run test:run
npm run build
```

On this Apple-silicon Mac, verify that Node is also native Apple silicon before installing dependencies:

```bash
uname -m
node -p "process.arch"
```

The architecture commands should both report `arm64`, and `npm --version` above should report version 11.6.2 or a newer version beginning with `11.`. If Node reports `x64`, install an arm64 Node 24.19.0 build, open a fresh terminal, and run `npm ci` so native packages are reinstalled for the correct architecture. An architecture mismatch can surface as a `lightningcss.darwin-x64.node` build error.

Resolve local failures before creating cloud resources.

## 4. Connect the AWS CLI

Use the path selected in section 1. Both paths create the same profile name, `koto-dev`, so every later CDK command is unchanged.

### Option A — Identity Center temporary credentials

Configure a named SSO profile; `koto-dev` is used below. The CLI wizard asks for the access-portal start URL and Identity Center region recorded in step 1:

```bash
aws configure sso --profile koto-dev
aws sso login --profile koto-dev
aws sts get-caller-identity --profile koto-dev
aws configure get region --profile koto-dev
```

During the wizard, select the Koto development account, your deployment permission set, and `ap-southeast-1` as the default client region. The identity command must return the intended 12-digit account ID. The region command must return `ap-southeast-1`.

AWS documents this temporary-credential flow in [Configuring IAM Identity Center authentication with the AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html). If an organization already manages your AWS access, use the profile and permission set supplied by its administrator instead of creating another identity system.

### Option B — temporary console credentials

AWS CLI 2.32 or newer can create a named profile from your existing authenticated console session without an access key. Start the browser flow in Singapore:

```bash
aws login --profile koto-dev --region ap-southeast-1
aws sts get-caller-identity --profile koto-dev
aws configure get region --profile koto-dev
```

Choose the intended Koto development account in the browser. The identity command must show the intended account ID, and the region command must print `ap-southeast-1`. The temporary session can refresh for up to 12 hours. End it when finished with `aws logout --profile koto-dev`.

Do not put credentials in `.env.local`; the website needs only the three public deployment outputs described in section 7. If `aws login` is unavailable, update AWS CLI v2 rather than falling back immediately to a long-lived access key.

## 5. Inspect and bootstrap the CDK environment

Synthesize the proposed infrastructure locally before creating anything:

```bash
npm exec -- cdk synth KotoLearningStack --profile koto-dev -c stage=dev -c region=ap-southeast-1 -c allowedOrigins=http://localhost:3000
```

Inspect the synthesized template and stop if the account, region, or proposed resources are wrong.

Bootstrap this account/region once, replacing the example account number with the value from `aws sts get-caller-identity`:

```bash
npm exec -- cdk bootstrap aws://123456789012/ap-southeast-1 --profile koto-dev
```

Bootstrapping creates a `CDKToolkit` CloudFormation stack with deployment roles and asset storage. Each account/region pair needs its own bootstrap. See [AWS CDK bootstrapping](https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping.html).

Now generate the deployment-aware diff:

```bash
npm exec -- cdk diff KotoLearningStack --profile koto-dev -c stage=dev -c region=ap-southeast-1 -c allowedOrigins=http://localhost:3000
```

Read the diff, particularly IAM policies, resource-retention settings, CORS origins, table billing mode, and the region/account. Stop if the account or region is wrong.

## 6. Deploy the Koto backend

Deploy from the repository root:

```bash
npm exec -- cdk deploy KotoLearningStack --profile koto-dev -c stage=dev -c region=ap-southeast-1 -c allowedOrigins=http://localhost:3000 --outputs-file cdk-outputs.json
```

Review the security/IAM summary before approving it. CDK synthesizes the stack, uploads the Lambda asset, and asks CloudFormation to create the resources; AWS describes that lifecycle in [Deploy AWS CDK applications](https://docs.aws.amazon.com/cdk/v2/guide/deploy.html).

Wait for `KotoLearningStack-dev` to reach `CREATE_COMPLETE` or `UPDATE_COMPLETE`. Record these outputs printed by CDK (the first three configure the website):

- `CognitoUserPoolId`
- `CognitoUserPoolClientId`
- `ApiUrl`
- `AwsRegion`
- `DeploymentStage`
- `AllowedOrigins`

You can retrieve them later from **CloudFormation → `KotoLearningStack-dev` → Outputs**. The ignored `cdk-outputs.json` file also records them under the `KotoLearningStack` CDK artifact key. Confirm `DeploymentStage` says `dev`, `AwsRegion` is the intended region, and `AllowedOrigins` contains only the expected browser origins. IDs and the API URL are public client configuration, not passwords, but keep them in environment settings rather than duplicating them through source files.

Development uses DynamoDB on-demand billing, clean deletion, and no point-in-time recovery by default. To exercise backups in development, add `-c enableBackups=true` consistently to `diff` and `deploy`. Production (`-c stage=prod`) automatically enables point-in-time recovery, retention, and deletion protection and deploys as the separate physical stack `KotoLearningStack-prod`. Production refuses a missing or wildcard `allowedOrigins` value. Use a separate production AWS account where possible; never treat development data as production merely by changing a context flag.

## 7. Connect a local build to AWS

Create `.env.local` from the tracked example:

```bash
cp .env.example .env.local
```

Replace the example values:

```dotenv
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_COGNITO_USER_POOL_ID=ap-southeast-1_yourPoolId
NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID=yourPublicAppClientId
NEXT_PUBLIC_API_URL=https://yourApiId.execute-api.ap-southeast-1.amazonaws.com/v1/
```

Do not add quotes or use a pool/client from another region. `.env.local` is ignored by Git; verify that before proceeding:

```bash
git check-ignore .env.local
```

Restart Next.js after any environment change:

```bash
npm run dev
```

At `http://localhost:3000/login`, create a throwaway account, enter the emailed verification code, sign in, complete one lesson and one kana action, reload, and verify the progress returns. Use the **Network** panel to confirm API calls go to the deployed `ApiUrl` and return successful authenticated responses.

If registration works but API calls return `401`, confirm all three IDs/URLs came from the same stack and region, restart the build, sign out, and sign in again to obtain a fresh token. Do not disable the Cognito authorizer as a workaround.

## 8. Connect GitHub to Amplify Hosting

1. Push the reviewed branch to the private GitHub repository.
2. Open **AWS Amplify → Deploy an app** in `ap-southeast-1`.
3. Choose GitHub, install/authorize the Amplify GitHub App for **only** the Koto repository, then select the intended deployment branch.
4. Confirm the repository root and build settings. Amplify should use the tracked `amplify.yml`, run `npm ci` and `npm run build`, and publish `.next`.
5. Create/use the Amplify service role requested by the console. This frontend does not need direct DynamoDB permissions; browser data access goes through Cognito and API Gateway.
6. Before the final build, add these branch environment variables under **Hosting → Environment variables**:
   - `NEXT_PUBLIC_COGNITO_USER_POOL_ID`
   - `NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID`
   - `NEXT_PUBLIC_API_URL`
   - `NEXT_PUBLIC_SITE_URL`
7. Set `NEXT_PUBLIC_SITE_URL` to the complete HTTPS Amplify URL (or your custom-domain URL) with no path. If you did an initial build to discover the generated URL, update this value and redeploy so metadata uses the correct origin.
8. Use the new URL in the origin-restriction deployment in the next section, then save and redeploy the frontend. Treat all `NEXT_PUBLIC_` variables as visible to browser users; never put secrets in them.

AWS's current Git connection and Next.js flow is in [Deploy a Next.js app to Amplify Hosting](https://docs.aws.amazon.com/amplify/latest/userguide/getting-started-next.html). After deployment, repeat the account and persistence cases in `docs/TESTING_GUIDE.md` against the Amplify HTTPS URL.

## 9. Restrict browser origins

For local-only development, the API must allow `http://localhost:3000`. For the hosted app, it must also allow the exact Amplify/custom HTTPS origin. Do not use a wildcard origin for the production environment.

After Amplify gives you its URL, replace the example generated domain below and redeploy the development backend with both local and hosted origins:

```bash
npm exec -- cdk diff KotoLearningStack --profile koto-dev -c stage=dev -c region=ap-southeast-1 -c allowedOrigins='http://localhost:3000,https://main.d123example.amplifyapp.com' -c gatewayErrorOrigin=https://main.d123example.amplifyapp.com
npm exec -- cdk deploy KotoLearningStack --profile koto-dev -c stage=dev -c region=ap-southeast-1 -c allowedOrigins='http://localhost:3000,https://main.d123example.amplifyapp.com' -c gatewayErrorOrigin=https://main.d123example.amplifyapp.com --outputs-file cdk-outputs.json
```

Then test normal responses and preflight requests from both allowed origins, and confirm an unrelated origin receives no CORS permission. API Gateway cannot dynamically choose among an allowlist for errors it creates before Lambda runs, so `gatewayErrorOrigin` designates the one allowed site that receives readable gateway-generated `401`/`4xx`/`5xx` responses. In this example that is the hosted site; a local browser can still use all Lambda-backed responses but may show an opaque network error for a rejected or expired token. The value must exactly match one entry in `allowedOrigins`.

CORS is a browser boundary, not authentication: Cognito authorization and per-user DynamoDB keys must remain enforced even for an allowed origin.

## 10. Cognito email: development versus production

The stack's default Cognito email sender is adequate for a small development test, but AWS applies a low daily limit and production delivery should use your own verified Amazon SES identity.

Before a public launch:

1. Own a sending domain and configure its DNS.
2. Verify the domain/address in Amazon SES in a supported region.
3. Request SES production access if the account is still in the sandbox.
4. Configure the Cognito user pool to send with that SES identity and set appropriate FROM/REPLY-TO addresses.
5. Test sign-up, resend-code, bounce handling, and password recovery.

Read [Email settings for Amazon Cognito user pools](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-email.html) before making the change. Prefer representing the final SES configuration in CDK rather than leaving an undocumented console-only change that a later deploy could overwrite.

## 11. Operations and data safeguards

Before inviting external users:

- Create CloudWatch alarms for Lambda errors/throttles, API 5xx responses, and DynamoDB throttling.
- Confirm API logs contain useful request IDs but no access tokens, passwords, or unnecessary full learner answers.
- Decide a written retention policy for profiles, progress, raw answer text, and review logs.
- Decide how a learner requests account/data deletion; Koto does not yet provide self-service deletion.
- Enable and test a backup/recovery approach suitable for the environment. For production DynamoDB, point-in-time recovery is the normal baseline; test restoring to a separate table.
- Keep development and production in separate stacks, ideally separate AWS accounts, with separate Cognito pools and data.
- Re-run `cdk diff` before every infrastructure update and review CloudFormation events after it.
- Test two Cognito users to verify cross-user isolation.

## 12. Updating the deployed app

Backend/infrastructure change:

Refresh the profile using the authentication method selected in section 4, then verify the selected identity before changing infrastructure. Use either `aws sso login --profile koto-dev` for Identity Center or `aws login --profile koto-dev --region ap-southeast-1` for temporary console credentials:

```bash
aws sts get-caller-identity --profile koto-dev
npm run typecheck
npm run test:run
npm exec -- cdk synth KotoLearningStack --profile koto-dev -c stage=dev -c region=ap-southeast-1 -c allowedOrigins='http://localhost:3000,https://main.d123example.amplifyapp.com' -c gatewayErrorOrigin=https://main.d123example.amplifyapp.com
npm exec -- cdk diff KotoLearningStack --profile koto-dev -c stage=dev -c region=ap-southeast-1 -c allowedOrigins='http://localhost:3000,https://main.d123example.amplifyapp.com' -c gatewayErrorOrigin=https://main.d123example.amplifyapp.com
npm exec -- cdk deploy KotoLearningStack --profile koto-dev -c stage=dev -c region=ap-southeast-1 -c allowedOrigins='http://localhost:3000,https://main.d123example.amplifyapp.com' -c gatewayErrorOrigin=https://main.d123example.amplifyapp.com --outputs-file cdk-outputs.json
```

Frontend change:

1. Run the local checks.
2. Push to the connected branch.
3. Watch the Amplify build and smoke-test its generated deployment.

If a CDK update replaces Cognito or changes an output, update `.env.local` and the Amplify variables, then rebuild both clients. Do not assume old tokens will remain valid after identity-resource replacement.

## 13. Cleanup and retained data

First inspect the selected stage. Deleting the Amplify app stops its hosting deployment but does not delete the separate CDK backend. Development resources default to deletion; production resources deliberately retain/protect learner data.

For a disposable development environment, only after exporting anything you need:

```bash
npm exec -- cdk destroy KotoLearningStack --profile koto-dev -c stage=dev -c region=ap-southeast-1
```

Read the confirmation carefully: the default development configuration permanently deletes its user pool, tables, logs, and their test data with the stack. The CDK bootstrap stack and its S3/ECR assets are separate. Review those separately if you will never deploy in this account/region again.

For `prod`, Cognito **and each DynamoDB table** have deletion protection. Those protections must be deliberately disabled before protected resources can be removed, and retained tables/pools/logs survive a stack destroy. Those resources may still incur cost. Delete them manually only when you have positively identified the Koto production resources, followed an approved retention/export procedure, and accepted permanent data loss.

Do not delete production user data merely to make a deployment command succeed. For production, use a documented export/retention/deletion process and test recovery first.

## 14. Deployment-complete checklist

- [ ] Root user MFA enabled; no root access keys.
- [ ] Deployment work uses temporary credentials (`aws login` for this free-account walkthrough, or Identity Center where available); ongoing administration is moved away from root.
- [ ] Account and region verified as the intended development environment.
- [ ] Zero-spend and monthly budget alerts confirmed.
- [ ] Automated code checks pass.
- [ ] CDK diff reviewed, environment bootstrapped, stack deployed successfully.
- [ ] `.env.local` uses all three outputs and remains ignored by Git.
- [ ] Registration, verification, login, recovery, persistence, logout, and user isolation pass.
- [ ] Amplify is authorized only for the intended repository and branch.
- [ ] Amplify environment variables and HTTPS site URL are correct.
- [ ] Production origins are restricted; an unrelated origin fails CORS, and `gatewayErrorOrigin` is the intended primary website.
- [ ] Cognito/SES production email decision is documented.
- [ ] Monitoring, backup/restore, data retention, and deletion procedures are tested.
- [ ] Full feature guide and pre-release human reviews are complete.
