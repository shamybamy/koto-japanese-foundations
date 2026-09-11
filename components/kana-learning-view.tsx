"use client";

import { useProgress } from "@/app/providers";
import { TtsButton } from "@/components/tts-button";
import { Direction, KanaGroup, findKanaItem, isRomajiAnswer, kanaGroups, kanaItems, recallDisambiguation, seededShuffle } from "@/lib/kana";
import { StoredCard, buildLearningQueue, buildLearningRounds, groupDirectionIsProficient, groupIsAvailable, groupIsProficient } from "@/lib/progress";
import { ArrowRight, Check, CircleAlert, Keyboard, Layers3, Lock } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Feedback = { correct: boolean; submitted: string; inputMode: "typed" | "grid" };

export function KanaLearningView() {
  const { progress, startGroup, startRecall, recordLearningAnswer, authReady } = useProgress();
  const [selectedGroupId, setSelectedGroupId] = useState("h-vowels");
  const [studied, setStudied] = useState(false);
  const [activeCard, setActiveCard] = useState<StoredCard | null>(null);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [shuffleAttempt, setShuffleAttempt] = useState(0);
  const [manualQueue, setManualQueue] = useState<string[]>([]);
  const [mixedReviewQueue, setMixedReviewQueue] = useState<string[]>([]);
  const [showStudy, setShowStudy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const selectedGroup = kanaGroups.find((group) => group.id === selectedGroupId) ?? kanaGroups[0];
  const availableGroups = kanaGroups.filter((group) => group.script === selectedGroup.script);
  const selectedAvailable = groupIsAvailable(progress, selectedGroup);
  const selectedStarted = progress.startedGroups.includes(selectedGroup.id);
  const selectedProficient = groupIsProficient(progress, selectedGroup);
  const recognitionComplete = groupDirectionIsProficient(progress, selectedGroup, "recognition");
  const recallStarted = (progress.recallStartedGroups ?? []).includes(selectedGroup.id) || selectedProficient;
  const learningDirection: Direction = recognitionComplete && recallStarted ? "recall" : "recognition";
  const learningQueue = useMemo(
    () => selectedStarted ? buildLearningQueue(progress, selectedGroup, learningDirection) : [],
    [progress, selectedGroup, selectedStarted, learningDirection],
  );
  const manualCards = useMemo(() => manualQueue.map((key) => progress.cards[key]).filter((card): card is StoredCard => Boolean(card)), [manualQueue, progress.cards]);
  const mixedReviewCards = useMemo(() => mixedReviewQueue.map((key) => progress.cards[key]).filter((card): card is StoredCard => Boolean(card)), [mixedReviewQueue, progress.cards]);
  const queueSource = manualQueue.length ? "first-pass" : mixedReviewQueue.length ? "mixed-review" : "learning";
  const queue = queueSource === "first-pass" ? manualCards : queueSource === "mixed-review" ? mixedReviewCards : learningQueue;

  useEffect(() => {
    if (activeCard && progress.cards[`${activeCard.itemId}:${activeCard.direction}`] === activeCard) return;
    setActiveCard(queue[0] ?? null);
  }, [queue, activeCard, progress.cards]);

  function chooseGroup(group: KanaGroup) {
    if (submitting) return;
    setSelectedGroupId(group.id);
    setStudied(false);
    setFeedback(null);
    setActiveCard(null);
    setManualQueue([]);
    setMixedReviewQueue([]);
    setShowStudy(false);
    setSaveFailed(false);
  }

  function prepareLearningPractice(direction: Direction) {
    const rounds = buildLearningRounds(progress, selectedGroup, direction, `${selectedGroup.id}-${direction}-${Date.now()}`);
    setManualQueue(rounds.firstPass);
    setMixedReviewQueue(rounds.mixedReview);
  }

  async function beginGroup() {
    if (submitting) return;
    setSubmitting(true);
    const started = await startGroup(selectedGroup);
    if (started) {
      prepareLearningPractice("recognition");
      setStudied(true);
    }
    setSubmitting(false);
  }

  async function beginRecall() {
    if (submitting) return;
    setSubmitting(true);
    const started = await startRecall(selectedGroup);
    if (started) {
      prepareLearningPractice("recall");
      setStudied(true);
      setFeedback(null);
      setActiveCard(null);
    }
    setSubmitting(false);
  }

  async function repeatStage(direction: Direction) {
    if (submitting) return;
    if (direction === "recognition") {
      prepareLearningPractice("recognition");
    } else {
      setSubmitting(true);
      const recallReady = await startRecall(selectedGroup);
      if (!recallReady) {
        setSubmitting(false);
        return;
      }
      prepareLearningPractice("recall");
      setSubmitting(false);
    }
    setStudied(true);
    setShowStudy(false);
    setFeedback(null);
    setActiveCard(null);
    setSaveFailed(false);
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

  async function advance() {
    if (!activeCard || !feedback || submitting) return;
    setSubmitting(true);
    setSaveFailed(false);
    const answeredCard = activeCard;
    const result = await recordLearningAnswer(answeredCard.itemId, answeredCard.direction, feedback.submitted, feedback.correct, feedback.inputMode);
    if (!result) {
      setSaveFailed(true);
      setSubmitting(false);
      return;
    }
    if (queueSource === "first-pass") setManualQueue((current) => current.slice(1));
    if (queueSource === "mixed-review") setMixedReviewQueue((current) => current.slice(1));
    setShuffleAttempt((current) => current + 1);
    setFeedback(null);
    setTypedAnswer("");
    setActiveCard(null);
    setSubmitting(false);
  }

  const gridKana = useMemo(() => {
    if (!item) return [];
    const unlocked = kanaItems.filter((candidate) => candidate.script === item.script && progress.startedGroups.includes(candidate.groupId));
    const distractors = Array.from(new Set(unlocked.map((candidate) => candidate.kana))).filter((kana) => kana !== item.kana);
    const selected = seededShuffle(distractors, `${item.id}-${shuffleAttempt}-learning-distractors`).slice(0, 4);
    return seededShuffle([item.kana, ...selected], `${item.id}-${shuffleAttempt}-learning-grid`);
  }, [item, progress.startedGroups, shuffleAttempt]);

  if (!authReady) {
    return (
      <main className="practice-page kana-learning-page" aria-busy="true">
        <header className="practice-header page-shell">
          <div><span className="eyebrow">Kana path</span><h1>Learn kana</h1></div>
          <p>Study one group at a time. Learn to recognise the kana first, then practise recalling it from rōmaji.</p>
        </header>
        <div className="page-shell"><div className="empty-trainer" role="status"><h2>Restoring your kana progress…</h2><p>Practice will be ready after Koto restores your session.</p></div></div>
      </main>
    );
  }

  return (
    <main className="practice-page kana-learning-page">
      <header className="practice-header page-shell">
        <div><span className="eyebrow">Kana path</span><h1>Learn kana</h1></div>
        <p>Study one group at a time. Learn to recognise the kana first, then practise recalling it from rōmaji.</p>
      </header>

      <div className="practice-layout page-shell">
        <aside className="group-sidebar">
          <div className="script-toggle"><button disabled={submitting} className={selectedGroup.script === "hiragana" ? "active" : ""} onClick={() => chooseGroup(kanaGroups.find((group) => group.script === "hiragana" && groupIsAvailable(progress, group) && !groupIsProficient(progress, group)) ?? kanaGroups[0])}>Hiragana</button><button disabled={submitting} className={selectedGroup.script === "katakana" ? "active" : ""} onClick={() => chooseGroup(kanaGroups.find((group) => group.script === "katakana" && groupIsAvailable(progress, group) && !groupIsProficient(progress, group)) ?? kanaGroups.find((group) => group.script === "katakana")!)}>Katakana</button></div>
          <p className="sidebar-label">Groups</p>
          <div className="group-list">
            {availableGroups.map((group, index) => {
              const available = groupIsAvailable(progress, group);
              const complete = groupIsProficient(progress, group);
              const recognised = groupDirectionIsProficient(progress, group, "recognition");
              const stage = complete ? "Complete" : recognised ? "Recall" : progress.startedGroups.includes(group.id) ? "Recognition" : null;
              return <button key={group.id} onClick={() => available && chooseGroup(group)} disabled={!available || submitting} className={group.id === selectedGroup.id ? "active" : ""}><span>{complete ? <Check size={14} /> : available ? String(index + 1).padStart(2, "0") : <Lock size={13} />}</span><div><strong>{group.label}</strong>{stage && <small>{stage}</small>}</div></button>;
            })}
          </div>
        </aside>

        <section className="trainer-panel" aria-busy={submitting}>
          {selectedAvailable && <PhaseSteps recognitionComplete={recognitionComplete} recallStarted={recallStarted} completed={selectedProficient} />}
          {!selectedAvailable ? (
            <div className="empty-trainer"><Lock size={28} /><h2>Complete the previous group first</h2><p>This group unlocks after recognition and recall are complete.</p></div>
          ) : showStudy || !selectedStarted || (!studied && !selectedProficient && !recognitionComplete) ? (
            <StudyGroup group={selectedGroup} onBegin={selectedProficient ? () => void repeatStage("recognition") : () => void beginGroup()} started={selectedStarted} completed={selectedProficient} submitting={submitting} />
          ) : selectedProficient && !activeCard && manualQueue.length === 0 && mixedReviewQueue.length === 0 ? (
            <div className="empty-trainer celebration"><Check size={32} /><h2>{selectedGroup.label} complete</h2><p>Practise either direction again, or continue to the next group.</p><div className="redo-actions"><button disabled={submitting} onClick={() => setShowStudy(true)}>Study the group</button><button disabled={submitting} onClick={() => void repeatStage("recognition")}>Practise recognition</button><button disabled={submitting} onClick={() => void repeatStage("recall")}>Practise recall</button></div><button disabled={submitting} className="button primary" onClick={() => { const index = availableGroups.findIndex((group) => group.id === selectedGroup.id); const next = availableGroups[index + 1]; if (next) chooseGroup(next); }}>Next group <ArrowRight size={16} /></button></div>
          ) : recognitionComplete && !recallStarted && !activeCard && manualQueue.length === 0 && mixedReviewQueue.length === 0 ? (
            <div className="empty-trainer stage-transition"><Check size={32} /><span className="eyebrow">Recognition complete</span><h2>Start recall</h2><p>You will now see rōmaji and choose the matching kana.</p><div className="transition-actions"><button disabled={submitting} className="button secondary" onClick={() => void repeatStage("recognition")}>Practise recognition</button><button disabled={submitting} className="button primary" onClick={() => void beginRecall()}>{submitting ? "Starting…" : "Start recall"} <ArrowRight size={16} /></button></div></div>
          ) : (
            <LearningCard card={activeCard} item={item} feedback={feedback} typedAnswer={typedAnswer} setTypedAnswer={setTypedAnswer} onSubmit={submitTyped} onSelectKana={selectKana} gridKana={gridKana} onAdvance={() => void advance()} remaining={queue.length} learningRound={queueSource} submitting={submitting} saveFailed={saveFailed} />
          )}
        </section>
      </div>
    </main>
  );
}

function StudyGroup({ group, onBegin, started, completed = false, submitting }: { group: KanaGroup; onBegin: () => void; started: boolean; completed?: boolean; submitting: boolean }) {
  return (
    <div className="study-group">
      <h2>{group.label}</h2>
      <p>Look over the characters and listen to each sound before practising recognition.</p>
      <div className="kana-study-grid">
        {group.items.map((item) => <div key={item.id}><strong lang="ja">{item.kana}</strong><span>{item.romaji}</span><TtsButton text={item.kana} label={`Listen to ${item.romaji}`} /></div>)}
      </div>
      {group.note && <div className="inline-note"><CircleAlert size={17} />{group.note}</div>}
      <div className="study-actions"><div><Keyboard size={18} /><span>Recognition · kana → rōmaji<br /><small>Recall unlocks after this stage.</small></span></div><button disabled={submitting} className="button primary" onClick={onBegin}>{submitting ? "Starting…" : completed ? "Practise recognition" : started ? "Continue recognition" : "Start recognition"}<ArrowRight size={16} /></button></div>
    </div>
  );
}

function PhaseSteps({ recognitionComplete, recallStarted, completed }: { recognitionComplete: boolean; recallStarted: boolean; completed: boolean }) {
  return (
    <div className="phase-steps" aria-label="Kana learning stages">
      <div className={recognitionComplete ? "complete" : "active"}><span>{recognitionComplete ? <Check size={14} /> : "1"}</span><p><strong>Recognition</strong><small>Kana → rōmaji</small></p></div>
      <ArrowRight size={15} aria-hidden="true" />
      <div className={completed ? "complete" : recallStarted ? "active" : "locked"}><span>{completed ? <Check size={14} /> : recallStarted ? "2" : <Lock size={12} />}</span><p><strong>Recall</strong><small>Rōmaji → kana</small></p></div>
    </div>
  );
}

type LearningCardProps = {
  card: StoredCard | null;
  item: ReturnType<typeof findKanaItem> | undefined;
  feedback: Feedback | null;
  typedAnswer: string;
  setTypedAnswer: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  onSelectKana: (kana: string) => void;
  gridKana: string[];
  onAdvance: () => void;
  remaining: number;
  learningRound: "first-pass" | "mixed-review" | "learning";
  submitting: boolean;
  saveFailed: boolean;
};

function LearningCard({ card, item, feedback, typedAnswer, setTypedAnswer, onSubmit, onSelectKana, gridKana, onAdvance, remaining, learningRound, submitting, saveFailed }: LearningCardProps) {
  if (!card || !item) return <div className="empty-trainer"><h2>Preparing the next kana…</h2></div>;
  const recognition = card.direction === "recognition";
  const recallHint = recognition ? undefined : recallDisambiguation(item);
  return (
    <div className="trainer-card learning-card">
      <div className="trainer-meta"><span className={`direction-pill ${recognition ? "recognition" : "recall"}`}>{recognition ? <Keyboard size={14} /> : <Layers3 size={14} />}{learningRound === "first-pass" ? `${recognition ? "Recognition" : "Recall"} · New row` : learningRound === "mixed-review" ? `${recognition ? "Recognition" : "Recall"} · Mixed review` : recognition ? "Recognition" : "Recall"}</span><span>{remaining} remaining</span></div>
      <div className="trainer-prompt"><p>{recognition ? "How do you read this?" : "Choose the matching kana"}</p><strong lang={recognition ? "ja" : "en"}>{recognition ? item.kana : item.romaji}</strong>{recallHint && <small className="recall-hint">{recallHint}</small>}{!recognition && <TtsButton text={item.kana} label="Hear the target sound" />}</div>
      {recognition ? (
        <form className="answer-form" onSubmit={onSubmit}><label htmlFor="learning-romaji-answer">Type rōmaji</label><div><input id="learning-romaji-answer" value={typedAnswer} onChange={(event) => setTypedAnswer(event.target.value)} placeholder="Your answer" autoComplete="off" autoCapitalize="none" disabled={Boolean(feedback) || submitting} autoFocus /><button type="submit" disabled={!typedAnswer.trim() || Boolean(feedback) || submitting}>Check</button></div></form>
      ) : (
        <div className="kana-choice-grid">{gridKana.map((kana) => <button type="button" key={kana} onClick={() => onSelectKana(kana)} disabled={Boolean(feedback) || submitting} lang="ja">{kana}</button>)}</div>
      )}
      {feedback && <div className={feedback.correct ? "answer-feedback correct" : "answer-feedback incorrect"} aria-live="polite"><div className="feedback-result"><span>{feedback.correct ? <Check size={19} /> : "×"}</span><div><strong>{feedback.correct ? "Correct" : "Try this one again later"}</strong><p><b lang="ja">{item.kana}</b> is <b>{item.romaji}</b></p></div><TtsButton text={item.kana} /></div><button disabled={submitting} className="button primary full" onClick={onAdvance}>{submitting ? "Saving…" : saveFailed ? "Try saving again" : "Continue"} <ArrowRight size={16} /></button></div>}
    </div>
  );
}
