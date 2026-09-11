# Koto feature testing guide

This guide covers the current version of Koto as both a guest-only local app and a signed-in app connected to AWS. Complete the automated checks first, then use the manual journeys for the parts that need a real browser, email, or cloud account.

## 1. Test prerequisites

- The pinned native Node.js 24.19.0 build and its included npm 11.6.2 (`nvm install` installs the version from `.nvmrc`; `nvm use` selects it).
- For guest testing: no AWS deployment is required.
- For account and persistence testing: complete `docs/AWS_SETUP_GUIDE.md` and place the deployed values in `.env.local`.
- Use throwaway email addresses rather than a personal production account.
- Use at least one desktop browser, one narrow mobile viewport, and one browser without speech-recognition support.

Install and start Koto:

```bash
nvm install
nvm use
npm --version
npm ci
npm run dev
```

Open `http://localhost:3000`.

`npm --version` should report `11.6.2`; npm comes with the selected Node installation, so no Corepack step is needed. On this Apple-silicon Mac, `uname -m` and `node -p "process.arch"` should both report `arm64`. If Node reports `x64`, install an arm64 Node 24.19.0 build and then run `npm ci` before testing. Otherwise the production build can fail while loading an x64 native `lightningcss` package.

`npm ci` performs a clean, lockfile-exact install. Run it for the first setup and after `package-lock.json` changes; an ordinary later launch only needs `nvm use` followed by `npm run dev`.

## 2. Automated release checks

Run all four checks from the repository root:

```bash
npm run typecheck
npm run lint
npm run test:run
npm run build
```

All commands must exit successfully. Do not treat a successful development server alone as a release check: the production build catches route and server/client boundary problems that development mode may not.

## 3. Resetting test state

Guest state belongs to the current browser tab's session storage.

1. Open browser developer tools.
2. Select **Application** (Chrome/Edge) or **Storage** (Firefox).
3. Open **Session storage** for `http://localhost:3000`.
4. Delete `koto-guest-progress-v1` and reload.

For cloud tests, create a new throwaway Cognito user when you need a completely empty learner. Koto intentionally has no destructive “erase cloud progress” button yet.

## 4. Guest and public-page journey

### G-01 — Shared navigation and guest warning

1. Sign out, or begin with an unconfigured local build.
2. Visit `/`, `/learn`, `/kana`, `/practice`, `/dashboard`, `/about`, and `/login` using the header and footer links; then open `/settings` directly while still signed out.
3. Resize below 760 px and open the mobile menu entirely with the keyboard.

Expected:

- Every public route loads without an account.
- A clear banner explains that guest progress is temporary.
- Header and footer links point to the correct routes.
- The mobile menu opens, receives visible keyboard focus, and does not cause horizontal scrolling.

### G-02 — Curriculum routes and lesson locks

1. From `/learn`, open each of the four tracks.
2. Confirm the first lesson in every track is available immediately.
3. Try to navigate directly to a later lesson URL before completing its preceding lesson.
4. Complete the first lesson with three correct answers out of five.
5. Retry and complete it with four correct answers out of five.
6. Reload, then open the next lesson.

Expected:

- Tracks are independent, but lessons inside one track unlock sequentially.
- `3/5` displays `60%` and does not unlock the next lesson.
- `4/5` displays `80%`, marks the lesson complete, and unlocks the next lesson.
- Explanations identify the correct answer after grading, and retries remain available.
- Guest completion survives a reload in the same tab.

### G-03 — Lesson media and interactive content

1. In **Sound foundations → Consonants without English baggage**, check the speech-anatomy explanation and play its example.
2. In **Prosody & mora → The Japanese beat**, find the `が・っ・こ・う` tap-along.
3. Press **Tap beat** four times, then press **Repeat 4 beats**.
4. In **Tokyo pitch accent → Four useful patterns**, inspect all four pitch contours and their accessible labels.
5. In **Kana → How kana works**, play the examples for small `っ`, `ー`, and small-vowel loanword combinations.

Expected:

- Audio never autoplays and each example keeps visible Japanese text, a Latin transcript, and an explanation.
- The tap-along counts four morae, including the visually small `っ` and the long-vowel beat `う`.
- Pitch diagrams describe relative movement and remain understandable without relying on colour alone.

### G-04 — TTS fallback

1. Press several audio buttons on a device with a Japanese system voice installed.
2. Repeat on a browser/device without a Japanese voice, if available.

Expected:

- Koto chooses a Japanese voice when the browser exposes one.
- While browser voices are loading, the control remains disabled; a late `voiceschanged` event enables it when a Japanese voice appears.
- A browser with speech synthesis but no Japanese voice shows **No Japanese voice**; a browser without speech synthesis shows **Audio unavailable**. In both cases the written Japanese remains visible and the disabled control does not pretend playback succeeded.
- The button returns to its idle state after playback or an error.
- No audio starts without a user action, and no AWS speech service is contacted.

## 5. Kana-learning journey

### K-01 — Recognition before recall

1. Reset guest state and open `/kana`.
2. Select **Hiragana → Vowels** and start recognition.
3. Answer one card incorrectly; confirm the correction, TTS button, and retry behaviour.
4. Continue through the full first pass and the following mixed-review round.

Expected:

- The first pass is exactly `a`, `i`, `u`, `e`, `o`, in curriculum order, and is labelled **Recognition · New row**.
- The next round contains the five vowels in a different, shuffled order and is labelled **Recognition · Mixed review**.
- Recall is locked until every new vowel has been answered correctly in both passes and both rounds have finished.
- A wrong answer resets only that card's learning streak.
- A missed new kana returns after the mixed-review round if it has not subsequently been answered correctly.
- Recognition completion unlocks recall without marking the whole group complete.

### K-02 — Recall grid and group completion

1. Start recall for the same vowel group.
2. Confirm the first round presents `a`, `i`, `u`, `e`, `o` in curriculum order and is labelled **Recall · New row**.
3. Confirm the second round contains the vowels in a different shuffled order and is labelled **Recall · Mixed review**.
4. On every prompt, confirm the target kana is present in the five-choice grid.
5. Record the grid order, intentionally answer once, then observe the next attempt.
6. Answer every recall card correctly twice in a row.

Expected:

- The target is always included in a grid of no more than five choices.
- Later groups add no more than ten randomly sampled recall cards from earlier groups to the mixed round.
- The grid order changes between attempts.
- Readings with multiple spellings, such as `o`, `ji`, and `zu`, show the target group's spelling hint so the question has one clear answer.
- The group becomes complete only after both recognition and recall thresholds.
- Both stages remain repeatable after completion.

### K-03 — Mixed recognition review

1. Complete the Hiragana vowel group.
2. Start the now-unlocked K row.
3. Begin recognition and note the order and labels of both rounds.

Expected:

- The K row appears first, once in curriculum order.
- It is followed by ten shuffled questions: all five K-row kana plus the five previously learned vowels.
- In later groups, the mixed round contains every new kana but no more than ten randomly sampled kana from all earlier groups.
- No **Cumulative warm-up** stage or label appears, and starting recall does not add a warm-up.
- Mixed-review answers for older kana do not reopen or determine completion of the current group and do not expose the formal FSRS due queue.

### K-04 — Script isolation

1. Begin Hiragana and Katakana groups independently.
2. Switch scripts repeatedly.

Expected:

- Each script retains its own started, recognition, recall, and completed groups.
- Completing a Hiragana group does not complete the corresponding Katakana group.

## 6. Scheduled-practice journey

### P-01 — Eligibility and filters

For the exact server-limit test, use a disposable signed-in development user and learn enough groups to unlock at least 16 recognition/recall cards. Do not manually edit their scheduling fields yet.

1. Open `/practice` with **Both** and **Mixed** before answering any new card; record the due/new counters and the queue response.
2. Exercise **Hiragana**, **Katakana**, and **Both**.
3. Exercise **Recognition**, **Recall**, and **Mixed**.
4. Return to **Both/Mixed** and answer all new cards offered that UTC day.
5. Reload and revisit every filter combination.

Expected:

- Only cards unlocked through Kana learning appear.
- Due cards come before new cards.
- Filters affect only the current view; they do not rewrite card history.
- Both/Mixed queues contain the applicable scripts/directions rather than silently falling back to one.
- The first queue exposes no more than 10 new cards, and after those are introduced no filter combination bypasses that shared UTC-day allowance.

### P-02 — Recognition and correction

1. Submit a typed correct rōmaji answer using a supported alias where applicable, such as `si` for `し`.
2. Choose **Hard**, **Good**, or **Easy** after a correct answer.
3. Submit an incorrect answer and continue.
4. Confirm that recognition offers only the rōmaji textbox and does not request microphone access.

Expected:

- Aliases normalize correctly.
- Correct answers default to Good but allow Hard/Easy overrides before advancing.
- Incorrect answers map to Again and cannot be overridden.
- No microphone or speech-recognition control is displayed.

### P-03 — Recall and daily cap

Prepare the overdue-card case with genuine reviewed records so the test does not rely on malformed DynamoDB data. Across at least two UTC dates, introduce at least 11 cards normally through Koto. In the disposable user's `ReviewCards` partition, record those cards' original `due` values and edit **only** their `due` fields to valid ISO timestamps at least five minutes in the past. Leave at least five other unlocked cards with `reps = 0`.

1. Open **Both/Mixed** and inspect the queue response before answering.
2. Confirm all 11+ overdue cards appear before any new card and that the due counter is greater than 10.
3. Use a Recall or Mixed queue with more than five unlocked kana and confirm the answer target appears in every recall grid.
4. Answer one overdue card, then inspect the immediate queue refresh.
5. Reload and try all filter combinations again.
6. Restore the recorded `due` values when finished. If you instead want to discard all disposable test data, export anything needed and destroy the entire development stack using the cleanup procedure in `docs/AWS_SETUP_GUIDE.md`; deleting only the Cognito user does not remove that user's DynamoDB records.

Expected:

- Overdue cards are not capped; only new introductions use the daily allowance.
- The target is always included among at most five choices.
- New-card usage is shared across filter combinations; switching filters cannot bypass the daily cap.
- Due cards remain available after the new-card allowance reaches zero.
- The just-reviewed card does not reappear from a lagging due-date index and does not produce a follow-up `CARD_NOT_DUE` error.

## 7. Dashboard journey

1. Reset state and open `/dashboard`; capture the empty state.
2. Complete one lesson, finish both stages of one kana group, and answer one correct and one incorrect scheduled review.
3. Return to the dashboard.

Expected:

- It recommends the next incomplete lesson and the next available kana group.
- It shows lessons complete, kana groups complete, reviews due, and new cards available today.
- Recent activity is newest-first and includes the lesson, completed kana group, and reviews.
- Hiragana and Katakana each have separate Recognition and Recall group counts.
- No fabricated “mastery percentage” is shown.











## 8. AWS account journey

Complete this section only after the deployed API values have been added to `.env.local` and the dev server has been restarted.

### A-01 — Registration and verification

1. Open `/login`, register a new throwaway email with at least eight characters, one lowercase letter, and one number in its password.
2. Reload before confirming, choose **Enter or resend a code**, and request a new code.
3. Enter an incorrect verification code, then the current code from the email.
4. Sign in.

Expected:

- Cognito sends the verification email.
- The confirmation flow remains reachable after a reload, and resending produces a usable new code.
- Bad/expired codes produce a useful message without losing the form.
- The header shows the signed-in account after successful authentication.

### A-02 — Password recovery

1. Sign out and select password recovery.
2. Request a reset for the test account.
3. Enter the emailed code and a new valid password.
4. Sign in with the new password; confirm the old password fails.

### A-03 — Persistent, isolated progress

1. As user A, complete a lesson, start a kana group, and submit reviews.
2. Reload, sign out, close the tab, open a new tab, and sign in again as user A.
3. Confirm the progress remains.
4. Sign in as a new user B in a separate browser profile.

Expected:

- User A's authoritative cloud progress returns after a new session.
- Signing out resets the visible learner state instead of leaking it into guest progress.
- Existing guest progress is not merged into an account; progress completed after sign-in is saved to that account.
- User B starts empty and cannot see user A's lessons, cards, logs, or dashboard activity.

### A-04 — Server authority and failure handling

1. Keep browser developer tools open on the **Network** tab.
2. Complete a lesson and inspect `POST /lessons/check`.
3. Submit learning and scheduled-practice answers and inspect the corresponding requests.
4. Copy one valid review request as fetch, then in the private developer console add hostile fields such as `userId`, `correct`, `due`, `stability`, and `difficulty` to its JSON body. Send it only against the disposable development stack.
5. Confirm the altered request receives `400 INVALID_REQUEST`, then inspect the three DynamoDB tables to verify that it wrote nothing.
6. Temporarily switch the browser to **Offline** and try one normal mutation, then restore the network and retry.

Expected:

- The browser sends answers, not a trusted `correct` flag, next due date, or user ID.
- Strict request validation rejects client attempts to supply identity, correctness, schedule, or FSRS state.
- Responses contain the authoritative lesson/group/card record and the UI reconciles to it.
- Lesson, learning-answer, and review requests include stable client operation IDs; retrying does not double-count an attempt, learning streak, or review.
- Review requests include a measured, non-negative `responseMs`.
- A failed cloud write is shown to the learner, remains on the unsaved lesson or Kana answer, and advances only after a successful retry.

### A-05 — Queue and transaction checks

First locate the generated resources: open **CloudFormation → `KotoLearningStack-dev` → Resources** and record the physical names for `LearnerData`, `ReviewCards`, `ReviewLogs`, `ApiHandler`, `ApiLogs`, and `ApiAccessLogs`. In **Cognito → the Koto user pool → Users**, open the test learner and copy its `sub`; that value is the DynamoDB `userId` partition key. Query tables with that exact value rather than scanning or guessing names.

1. In developer tools, use **Copy as fetch** on one successful review submission.
2. Re-run that same request promptly, preserving the same `clientReviewId`, `responseMs`, body, and authorization token.
3. Copy and replay an identical successful `POST /kana/learn`, preserving `clientLearningId`. Do the same for a lesson check and repeat one group-start request twice.
4. Take one copied review or learning request, preserve its client operation ID but change the answer. Send the altered replay and confirm `409 IDEMPOTENCY_KEY_REUSED`.
5. In `ReviewLogs`, `ReviewCards`, and `LearnerData`, confirm replays did not create duplicate records, duplicate `(itemId, direction)` cards, or extra lesson attempts/streak changes.
6. For a concurrency check, sign the same learner into two browser profiles, make one already-due card visible in both Practice queues, and submit it in profile A.
7. Without refreshing profile B, submit its stale copy of the same card; the two browser submissions should have different operation IDs.
8. In the DynamoDB console, inspect the relevant review card and review-log partition.

Expected:

- The repeated request returns the same logical result and creates no second review log.
- An operation ID is idempotent only for the original payload; changing the payload under that ID is rejected without mutation.
- One accepted submission updates the card and adds exactly one append-only log record.
- Profile B's stale submission is rejected and shown as unsaved rather than overwriting profile A's newer scheduling state.

### A-06 — Authorization boundary

1. Copy a successful authenticated dashboard or queue request from the browser Network panel.
2. Run a copy with the `Authorization` header removed; then run another with one character of the token altered.
3. For a real expiry test, keep one copied request private, decode its JWT payload locally to note the `exp` timestamp, wait until that time has passed, and replay the captured request with that old token. Do not rely on a normal app request because Amplify Auth may refresh it automatically.
4. Try the same read using user B's valid token and compare the returned partition with user A.
5. Repeat the removed/tampered/expired-token check with a copied mutation request, then inspect DynamoDB.

Expected:

- Missing, malformed, or expired/invalid tokens receive `401` and disclose no learner data.
- From the configured `gatewayErrorOrigin`, gateway-generated authentication failures include CORS headers, so the client receives a useful HTTP error instead of an opaque browser network failure. With a multi-origin development allowlist, another allowed origin may receive an opaque browser error only for failures API Gateway generates before Lambda runs.
- The browser cannot select a user ID; a valid user B token returns only user B's records.
- Unauthorized mutation attempts create no card, lesson, group, counter, idempotency, or log record.

Never paste the copied authorization token into chat, a bug report, source control, or a screenshot. It grants temporary access to the test account.

## 9. Responsive and accessibility pass

Repeat the main lesson, Kana, Practice, Dashboard, and Login journeys at approximately 375 px, 768 px, and desktop width.

- Zoom to 200% and check for clipped content or horizontal scrolling.
- Complete every interaction with Tab, Shift+Tab, Enter, Space, and arrow keys where native radio controls use them.
- Confirm a visible focus indicator is never hidden behind a sticky region.
- Run a browser accessibility audit, then manually check heading order, landmarks, form labels, live feedback, and meaningful control names.
- Enable reduced motion at OS/browser level and confirm transitions do not impede use.
- Test touch targets on a physical phone when possible.

## 10. Before public release

These checks require human review and cannot be proven by the unit suite:

- A qualified Japanese phonetics/Tokyo-accent reviewer approves pronunciation copy, examples, and pitch patterns against a reputable source such as OJAD.
- Privacy wording explains what learner account and progress data Koto stores.
- TTS is checked on the supported browser/device matrix.
- AWS alarms, budget alerts, backup/deletion policy, and recovery procedure have been exercised.
- A complete registration-to-review Playwright suite is added and run against the development stack before production promotion.

## 11. Recording a defect

Include the case ID above, route, guest/account state, browser and OS, viewport, exact steps, expected result, actual result, console error, and a redacted network response. Never include passwords, verification codes, access tokens, AWS keys, or unredacted learner data.
