"use client";

import Link from "next/link";
import { useProgress } from "@/app/providers";
import { TtsButton } from "@/components/tts-button";
import { VoiceInput } from "@/components/voice-input";
import { Direction, KanaScript, findKanaItem, isRomajiAnswer, kanaGroups, seededShuffle } from "@/lib/kana";
import { StoredCard, buildReviewQueue, dueReviewCards } from "@/lib/progress";
import { ArrowRight, Check, Keyboard, Layers3, RotateCcw } from "lucide-react";
import { Rating } from "ts-fsrs";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toRomaji } from "wanakana";

type Feedback = { correct: boolean; submitted: string; inputMode: "typed" | "voice" | "grid"; heard?: string };

function voiceMatches(expectedKana: string, expectedRomaji: string, transcript: string) {
  const compact = transcript.replace(/[\s。、,.!?！？]/g, "");
  return compact.includes(expectedKana) || toRomaji(compact).toLowerCase().replace(/[^a-z]/g, "") === expectedRomaji;
}

export function PracticeView() {
  const { progress, reviewCard } = useProgress();
  const [script, setScript] = useState<KanaScript>("hiragana");
  const [direction, setDirection] = useState<Direction>("recognition");
  const [activeCard, setActiveCard] = useState<StoredCard | null>(null);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [voiceRetry, setVoiceRetry] = useState(0);
  const [voiceNote, setVoiceNote] = useState("");
  const [shuffleAttempt, setShuffleAttempt] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  const queue = useMemo(() => buildReviewQueue(progress, script, direction), [progress, script, direction]);
  const scriptItemIds = useMemo(() => new Set(kanaGroups.filter((group) => group.script === script).flatMap((group) => group.items.map((item) => item.id))), [script]);
  const unlocked = useMemo(() => Object.values(progress.cards).filter((card) => card.direction === direction && scriptItemIds.has(card.itemId)), [progress.cards, direction, scriptItemIds]);
  const dueCount = useMemo(() => dueReviewCards(progress).filter((card) => card.direction === direction && scriptItemIds.has(card.itemId)).length, [progress, direction, scriptItemIds]);
  const newCount = queue.filter((card) => card.reps === 0).length;

  useEffect(() => {
    if (activeCard && queue.some((card) => card === activeCard)) return;
    setActiveCard(queue[0] ?? null);
  }, [queue, activeCard]);

  function changeScript(next: KanaScript) {
    setScript(next);
    resetCard();
  }

  function changeDirection(next: Direction) {
    setDirection(next);
    resetCard();
  }

  function resetCard() {
    setActiveCard(null);
    setFeedback(null);
    setTypedAnswer("");
    setVoiceRetry(0);
    setVoiceNote("");
  }

  const item = activeCard ? findKanaItem(activeCard.itemId) : undefined;

  function submitTyped(event: FormEvent) {
    event.preventDefault();
    if (!item || !typedAnswer.trim() || feedback) return;
    setFeedback({ correct: isRomajiAnswer(item, typedAnswer), submitted: typedAnswer, inputMode: "typed" });
  }

  function selectKana(kana: string) {
    if (!item || feedback) return;
    setFeedback({ correct: kana === item.kana, submitted: kana, inputMode: "grid" });
  }

  function handleVoice(transcript: string) {
    if (!item || feedback) return;
    const correct = voiceMatches(item.kana, item.romaji, transcript);
    if (!correct && voiceRetry === 0) {
      setVoiceRetry(1);
      setVoiceNote(`I heard “${transcript}”. Try once more, or type your answer.`);
      return;
    }
    setVoiceNote("");
    setFeedback({ correct, submitted: transcript, inputMode: "voice", heard: transcript });
  }

  function advance(rating?: Rating) {
    if (!activeCard || !feedback) return;
    reviewCard(activeCard.itemId, activeCard.direction, feedback.submitted, feedback.correct, rating, feedback.inputMode);
    setAnswered((count) => count + 1);
    if (feedback.correct) setCorrectCount((count) => count + 1);
    setShuffleAttempt((attempt) => attempt + 1);
    resetCard();
  }

  const gridKana = useMemo(() => {
    if (!item) return [];
    const choices = Array.from(new Set([item.kana, ...unlocked.map((card) => findKanaItem(card.itemId)?.kana).filter((kana): kana is string => Boolean(kana))]));
    return seededShuffle(choices, `${item.id}-${shuffleAttempt}-test-grid`).slice(0, 15);
  }, [item, unlocked, shuffleAttempt]);

  return (
    <main className="test-page page-shell">
      <header className="test-header">
        <div><span className="eyebrow">Scheduled practice</span><h1>Kana test</h1><p>Review due kana and introduce up to ten new cards each day.</p></div>
        <Link href="/kana">Open kana learning <ArrowRight size={15} /></Link>
      </header>

      <section className="test-shell">
        <div className="test-toolbar">
          <div className="test-filter"><span>Script</span><div role="group" aria-label="Kana script"><button className={script === "hiragana" ? "active" : ""} onClick={() => changeScript("hiragana")}>Hiragana</button><button className={script === "katakana" ? "active" : ""} onClick={() => changeScript("katakana")}>Katakana</button></div></div>
          <div className="test-filter"><span>Test</span><div role="group" aria-label="Test direction"><button className={direction === "recognition" ? "active" : ""} onClick={() => changeDirection("recognition")}><Keyboard size={14} />Recognition</button><button className={direction === "recall" ? "active" : ""} onClick={() => changeDirection("recall")}><Layers3 size={14} />Recall</button></div></div>
          <div className="test-counts"><span><strong>{dueCount}</strong> due</span><span><strong>{newCount}</strong> new</span></div>
        </div>

        <div className="test-stage">
          {activeCard && item ? (
            <>
              <div className="test-card-meta"><span>{direction === "recognition" ? "Kana → rōmaji" : "Rōmaji → kana"}</span><span>{queue.length} remaining</span></div>
              <div className="test-prompt"><p>{direction === "recognition" ? "Type the reading" : "Choose the kana"}</p><strong lang={direction === "recognition" ? "ja" : "en"}>{direction === "recognition" ? item.kana : item.romaji}</strong>{direction === "recall" && <TtsButton text={item.kana} label="Hear the target sound" />}</div>

              {direction === "recognition" ? (
                <form className="test-answer" onSubmit={submitTyped}><label htmlFor="test-romaji-answer">Rōmaji answer</label><div><input id="test-romaji-answer" value={typedAnswer} onChange={(event) => setTypedAnswer(event.target.value)} placeholder="Type rōmaji" autoComplete="off" autoCapitalize="none" disabled={Boolean(feedback)} autoFocus /><button type="submit" disabled={!typedAnswer.trim() || Boolean(feedback)}>Check</button></div><span>or</span><VoiceInput onTranscript={handleVoice} disabled={Boolean(feedback)} />{voiceNote && <p className="voice-note">{voiceNote}</p>}</form>
              ) : (
                <div className="test-kana-grid">{gridKana.map((kana) => <button type="button" key={kana} onClick={() => selectKana(kana)} disabled={Boolean(feedback)} lang="ja">{kana}</button>)}</div>
              )}

              {feedback && <div className={feedback.correct ? "test-feedback correct" : "test-feedback incorrect"} aria-live="polite"><div><span>{feedback.correct ? <Check size={18} /> : "×"}</span><p><strong>{feedback.correct ? "Correct" : "Incorrect"}</strong><small><b lang="ja">{item.kana}</b> is <b>{item.romaji}</b>{feedback.heard ? ` · heard “${feedback.heard}”` : ""}</small></p><TtsButton text={item.kana} /></div>{feedback.correct ? <div className="test-ratings"><span>Rate this answer</span><button onClick={() => advance(Rating.Hard)}>Hard</button><button className="recommended" onClick={() => advance(Rating.Good)}>Good</button><button onClick={() => advance(Rating.Easy)}>Easy</button></div> : <button className="button primary full" onClick={() => advance()}>Continue <ArrowRight size={15} /></button>}</div>}
              {direction === "recognition" && <p className="voice-disclaimer">Voice input checks the browser transcript, not pronunciation quality.</p>}
            </>
          ) : (
            <div className="test-empty">{unlocked.length ? <><Check size={30} /><h2>Nothing due here</h2><p>Switch the script or test direction, or return when the next card is due.</p></> : <><RotateCcw size={28} /><h2>No kana available</h2><p>Learn a kana group before testing this direction.</p><Link className="button primary" href="/kana">Go to kana learning <ArrowRight size={15} /></Link></>}</div>
          )}
        </div>

        <footer className="test-session"><span>Session</span><strong>{answered}</strong><small>answered</small><strong>{correctCount}</strong><small>correct</small></footer>
      </section>
    </main>
  );
}
