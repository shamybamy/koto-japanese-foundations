# Koto — Japanese Foundations

Koto is a responsive learning app for native English speakers. It combines a four-track foundational curriculum with a cumulative kana trainer backed by FSRS.

## Included

- Four independent curriculum tracks: sound foundations, prosody and mora, Tokyo pitch accent, and kana.
- Sequential lesson unlocking within each track with an 80% check threshold.
- Full guest access with an explicit session-only progress warning.
- Cumulative hiragana and katakana learning groups, including voiced forms and yōon.
- Separate FSRS cards for kana recognition and recall, at 90% desired retention.
- Typed rōmaji with common aliases and shuffled-grid recall.
- Replayable Japanese browser TTS with no autoplay.
- Verified-email Cognito registration, login, verification, and password recovery.
- Authenticated API Gateway/Lambda interfaces and user-partitioned DynamoDB records.
- Responsive dashboard with due counts, lesson progress, activity, and non-percentage memory labels.

## Run locally

The repository pins Node 24.19.0 and npm 11.6.2. npm is included with this Node installation, so Corepack and a separate package-manager installation are not required. On this Apple-silicon Mac, run `nvm use` and make sure `node -p "process.arch"` reports `arm64`; if it reports `x64`, install a native arm64 Node build and reinstall dependencies before building.

```bash
nvm install
nvm use
npm ci
npm run dev
```

Open `http://localhost:3000`. Without AWS environment variables, the app intentionally runs in guest mode and stores progress in `sessionStorage` only.

After the first installation, you can normally start Koto with only `nvm use` and `npm run dev`. Run `npm ci` again after pulling a changed `package-lock.json` or when rebuilding dependencies from scratch.

Useful checks:

```bash
npm run typecheck
npm run lint
npm run test:run
npm run build
```

For full handoff instructions, use the [feature testing guide](docs/TESTING_GUIDE.md) and the [AWS account, deployment, and hosting guide](docs/AWS_SETUP_GUIDE.md).

## AWS architecture

The CDK stack in `infra/` creates:

- Amazon Cognito User Pool with verified email/password accounts.
- Amazon API Gateway REST API with a Cognito authorizer.
- One bundled Node.js Lambda for queue, review, lesson, group, and dashboard operations.
- Three on-demand DynamoDB tables: learner data, review cards, and append-only review logs.
- A due-date GSI on review cards.
- Seven-day CloudWatch Lambda and API access-log retention.

Every persisted key begins with the authenticated Cognito `sub`; the browser never supplies the user identifier. A review card update and its immutable review log are written in one DynamoDB transaction.

Synthesize the development stack against the same named AWS profile and region you will deploy:

```bash
npm exec -- cdk synth KotoLearningStack --profile koto-dev -c stage=dev -c region=ap-southeast-1 -c allowedOrigins=http://localhost:3000
```

Deploy a development stack after configuring the AWS CLI and bootstrapping the target region:

```bash
npm exec -- cdk bootstrap aws://YOUR_ACCOUNT_ID/ap-southeast-1 --profile koto-dev
npm exec -- cdk deploy KotoLearningStack --profile koto-dev -c stage=dev -c region=ap-southeast-1 -c allowedOrigins=http://localhost:3000 --outputs-file cdk-outputs.json
```

Copy the user-pool, app-client, and API outputs into `.env.local` using `.env.example` as the template, then rebuild the app. `amplify.yml` is ready for a Git-connected AWS Amplify Hosting app. See the AWS guide below before deploying: development defaults to removable resources without point-in-time recovery, while `-c stage=prod` enables retention, deletion protection, and DynamoDB point-in-time recovery.

## Cost boundary

This stack is deliberately small, but source code cannot guarantee a zero bill. Confirm each service is eligible in your account/region and set billing alerts before deployment. Keep a single development environment and remove resources you no longer need. Production resources use `RETAIN`, Cognito deletion protection, and DynamoDB point-in-time recovery so learner data is not silently removed with the stack; development resources default to `DESTROY` so cleanup and redeployment remain practical.

Browser TTS does not call Amazon Polly or another paid speech API. Its availability and Japanese quality depend on the learner's browser and operating system.

## Curriculum review

The source notes in the parent folder remain untouched. Learner-facing copy corrects the main shorthand issues: phonetic `/j/` versus the English letter j, the alveolar tap `/ɾ/`, contextual ん, gemination for small っ, moraic long vowels, and the limits of English approximations.

Tokyo pitch-accent examples should receive final approval from a qualified Japanese phonetics reviewer before a public production launch. The curriculum links learners to the University of Tokyo's OJAD database for checked word patterns.

## Project map

```text
app/                 Next.js routes and application shell
components/          lesson, trainer, dashboard, auth and TTS UI
lib/curriculum.ts    rewritten curriculum content and lesson checks
lib/kana.ts          ordered kana groups, aliases and answer grading
lib/progress.ts      guest state, proficiency rules and FSRS transitions
infra/               AWS CDK stack and Lambda handler
public/og-koto.png   generated social preview artwork
```

The social preview was generated with the built-in image tool using a warm parchment, indigo, coral, and mint editorial study-card prompt; no third-party image asset is required.
