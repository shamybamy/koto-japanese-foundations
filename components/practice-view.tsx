"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, CircleAlert, Keyboard, Layers3, RotateCcw } from "lucide-react";
import { Rating } from "ts-fsrs";
import { useProgress } from "@/app/providers";
import { TtsButton } from "@/components/tts-button";
import { Direction, findKanaItem, isRomajiAnswer, recallDisambiguation, seededShuffle } from "@/lib/kana";
import { PracticeDirection, PracticeScript, ReviewQueuePayload, buildGuestReviewQueue, cardMatchesPracticeFilters } from "@/lib/practice-queue";
import { StoredCard, strengthLabel } from "@/lib/progress";

type Feedback = { correct: boolean; submitted: string; inputMode: "typed" | "grid" };

const emptyCloudQueue = (): ReviewQueuePayload => ({ cards: [], dueCount: 0, newCount: 0, serverTime: "" });
const keyOf = (card: Pick<StoredCard, "itemId" | "direction">) => `${card.itemId}:${card.direction}`;

export function PracticeView() {
  const { progress, reviewCard, loadReviewQueue, isGuest, authReady, cloudPending } = useProgress();
  const [script, setScript] = useState<PracticeScript>("hiragana");
  const [direction, setDirection] = useState<PracticeDirection>("recognition");
  const [cloudQueue, setCloudQueue] = useState<ReviewQueuePayload>(emptyCloudQueue);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueError, setQueueError] = useState("");
  const [queueNotice, setQueueNotice] = useState("");
  const [activeCard, setActiveCard] = useState<StoredCard | null>(null);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [shuffleAttempt, setShuffleAttempt] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [saveChoice, setSaveChoice] = useState<Rating | "again" | null>(null);
  const requestSequence = useRef(0);
  const promptStartedAt = useRef(Date.now());
  const responseMs = useRef(0);
  const clientReviewId = useRef("");
  const filtersRef = useRef(`${script}:${direction}`);
  filtersRef.current = `${script}:${direction}`;

  const guestQueue = useMemo(
    () => buildGuestReviewQueue(progress, script, direction),
    [progress, script, direction],
  );
  const queueResult = isGuest ? guestQueue : cloudQueue;
  const queue = queueResult.cards;

  const refreshCloudQueue = useCallback(async (clearCurrent = true) => {
    if (isGuest || !authReady) return false;
    const request = ++requestSequence.current;
    setQueueLoading(true);
    setQueueError("");
    setQueueNotice("");
    if (clearCurrent) setCloudQueue(emptyCloudQueue());
    const result = await loadReviewQueue(script, direction);
    if (request !== requestSequence.current) return false;
    if (result) setCloudQueue(result);
    else setQueueError("Koto could not load the AWS review queue. Your saved schedule has not been changed.");
    setQueueLoading(false);
    return Boolean(result);
  }, [isGuest, authReady, loadReviewQueue, script, direction]);

  useEffect(() => {
    if (isGuest) {
      requestSequence.current += 1;
      setQueueLoading(false);
      setQueueError("");
      return;
    }
    void refreshCloudQueue();
  }, [isGuest, refreshCloudQueue]);

  useEffect(() => {
    const currentKey = activeCard ? keyOf(activeCard) : null;
    const current = currentKey ? queue.find((card) => keyOf(card) === currentKey) : undefined;
    if (current) {
      if (current !== activeCard) setActiveCard(current);
      return;
    }
    setActiveCard(queue[0] ?? null);
  }, [queue, activeCard]);

  const activeKey = activeCard ? keyOf(activeCard) : "";
  useEffect(() => {
    if (activeKey && !submitting && !feedback) {
      promptStartedAt.current = Date.now();
      responseMs.current = 0;
    }
  }, [activeKey, submitting, feedback]);

  function changeScript(next: PracticeScript) {
    if (next === script || submitting) return;
    setScript(next);
    resetCard();
  }

  function changeDirection(next: PracticeDirection) {
    if (next === direction || submitting) return;
    setDirection(next);
    resetCard();
  }

  function resetCard() {
    setActiveCard(null);
    setFeedback(null);
    setTypedAnswer("");
    setSaveChoice(null);
    responseMs.current = 0;
    clientReviewId.current = "";
  }

  function saveFeedback(next: Feedback) {
    responseMs.current = Math.max(0, Date.now() - promptStartedAt.current);
    clientReviewId.current ||= crypto.randomUUID();
    setFeedback(next);
  }

  const item = activeCard ? findKanaItem(activeCard.itemId) : undefined;
  const activeDirection: Direction = activeCard?.direction ?? (direction === "mixed" ? "recognition" : direction);
  const recallHint = item && activeDirection === "recall" ? recallDisambiguation(item) : undefined;

  function submitTyped(event: FormEvent) {
    event.preventDefault();
    if (!item || !typedAnswer.trim() || feedback) return;
    saveFeedback({ correct: isRomajiAnswer(item, typedAnswer), submitted: typedAnswer, inputMode: "typed" });
  }

  function selectKana(kana: string) {
    if (!item || feedback) return;
    saveFeedback({ correct: kana === item.kana, submitted: kana, inputMode: "grid" });
  }

  async function advance(rating?: Rating) {
    if (!activeCard || !feedback || submitting) return;
    const choice = saveChoice ?? rating ?? "again";
    const submittedRating = choice === "again" ? undefined : choice;
    if (saveChoice === null) setSaveChoice(choice);
    setSubmitting(true);
    setQueueError("");
    const reviewedCard = activeCard;
    const submittedFilters = `${script}:${direction}`;
    const result = await reviewCard(
      reviewedCard.itemId,
      reviewedCard.direction,
      feedback.submitted,
      feedback.correct,
      submittedRating,
      feedback.inputMode,
      responseMs.current,
      clientReviewId.current,
    );
    if (!result) {
      setSubmitting(false);
      setQueueError("That answer was not saved. Check the message above, then try again.");
      return;
    }

    if ("rejected" in result) {
      setCloudQueue((current) => ({ ...current, cards: current.cards.filter((card) => keyOf(card) !== keyOf(reviewedCard)) }));
      resetCard();
      const refreshed = filtersRef.current === submittedFilters ? await refreshCloudQueue(false) : false;
      setQueueNotice(refreshed
        ? `${result.message} Your current schedule has been refreshed.`
        : `${result.message} Reload the schedule before answering this card again.`);
      setSubmitting(false);
      return;
    }

    setAnswered((count) => count + 1);
    if (result.correct) setCorrectCount((count) => count + 1);
    setShuffleAttempt((attempt) => attempt + 1);
    if (!isGuest) {
      setCloudQueue((current) => ({ ...current, cards: current.cards.filter((card) => keyOf(card) !== keyOf(reviewedCard)) }));
    }
    resetCard();
    if (!isGuest && filtersRef.current === submittedFilters) await refreshCloudQueue(false);
    setSubmitting(false);
  }

  const availableCards = useMemo(() => {
    const cards = new Map<string, StoredCard>();
    for (const card of [...Object.values(progress.cards), ...queue]) cards.set(keyOf(card), card);
    return [...cards.values()].filter((card) => cardMatchesPracticeFilters(card, script, direction));
  }, [progress.cards, queue, script, direction]);

  const gridKana = useMemo(() => {
    if (!item) return [];
    const distractors = Array.from(new Set(
      availableCards
        .filter((card) => card.direction === "recall" && card.itemId !== item.id)
        .map((card) => findKanaItem(card.itemId)?.kana)
        .filter((kana): kana is string => Boolean(kana)),
    ));
    const selected = seededShuffle(distractors, `${item.id}-${shuffleAttempt}-test-distractors`).slice(0, 4);
    return seededShuffle([item.kana, ...selected], `${item.id}-${shuffleAttempt}-test-grid`);
  }, [item, availableCards, shuffleAttempt]);

  const showLoading = !authReady || (!isGuest && queueLoading && queue.length === 0);

  return (
    <main className="test-page page-shell">
      <header className="test-header">
        <div><span className="eyebrow">Scheduled practice</span><h1>Kana test</h1><p>Review due kana and introduce up to ten new cards each day.</p></div>
        <Link href="/kana">Open kana learning <ArrowRight size={15} /></Link>
      </header>

      <section className="test-shell">
        <div className="test-toolbar">
          <div className="test-filter">
            <span>Script</span>
            <div role="group" aria-label="Kana script">
              <button disabled={submitting} className={script === "hiragana" ? "active" : ""} onClick={() => changeScript("hiragana")} aria-pressed={script === "hiragana"}>Hiragana</button>
              <button disabled={submitting} className={script === "katakana" ? "active" : ""} onClick={() => changeScript("katakana")} aria-pressed={script === "katakana"}>Katakana</button>
              <button disabled={submitting} className={script === "both" ? "active" : ""} onClick={() => changeScript("both")} aria-pressed={script === "both"}>Both</button>
            </div>
          </div>
          <div className="test-filter">
            <span>Test</span>
            <div role="group" aria-label="Test direction">
              <button disabled={submitting} className={direction === "recognition" ? "active" : ""} onClick={() => changeDirection("recognition")} aria-pressed={direction === "recognition"}><Keyboard size={14} />Recognition</button>
              <button disabled={submitting} className={direction === "recall" ? "active" : ""} onClick={() => changeDirection("recall")} aria-pressed={direction === "recall"}><Layers3 size={14} />Recall</button>
              <button disabled={submitting} className={direction === "mixed" ? "active" : ""} onClick={() => changeDirection("mixed")} aria-pressed={direction === "mixed"}>Mixed</button>
            </div>
          </div>
          <div className="test-counts" aria-live="polite">
            <span><strong>{queueResult.dueCount}</strong> due</span>
            <span><strong>{queueResult.newCount}</strong> new</span>
            {!isGuest && cloudPending && <span>Syncing…</span>}
          </div>
        </div>

        {queueNotice && <p className="queue-notice" role="status">{queueNotice}</p>}

        <div className="test-stage" aria-busy={showLoading || submitting}>
          {showLoading ? (
            <div className="test-empty"><RotateCcw size={28} /><h2>Loading your schedule…</h2><p>Koto is checking the server time and your saved review cards.</p></div>
          ) : queueError && queue.length === 0 ? (
            <div className="test-empty"><CircleAlert size={30} /><h2>Practice could not load</h2><p>{queueError}</p><button className="button primary" type="button" onClick={() => void refreshCloudQueue()}>Try again</button></div>
          ) : activeCard && item ? (
            <>
              <div className="test-card-meta"><span>{activeDirection === "recognition" ? "Kana → rōmaji" : "Rōmaji → kana"}</span><span>{strengthLabel(activeCard)} · {queue.length} remaining</span></div>
              <div className="test-prompt"><p>{activeDirection === "recognition" ? "Type the reading" : "Choose the kana"}</p><strong lang={activeDirection === "recognition" ? "ja" : "en"}>{activeDirection === "recognition" ? item.kana : item.romaji}</strong>{recallHint && <small className="recall-hint">{recallHint}</small>}{activeDirection === "recall" && <TtsButton text={item.kana} label="Hear the target sound" />}</div>

              {activeDirection === "recognition" ? (
                <form className="test-answer" onSubmit={submitTyped}><label htmlFor="test-romaji-answer">Rōmaji answer</label><div><input id="test-romaji-answer" value={typedAnswer} onChange={(event) => setTypedAnswer(event.target.value)} placeholder="Type rōmaji" autoComplete="off" autoCapitalize="none" disabled={Boolean(feedback) || submitting} autoFocus /><button type="submit" disabled={!typedAnswer.trim() || Boolean(feedback) || submitting}>Check</button></div></form>
              ) : (
                <div className="test-kana-grid">{gridKana.map((kana) => <button type="button" key={kana} onClick={() => selectKana(kana)} disabled={Boolean(feedback) || submitting} lang="ja">{kana}</button>)}</div>
              )}

              {queueError && <p className="form-error" role="alert">{queueError}</p>}
              {feedback && <div className={feedback.correct ? "test-feedback correct" : "test-feedback incorrect"} aria-live="polite"><div><span>{feedback.correct ? <Check size={18} /> : "×"}</span><p><strong>{feedback.correct ? "Correct" : "Incorrect"}</strong><small><b lang="ja">{item.kana}</b> is <b>{item.romaji}</b></small></p><TtsButton text={item.kana} /></div>{feedback.correct ? <div className="test-ratings"><span>{submitting ? "Saving…" : saveChoice === null ? "Rate this answer" : "Try saving again"}</span><button disabled={submitting || (saveChoice !== null && saveChoice !== Rating.Hard)} onClick={() => void advance(Rating.Hard)}>Hard</button><button disabled={submitting || (saveChoice !== null && saveChoice !== Rating.Good)} className="recommended" onClick={() => void advance(Rating.Good)}>Good</button><button disabled={submitting || (saveChoice !== null && saveChoice !== Rating.Easy)} onClick={() => void advance(Rating.Easy)}>Easy</button></div> : <button disabled={submitting} className="button primary full" onClick={() => void advance()}>{submitting ? "Saving…" : saveChoice === "again" ? "Try saving again" : "Continue"} <ArrowRight size={15} /></button>}</div>}
            </>
          ) : (
            <div className="test-empty">{availableCards.length ? <><Check size={30} /><h2>Nothing due here</h2><p>Switch the script or test direction, or return when the next card is due.</p></> : <><RotateCcw size={28} /><h2>No kana available</h2><p>Learn a kana group before testing this direction.</p><Link className="button primary" href="/kana">Go to kana learning <ArrowRight size={15} /></Link></>}</div>
          )}
        </div>

        <footer className="test-session"><span>Session</span><strong>{answered}</strong><small>answered</small><strong>{correctCount}</strong><small>correct</small></footer>
      </section>
    </main>
  );
}
