# Koto — Japanese Foundations

Koto is a responsive learning app for native English speakers. It combines a four-track foundational curriculum with a cumulative kana trainer backed by FSRS.

## Included

- Four independent curriculum tracks: sound foundations, prosody and mora, Tokyo pitch accent, and kana.
- Sequential lesson unlocking within each track with an 80% check threshold.
- Full guest access with an explicit session-only progress warning.
- Cumulative hiragana and katakana learning groups, including voiced forms and yōon.
- Separate FSRS cards for kana recognition and recall, at 90% desired retention.
- Typed rōmaji with common aliases, optional browser speech recognition, and shuffled-grid recall.
- Replayable Japanese browser TTS with no autoplay.
- Verified-email Cognito registration, login, verification, and password recovery.
- Authenticated API Gateway/Lambda interfaces and user-partitioned DynamoDB records.
- Responsive dashboard with due counts, lesson progress, activity, and non-percentage memory labels.

## Run locally

The bundled runtime used during development is Node 24; Node 20 or newer is recommended.

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`. Without AWS environment variables, the app intentionally runs in guest mode and stores progress in `sessionStorage` only.

Useful checks:

```bash
pnpm typecheck
pnpm lint
pnpm test:run
pnpm build
```

## AWS architecture

The CDK stack in `infra/` creates:

- Amazon Cognito User Pool with verified email/password accounts.
- Amazon API Gateway REST API with a Cognito authorizer.
- One bundled Node.js Lambda for queue, review, lesson, group, and dashboard operations.
- Three provisioned DynamoDB tables at 1 read/1 write capacity unit: learner data, review cards, and append-only review logs.
- A due-date GSI on review cards.
- Seven-day CloudWatch log retention.

Every persisted key begins with the authenticated Cognito `sub`; the browser never supplies the user identifier. A review card update and its immutable review log are written in one DynamoDB transaction.

Synthesize the stack (the helper automatically uses a system temporary output folder so OneDrive cannot lock CDK&apos;s bundle rename):

```bash
pnpm cdk:synth
```

Deploy after configuring the AWS CLI and bootstrapping the target region:

```bash
pnpm exec cdk bootstrap
pnpm exec cdk deploy
```

Copy the three stack outputs into `.env.local` using `.env.example` as the template, then rebuild the app. `amplify.yml` is ready for a Git-connected AWS Amplify Hosting app.

## Cost boundary

This stack is deliberately small, but source code cannot guarantee a zero bill. Confirm each service is eligible in your account/region and set billing alerts before deployment. Under AWS's current Free account plan, a new account can experiment for up to six months or until its credits are used, whichever happens first. Keep a single development environment and remove resources you no longer need; the DynamoDB tables and Cognito pool use `RETAIN` so learner data is not silently deleted with the stack.

Browser TTS and Web Speech recognition do not call Amazon Transcribe, Polly, or another paid speech API. Their availability and Japanese quality depend on the learner's browser and operating system.

## Curriculum review

The source notes in the parent folder remain untouched. Learner-facing copy corrects the main shorthand issues: phonetic `/j/` versus the English letter j, the alveolar tap `/ɾ/`, contextual ん, gemination for small っ, moraic long vowels, and the limits of English approximations.

Tokyo pitch-accent examples should receive final approval from a qualified Japanese phonetics reviewer before a public production launch. The curriculum links learners to the University of Tokyo's OJAD database for checked word patterns.

## Project map

```text
app/                 Next.js routes and application shell
components/          lesson, trainer, dashboard, auth, TTS and voice UI
lib/curriculum.ts    rewritten curriculum content and lesson checks
lib/kana.ts          ordered kana groups, aliases and answer grading
lib/progress.ts      guest state, proficiency rules and FSRS transitions
infra/               AWS CDK stack and Lambda handler
public/og-koto.png   generated social preview artwork
```

The social preview was generated with the built-in image tool using a warm parchment, indigo, coral, and mint editorial study-card prompt; no third-party image asset is required.
