"use client";

import { useProgress } from "@/app/providers";
import { TtsButton } from "@/components/tts-button";
import { VoiceInput } from "@/components/voice-input";
import { Direction, KanaGroup, findKanaItem, isRomajiAnswer, kanaGroups, kanaItems, seededShuffle } from "@/lib/kana";
import { StoredCard, buildLearningQueue, groupDirectionIsProficient, groupIsAvailable, groupIsProficient } from "@/lib/progress";
import { ArrowRight, Check, CircleAlert, Keyboard, Layers3, Lock } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toRomaji } from "wanakana";

type Feedback = { correct: boolean; submitted: string; inputMode: "typed" | "voice" | "grid"; heard?: string };

function voiceMatches(expectedKana: string, expectedRomaji: string, transcript: string) {
  const compact = transcript.replace(/[\s。、,.!?！？]/g, "");
  return compact.includes(expectedKana) || toRomaji(compact).toLowerCase().replace(/[^a-z]/g, "") === expectedRomaji;
}

export function KanaLearningView() {
  const { progress, startGroup, startRecall, recordLearningAnswer } = useProgress();
  const [selectedGroupId, setSelectedGroupId] = useState("h-vowels");
  const [studied, setStudied] = useState(false);
  const [activeCard, setActiveCard] = useState<StoredCard | null>(null);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [voiceRetry, setVoiceRetry] = useState(0);
  const [voiceNote, setVoiceNote] = useState("");
  const [shuffleAttempt, setShuffleAttempt] = useState(0);
  const [manualQueue, setManualQueue] = useState<string[]>([]);
  const [showStudy, setShowStudy] = useState(false);

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
  const queue = manualQueue.length ? manualCards : learningQueue;

  useEffect(() => {
    if (activeCard && progress.cards[`${activeCard.itemId}:${activeCard.direction}`] === activeCard) return;
    setActiveCard(queue[0] ?? null);
  }, [queue, activeCard, progress.cards]);

  function chooseGroup(group: KanaGroup) {
    setSelectedGroupId(group.id);
    setStudied(false);
    setFeedback(null);
    setActiveCard(null);
    setManualQueue([]);
    setShowStudy(false);
  }

  function beginGroup() {
    startGroup(selectedGroup);
    setStudied(true);
  }

  function beginRecall() {
    startRecall(selectedGroup);
    setStudied(true);
    setFeedback(null);
    setActiveCard(null);
  }

  function repeatStage(direction: Direction) {
    const keys = selectedGroup.items.map((item) => `${item.id}:${direction}`);
    setManualQueue(seededShuffle(keys, `${selectedGroup.id}-${direction}-${Date.now()}`));
    setStudied(true);
    setShowStudy(false);
    setFeedback(null);
    setActiveCard(null);
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

  function advance() {
    if (!activeCard || !feedback) return;
    recordLearningAnswer(activeCard.itemId, activeCard.direction, feedback.submitted, feedback.correct, feedback.inputMode);
    setManualQueue((current) => current.filter((key) => key !== `${activeCard.itemId}:${activeCard.direction}`));
    setShuffleAttempt((current) => current + 1);
    setFeedback(null);
    setTypedAnswer("");
    setVoiceRetry(0);
    setVoiceNote("");
    setActiveCard(null);
  }

  const gridKana = useMemo(() => {
    if (!item) return [];
    const unlocked = kanaItems.filter((candidate) => candidate.script === item.script && progress.startedGroups.includes(candidate.groupId));
    return seededShuffle(Array.from(new Set([item.kana, ...unlocked.map((candidate) => candidate.kana)])), `${item.id}-${shuffleAttempt}-learning-grid`).slice(0, 15);
  }, [item, progress.startedGroups, shuffleAttempt]);

  return (
    <main className="practice-page kana-learning-page">
      <header className="practice-header page-shell">
        <div><span className="eyebrow">Kana path</span><h1>Learn kana</h1></div>
        <p>Study one group at a time. Learn to recognise the kana first, then practise recalling it from rōmaji.</p>
      </header>

      <div className="practice-layout page-shell">
        <aside className="group-sidebar">
          <div className="script-toggle"><button className={selectedGroup.script === "hiragana" ? "active" : ""} onClick={() => chooseGroup(kanaGroups.find((group) => group.script === "hiragana" && groupIsAvailable(progress, group) && !groupIsProficient(progress, group)) ?? kanaGroups[0])}>Hiragana</button><button className={selectedGroup.script === "katakana" ? "active" : ""} onClick={() => chooseGroup(kanaGroups.find((group) => group.script === "katakana" && groupIsAvailable(progress, group) && !groupIsProficient(progress, group)) ?? kanaGroups.find((group) => group.script === "katakana")!)}>Katakana</button></div>
          <p className="sidebar-label">Groups</p>
          <div className="group-list">
            {availableGroups.map((group, index) => {
              const available = groupIsAvailable(progress, group);
              const complete = groupIsProficient(progress, group);
              const recognised = groupDirectionIsProficient(progress, group, "recognition");
              const stage = complete ? "Complete" : recognised ? "Recall" : progress.startedGroups.includes(group.id) ? "Recognition" : group.eyebrow;
              return <button key={group.id} onClick={() => available && chooseGroup(group)} disabled={!available} className={group.id === selectedGroup.id ? "active" : ""}><span>{complete ? <Check size={14} /> : available ? String(index + 1).padStart(2, "0") : <Lock size={13} />}</span><div><strong>{group.label}</strong><small>{stage}</small></div></button>;
            })}
          </div>
        </aside>

        <section className="trainer-panel">
          {selectedAvailable && <PhaseSteps recognitionComplete={recognitionComplete} recallStarted={recallStarted} completed={selectedProficient} />}
          {!selectedAvailable ? (
            <div className="empty-trainer"><Lock size={28} /><h2>Complete the previous group first</h2><p>This group unlocks after recognition and recall are complete.</p></div>
          ) : showStudy || !selectedStarted || (!studied && !selectedProficient && !recognitionComplete) ? (
            <StudyGroup group={selectedGroup} onBegin={selectedProficient ? () => repeatStage("recognition") : beginGroup} started={selectedStarted} completed={selectedProficient} />
          ) : selectedProficient && !activeCard && manualQueue.length === 0 ? (
            <div className="empty-trainer celebration"><Check size={32} /><h2>{selectedGroup.label} complete</h2><p>Practise either direction again, or continue to the next group.</p><div className="redo-actions"><button onClick={() => setShowStudy(true)}>Study the group</button><button onClick={() => repeatStage("recognition")}>Practise recognition</button><button onClick={() => repeatStage("recall")}>Practise recall</button></div><button className="button primary" onClick={() => { const index = availableGroups.findIndex((group) => group.id === selectedGroup.id); const next = availableGroups[index + 1]; if (next) chooseGroup(next); }}>Next group <ArrowRight size={16} /></button></div>
          ) : recognitionComplete && !recallStarted && !activeCard && manualQueue.length === 0 ? (
            <div className="empty-trainer stage-transition"><Check size={32} /><span className="eyebrow">Recognition complete</span><h2>Start recall</h2><p>You will now see rōmaji and choose the matching kana.</p><div className="transition-actions"><button className="button secondary" onClick={() => repeatStage("recognition")}>Practise recognition</button><button className="button primary" onClick={beginRecall}>Start recall <ArrowRight size={16} /></button></div></div>
          ) : (
            <LearningCard card={activeCard} item={item} feedback={feedback} typedAnswer={typedAnswer} setTypedAnswer={setTypedAnswer} onSubmit={submitTyped} onSelectKana={selectKana} gridKana={gridKana} onVoice={handleVoice} voiceNote={voiceNote} onAdvance={advance} remaining={queue.length} />
          )}
        </section>
      </div>
    </main>
  );
}

function StudyGroup({ group, onBegin, started, completed = false }: { group: KanaGroup; onBegin: () => void; started: boolean; completed?: boolean }) {
  return (
    <div className="study-group">
      <span className="eyebrow">{group.eyebrow}</span><h2>{group.label}</h2>
      <p>Look over the characters and listen to each sound before practising recognition.</p>
      <div className="kana-study-grid">
        {group.items.map((item) => <div key={item.id}><strong lang="ja">{item.kana}</strong><span>{item.romaji}</span><TtsButton text={item.kana} label={`Listen to ${item.romaji}`} /></div>)}
      </div>
      {group.note && <div className="inline-note"><CircleAlert size={17} />{group.note}</div>}
      <div className="study-actions"><div><Keyboard size={18} /><span>Recognition · kana → rōmaji<br /><small>Recall unlocks after this stage.</small></span></div><button className="button primary" onClick={onBegin}>{completed ? "Practise recognition" : started ? "Continue recognition" : "Start recognition"}<ArrowRight size={16} /></button></div>
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
  onVoice: (transcript: string) => void;
  voiceNote: string;
  onAdvance: () => void;
  remaining: number;
};

function LearningCard({ card, item, feedback, typedAnswer, setTypedAnswer, onSubmit, onSelectKana, gridKana, onVoice, voiceNote, onAdvance, remaining }: LearningCardProps) {
  if (!card || !item) return <div className="empty-trainer"><h2>Preparing the next kana…</h2></div>;
  const recognition = card.direction === "recognition";
  return (
    <div className="trainer-card learning-card">
      <div className="trainer-meta"><span className={`direction-pill ${recognition ? "recognition" : "recall"}`}>{recognition ? <Keyboard size={14} /> : <Layers3 size={14} />}{recognition ? "Recognition" : "Recall"}</span><span>{remaining} remaining</span></div>
      <div className="trainer-prompt"><p>{recognition ? "How do you read this?" : "Choose the matching kana"}</p><strong lang={recognition ? "ja" : "en"}>{recognition ? item.kana : item.romaji}</strong>{!recognition && <TtsButton text={item.kana} label="Hear the target sound" />}</div>
      {recognition ? (
        <form className="answer-form" onSubmit={onSubmit}><label htmlFor="learning-romaji-answer">Type rōmaji</label><div><input id="learning-romaji-answer" value={typedAnswer} onChange={(event) => setTypedAnswer(event.target.value)} placeholder="Your answer" autoComplete="off" autoCapitalize="none" disabled={Boolean(feedback)} autoFocus /><button type="submit" disabled={!typedAnswer.trim() || Boolean(feedback)}>Check</button></div><span className="answer-or">or</span><VoiceInput onTranscript={onVoice} disabled={Boolean(feedback)} />{voiceNote && <p className="voice-note">{voiceNote}</p>}</form>
      ) : (
        <div className="kana-choice-grid">{gridKana.map((kana) => <button type="button" key={kana} onClick={() => onSelectKana(kana)} disabled={Boolean(feedback)} lang="ja">{kana}</button>)}</div>
      )}
      {feedback && <div className={feedback.correct ? "answer-feedback correct" : "answer-feedback incorrect"} aria-live="polite"><div className="feedback-result"><span>{feedback.correct ? <Check size={19} /> : "×"}</span><div><strong>{feedback.correct ? "Correct" : "Try this one again later"}</strong><p><b lang="ja">{item.kana}</b> is <b>{item.romaji}</b>{feedback.heard ? ` · heard “${feedback.heard}”` : ""}</p></div><TtsButton text={item.kana} /></div><button className="button primary full" onClick={onAdvance}>Continue <ArrowRight size={16} /></button></div>}
      {recognition && <p className="voice-disclaimer">Voice input checks the browser transcript, not pronunciation quality.</p>}
    </div>
  );
}
