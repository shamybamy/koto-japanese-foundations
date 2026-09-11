# Koto: Japanese Foundations and Kana Trainer

Last updated: 5 September 2026

## 1. Product summary

Koto is a responsive Japanese-learning website for native English speakers. It combines a beginner-friendly teaching curriculum with a separate kana testing area that uses spaced repetition.

The app has two main learning modes:

1. **Learn** — structured explanations and low-pressure exercises for pronunciation, prosody, pitch accent, and kana.
2. **Practice** — a focused hiragana/katakana testing screen backed by FSRS scheduling.

All educational content is available without an account. Guests are clearly warned that their progress is temporary and will not be saved after the browser session ends. Registered users receive persistent lesson progress, kana scheduling, and review history.

## 2. Confirmed product decisions

- All curriculum content is publicly accessible.
- Guests can try lessons and exercises, but see a clear warning that progress is not permanently saved.
- Registration uses a verified email address and password. Social login is outside version 1.
- The four curriculum tracks can be studied in any order.
- Lessons inside each individual track unlock sequentially.
- A lesson check requires a score of at least 80% to count as completed. Retries are unlimited.
- Kana learning and scheduled kana testing are separate experiences.
- Recognition and recall are taught separately, with recognition completed before recall within a learning group.
- Completed kana groups can be repeated freely.
- The scheduled testing area stores separate FSRS memories for recognition and recall.
- Japanese example audio uses text-to-speech rather than recorded native-speaker audio.
- Recognition questions support optional speech-to-text as an alternative to typing rōmaji.
- Recall uses a shuffled kana grid rather than an IME, and the grid is reshuffled between attempts.
- Small っ and long vowels receive short curriculum explanations and contextual exercises, but are not presented as misleading standalone kana-to-rōmaji cards.
- The interface should remain calm, compact, and easy to scan, with restrained font sizes and minimal dashboard clutter.

## 3. Intended learners

The primary learner is a native English speaker beginning Japanese. Explanations should therefore:

- compare Japanese sounds with familiar English sounds where useful;
- label English comparisons as approximations rather than exact equivalents;
- introduce phonetic terminology in plain language;
- explain how the tongue, lips, airflow, timing, and pitch differ from English;
- use modified Hepburn rōmaji for display;
- accept common input aliases such as `si/shi`, `ti/chi`, `tu/tsu`, `hu/fu`, and `sya/sha`.

The preferred terminology is **rōmaji**, **palatalization**, and **mora**.

## 4. Curriculum structure

The four tracks are independent at the top level. A learner may begin any track, while lessons within the selected track follow a recommended locked sequence.

### Track A: Japanese sound foundations

Teach Japanese pronunciation from an English speaker's perspective:

- basic speech anatomy and how to follow articulation instructions;
- the five Japanese vowels;
- vowel length and why an extra mora can change meaning;
- aspiration differences between English and Japanese stops;
- dental and alveolar tongue placement;
- the Japanese alveolar tap `/ɾ/`, without describing it simply as an English L;
- the moraic nasal `/N/` and its context-dependent pronunciation;
- Japanese `/ɸ/`, produced without the firm lip contact of English F;
- Japanese `/ç/`;
- phonetic `/j/` as the English Y-like sound, not the English letter J;
- palatalization and yōon;
- gemination and small っ;
- common vowel devoicing patterns.

Each explanation should include replayable TTS examples, visible text, a transcript, and an English comparison only where it genuinely helps.

### Track B: Prosody and mora

Teach the learner to hear Japanese rhythm in morae rather than applying English stress timing:

- syllables compared with morae;
- even mora timing;
- long vowels as two morae;
- ん as one mora;
- small っ as one mora of timing before a geminated consonant;
- yōon combinations as one mora;
- mora segmentation and tap-along exercises;
- the distinction between English stress and Japanese timing and pitch.

### Track C: Tokyo pitch accent

Introduce the four commonly taught Tokyo pitch-accent patterns:

- heiban;
- atamadaka;
- nakadaka;
- odaka.

Lessons should explain:

- high and low pitch relationships rather than musical notes;
- the single lexical downstep in a word;
- how a following particle helps distinguish heiban from odaka;
- phrase-level lowering and why isolated dictionary diagrams do not describe every natural sentence;
- emphasis without treating Japanese like English lexical stress.

Use simple pitch-track graphics and replayable TTS. Before a public production release, a qualified Japanese phonetics or Tokyo-accent reviewer should approve the examples. Checked word patterns should be compared against a reputable resource such as the University of Tokyo OJAD database.

### Track D: Kana learning path

Teach kana in small cumulative groups. Example order:

1. vowels: a, i, u, e, o;
2. K row: ka, ki, ku, ke, ko;
3. S row;
4. T row;
5. N row;
6. H row;
7. M row;
8. Y row;
9. R row;
10. W row and n;
11. dakuten and handakuten forms;
12. yōon combinations.

The interface labels script choices as **Hiragana** and **Katakana** in Latin script.

For each group:

1. Introduce how each kana is read and provide TTS playback.
2. Practise recognition: kana → rōmaji.
3. Reach the recognition threshold before recall unlocks.
4. Practise recall: rōmaji → kana using a shuffled grid.
5. Mark the group complete after meeting the recall threshold.
6. Allow either stage to be repeated at any time after completion.

Previously introduced kana continue to appear while the learner works through later groups. This learning path is intentionally low pressure and does not display the scheduled review queue.

Short contextual lessons cover:

- small っ as consonant gemination and an extra mora;
- long vowel spelling and timing;
- ー in katakana;
- small vowels in loanword spelling.

## 5. Separate FSRS practice area

The Practice page is the formal testing and scheduling area. Its visual model is a focused prompt similar to readthekanji.com: one large item in the centre, one clear response action, and minimal surrounding information.

### Card model

Create one scheduling card for every:

```text
(user, kana item, direction)
```

The two directions are independent:

- **Recognition:** show kana; answer with typed rōmaji.
- **Recall:** show rōmaji; choose the kana from a shuffled grid.

A learner can therefore be strong at reading a kana but still be developing its recall.

### Queue behaviour

- Show all overdue cards before new cards.
- Introduce up to 10 new cards per day in curriculum order.
- Use 90% desired retention initially.
- Do not impose an artificial limit on overdue reviews.
- Filters allow hiragana, katakana, or both, and recognition, recall, or mixed practice.
- Filters change only the current session and never rewrite scheduling history.
- Kana unlocked through the learning path become eligible for the testing queue.
- Submitting the first answer must not incorrectly add an entire group as failed cards.

### Answer and rating behaviour

- Incorrect answers map to **Again**.
- Correct answers default to **Good**.
- After seeing the correction, a learner may override a correct answer to **Hard** or **Easy** before advancing.
- The server independently validates the answer and calculates the next FSRS state using server time.
- The card update and append-only review log are committed atomically.
- Feedback includes the correct answer and replayable TTS audio.

The product should describe proficiency using understandable labels such as **New**, **Learning**, **Developing**, and **Strong**, derived from FSRS state and stability. It should not display a fabricated mastery percentage.

## 6. Audio

### Text-to-speech

Version 1 uses the browser's Japanese speech-synthesis voices:

- no autoplay;
- replay controls beside examples and corrections;
- visible transcripts;
- isolated examples and short natural phrases where useful;
- graceful fallback when no Japanese voice is installed.

Browser TTS avoids Amazon Polly charges, but voice quality varies by browser and operating system.

## 7. Accounts and guest progress

### Guests

- Can access every lesson and both learning modes.
- See a warning that progress is temporary.
- Store temporary progress in `sessionStorage`.
- Cannot create a persistent FSRS history across sessions.

### Registered users

- Register with email and password.
- Verify the email address before normal sign-in.
- Can request password recovery.
- Save curriculum progress, kana group progress, review cards, and review logs.
- Can access only their own records.

Anonymous-progress merging and social login are outside version 1.

## 8. Progress and dashboard

Keep the dashboard intentionally simple. Its primary questions are:

1. What should I continue learning?
2. How many reviews are due?
3. What did I recently complete?

Show:

- one recommended next lesson;
- overall curriculum completion in a compact form;
- reviews due and new cards available today;
- a short recent-activity list;
- a compact kana overview with separate recognition and recall labels.

Avoid dense charts, competing cards, unexplained numbers, and oversized headings. More detailed scheduling data can remain in settings or a future statistics view.

## 9. Technology stack

### Frontend and full-stack framework

- **Next.js App Router, React, and TypeScript** provide routes, server/client rendering, interactive exercises, and a shared type-safe codebase.
- **Tailwind CSS** provides responsive styling.
- Reusable React components implement lessons, kana grids, TTS, feedback, and progress displays.

### Learning libraries

- **ts-fsrs** calculates spaced-repetition scheduling.
- **Zod** validates input at system boundaries.

### AWS services

- **AWS Amplify Hosting** builds and hosts the Next.js application from GitHub.
- **Amazon Cognito** provides verified-email/password authentication and recovery.
- **Amazon API Gateway** exposes authenticated application endpoints.
- **AWS Lambda** grades answers, applies FSRS, records progress, and aggregates dashboard data.
- **Amazon DynamoDB** stores learner state, review cards, and review logs.
- **Amazon CloudWatch** stores short-retention application logs.
- **AWS CDK** defines the AWS infrastructure in TypeScript.

The app does not require Amazon Polly or Amazon Transcribe because version 1 uses browser speech APIs.

### Testing and development

- **npm** manages JavaScript packages.
- **Vitest** runs unit tests.
- **React Testing Library** tests user-facing component behaviour.
- **ESLint** checks code quality.
- **TypeScript** performs static type checking.
- **Playwright** remains recommended for complete browser-flow tests as the project moves toward deployment.

Use Node.js 20 or newer; the current dependency set is best run with the bundled Node.js 24 development runtime.

## 10. AWS data design

Core logical records:

- `profiles` — preferences and account timestamps;
- `lesson_progress` — status, best score, attempts, and completion time;
- `kana_group_progress` — recognition/recall stage and completion state;
- `review_cards` — kana identity, direction, due time, and complete serialized FSRS state;
- `review_logs` — append-only answers, correctness, rating, response time, before/after state, scheduler version, and review time.

Every persisted partition key begins with the authenticated Cognito user ID. The browser never chooses the user ID sent to DynamoDB.

Required guarantees:

- prevent duplicate cards for the same user, kana, and direction;
- index cards for efficient due-date queries;
- make lesson completion and card unlocking idempotent;
- write each review-card update and review log in one DynamoDB transaction;
- reject expired or invalid authenticated requests.

## 11. Server interfaces

Provide authenticated endpoints for:

- loading a filtered review queue;
- submitting a review answer and optional rating override;
- grading lesson-check answers;
- saving kana-learning group progress;
- idempotently unlocking eligible test cards;
- loading a compact dashboard summary.

The server must validate correctness itself. It must never trust a browser-supplied `correct` flag, next due date, FSRS state, or user ID.

## 12. Accessibility and responsive design

- Semantic heading order and landmarks.
- Visible keyboard focus.
- Full keyboard operation for answers and kana selection.
- Screen-reader labels for controls, pitch diagrams, and audio state.
- Text transcripts for every audio example.
- Sufficient colour contrast.
- Reduced-motion support.
- Comfortable use on narrow mobile screens without horizontal scrolling.
- Kana grids with large enough touch targets while keeping the overall page compact.

## 13. Testing plan

### Unit tests

- rōmaji normalization and accepted aliases;
- kana grouping and curriculum order;
- answer grading;
- recognition-before-recall progression;
- group replay behaviour;
- lesson unlocking and 80% threshold;
- queue ordering and daily new-card limit;
- rating mapping;
- deterministic FSRS transitions.

### Component tests

- keyboard operation;
- shuffled kana grids between attempts;
- answer feedback and rating overrides;
- TTS controls and fallbacks;
- typed recognition and kana-grid recall controls;
- pitch diagrams;
- guest warnings;
- simplified progress states;
- mobile layouts.

### AWS and integration tests

- cross-user isolation;
- duplicate-card prevention;
- atomic review commits;
- idempotent lesson/group completion;
- invalid or expired session rejection;
- server-side answer validation.

### End-to-end tests

- public lesson browsing as a guest;
- registration, verification, login, and password recovery;
- progress persistence after returning;
- completing and replaying a kana group;
- unlocking recognition before recall;
- receiving scheduled cards in Practice;
- correct and incorrect reviews;
- hiragana/katakana and direction filters;
- logout;
- desktop and mobile flows.

## 14. Deployment and cost plan

1. Keep the source in the private GitHub repository:
   `https://github.com/shamybamy/koto-japanese-foundations`
2. Configure AWS CLI credentials for the chosen development account and region.
3. Run CDK bootstrap once for that account and region.
4. Synthesize and deploy the CDK stack.
5. Copy the Cognito and API outputs into `.env.local` for local testing.
6. Connect the GitHub repository to AWS Amplify Hosting.
7. Add the required environment variables to Amplify.
8. Deploy a development environment and run end-to-end tests.
9. Add AWS Budget alerts before broader testing.

The architecture is deliberately small, but a free AWS account does not guarantee zero charges. Eligibility depends on the account, region, usage, current AWS offer, and whether promotional credits remain. Keep one development environment, monitor billing, use short log retention, and remove resources that are no longer needed. DynamoDB tables and the Cognito pool currently use a retain policy so learner data is not silently deleted with the stack.

## 15. Current implementation status

Already implemented in the repository:

- Next.js application shell and responsive visual design;
- public routes for home, curriculum, lesson tracks, kana learning, practice, dashboard, login, settings, and about;
- four curriculum tracks with learner-facing content;
- sequential lesson logic and guest progress support;
- cumulative hiragana and katakana groups;
- separate recognition and recall interactions;
- repeatable kana learning groups;
- shuffled recall grid;
- focused FSRS practice page with script/direction filters;
- browser TTS;
- compact dashboard;
- Cognito/Amplify client configuration;
- API Gateway, Lambda, DynamoDB, and Cognito CDK infrastructure;
- unit and component tests for core learning behaviour;
- AWS Amplify build configuration;
- private GitHub repository and tracked `main` branch.

Still required before a production launch:

- deploy the AWS development stack and connect real environment values;
- connect and validate Amplify Hosting;
- test registration and persistent progress against deployed AWS services;
- expand Playwright end-to-end coverage;
- test TTS across supported desktop and mobile browsers;
- perform accessibility and responsive-device review;
- have pronunciation and pitch-accent material reviewed by a qualified Japanese expert;
- add monitoring, billing alerts, and a documented backup/deletion policy;
- decide on privacy-policy wording for learner accounts.

## 16. Version 1 acceptance criteria

Version 1 is ready when a new learner can:

1. browse every curriculum track without registering;
2. understand that guest progress is temporary;
3. create and verify an email/password account;
4. complete lessons in any track while respecting that track's internal order;
5. learn a kana group through recognition followed by recall;
6. repeat a completed learning stage freely;
7. practise recognition by typing rōmaji and recall through the kana grid;
8. enter the separate Practice page and receive the correct FSRS queue;
9. switch between hiragana, katakana, recognition, and recall;
10. return later and see the correct persisted progress and due cards;
11. complete these flows on both desktop and mobile without accessibility blockers.

## 17. Deferred ideas

The following are intentionally outside version 1:

- social login or anonymous-account merging;
- a content-management system;
- subscriptions or payments;
- teacher and classroom portals;
- detailed pronunciation scoring;
- handwriting recognition;
- offline mode;
- kanji, vocabulary, and grammar courses;
- FSRS scheduling for pronunciation or pitch-accent lessons;
- personalized FSRS parameter optimization before enough review history exists;
- native-speaker recording production.
