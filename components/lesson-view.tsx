"use client";

import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, CircleAlert, Lock, Sparkles } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { Lesson, Track } from "@/lib/curriculum";
import { lessonUnlocked } from "@/lib/progress";
import { useProgress } from "@/app/providers";
import { TtsButton } from "@/components/tts-button";
import { PitchContour } from "@/components/pitch-contour";
import { MoraTapAlong } from "@/components/mora-tap-along";

export function LessonView({ track, lesson }: { track: Track; lesson: Lesson }) {
  const { progress, completeLesson, authReady } = useProgress();
  const lessonIndex = track.lessons.findIndex((candidate) => candidate.slug === lesson.slug);
  const unlocked = lessonUnlocked(progress, track.slug, lessonIndex, track.lessons.map((item) => item.slug));
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [score, setScore] = useState<number | null>(null);
  const [retainedAnswers, setRetainedAnswers] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const next = track.lessons[lessonIndex + 1];
  const previous = track.lessons[lessonIndex - 1];
  const pitchPatterns = useMemo(() => lesson.slug === "four-patterns" ? (["heiban", "atamadaka", "nakadaka", "odaka"] as const) : [], [lesson.slug]);

  async function grade(event: FormEvent) {
    event.preventDefault();
    if (!authReady || Object.keys(answers).length < lesson.quiz.length || submitting) return;
    const correct = lesson.quiz.filter((question, index) => answers[index] === question.answer).length;
    const localScore = Math.round((correct / lesson.quiz.length) * 100);
    setSubmitting(true);
    const result = await completeLesson(`${track.slug}/${lesson.slug}`, localScore, lesson.quiz.map((_, index) => answers[index]));
    if (result) setScore(result.score);
    setSubmitting(false);
  }

  if (!authReady) {
    return (
      <main className="page-shell locked-lesson" aria-busy="true">
        <span className="eyebrow">Restoring session</span><h1>Loading your lesson progress…</h1>
        <p>Koto will enable the lesson check after you sign-in.</p>
      </main>
    );
  }

  if (!unlocked) {
    return (
      <main className="page-shell locked-lesson">
        <Lock size={34} /><span className="eyebrow">Lesson locked</span><h1>{lesson.title}</h1>
        <p>Complete “{track.lessons[lessonIndex - 1]?.title}” with 100% first.</p>
        <Link className="button primary" href={`/learn/${track.slug}/${track.lessons[lessonIndex - 1]?.slug}`}>Go to previous lesson</Link>
      </main>
    );
  }

  return (
    <main className="lesson-page">
      <aside className="lesson-rail">
        <Link href={`/learn/${track.slug}`} className="back-link">← {track.title}</Link>
        <span className="eyebrow">{track.index} / {String(lessonIndex + 1).padStart(2, "0")}</span>
        <h2>{lesson.title}</h2>
        <nav>{lesson.sections.map((section, index) => <a href={`#section-${index}`} key={section.title}>{String(index + 1).padStart(2, "0")} {section.title}</a>)}<a href="#check">Lesson check</a></nav>
      </aside>
      <article className="lesson-content">
        <header>
          <span className="eyebrow">{lesson.duration} · Foundation lesson</span>
          <h1>{lesson.title}</h1>
          <p>{lesson.summary}</p>
        </header>

        {pitchPatterns.length > 0 && (
          <div className="pitch-grid">
            {pitchPatterns.map((pattern) => <div key={pattern}><strong>{pattern}</strong><PitchContour pattern={pattern} /></div>)}
          </div>
        )}

        {lesson.sections.map((section, index) => (
          <section id={`section-${index}`} className="lesson-section" key={section.title}>
            <span className="section-index">{String(index + 1).padStart(2, "0")}</span><h2>{section.title}</h2>
            {section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            {section.examples?.map((example) => (
              <div className="sound-example" key={`${example.japanese}-${example.label}`}>
                <div><strong lang="ja">{example.japanese}</strong><span>{example.label}</span></div>
                <p>{example.note}</p><div className="sound-actions">{example.japanese.split("/").map((phrase) => phrase.trim()).filter(Boolean).map((phrase) => <TtsButton key={phrase} text={phrase} label={`Listen to ${phrase}`} />)}</div>
              </div>
            ))}
            {section.tapAlong && <MoraTapAlong {...section.tapAlong} />}
            {section.callout && <div className="lesson-callout"><Sparkles size={18} /><p>{section.callout}</p></div>}
          </section>
        ))}

        {track.slug === "pitch" && <p className="source-note"><CircleAlert size={16} />Word accent varies by context and speaker. Check production examples with the University of Tokyo&apos;s <a href="https://www.gavo.t.u-tokyo.ac.jp/ojad/eng/pages/home" target="_blank" rel="noreferrer">OJAD accent dictionary</a>.</p>}

        <section className="lesson-check" id="check">
          <span className="eyebrow">Quick check · 100% to complete</span><h2>Make it stick</h2>
          <form onSubmit={grade}>
            {lesson.quiz.map((question, questionIndex) => (
              <fieldset key={question.prompt}>
                <legend><span>{questionIndex + 1}</span>{question.prompt}</legend>
                {question.options.map((option, optionIndex) => (
                  <label key={option} className={(score !== null || retainedAnswers.includes(questionIndex)) && optionIndex === question.answer ? "correct-option" : ""}>
                    <input type="radio" name={`question-${questionIndex}`} value={optionIndex} checked={answers[questionIndex] === optionIndex} onChange={() => setAnswers((current) => ({ ...current, [questionIndex]: optionIndex }))} disabled={score !== null || retainedAnswers.includes(questionIndex) || submitting} />
                    <span>{option}</span>{(score !== null || retainedAnswers.includes(questionIndex)) && optionIndex === question.answer && <Check size={16} />}
                  </label>
                ))}
                {(score !== null || retainedAnswers.includes(questionIndex)) && <p className="explanation">{question.explanation}</p>}
              </fieldset>
            ))}
            {score === null ? <button className="button primary" disabled={Object.keys(answers).length < lesson.quiz.length || submitting}>{submitting ? "Saving result…" : "Check my answers"}</button> : (
              <div className={score === 100 ? "score-card passed" : "score-card"}>
                <strong>{score}%</strong><div><h3>{score === 100 ? "Lesson complete"  : "Nearly there"}</h3><p>{score === 100 ? (next ? "The next lesson is now unlocked." : "You have completed this track.") : "Review the explanations, then retry only the questions you missed."}</p></div>
                {score < 100 && <button type="button" className="button secondary" onClick={() => { const correctAnswers = Object.fromEntries(Object.entries(answers).filter(([index, answer]) => answer === lesson.quiz[Number(index)].answer)); setRetainedAnswers(Object.keys(correctAnswers).map(Number)); setAnswers(correctAnswers); setScore(null); }}>Retry incorrect answers</button>}
              </div>
            )}
          </form>
        </section>

        <nav className="lesson-pagination">
          {previous ? <Link href={`/learn/${track.slug}/${previous.slug}`}><ChevronLeft size={18} />{previous.title}</Link> : <span />}
          {next && score !== null && score === 100 ? <Link href={`/learn/${track.slug}/${next.slug}`}>{next.title}<ChevronRight size={18} /></Link> : <Link href={`/learn/${track.slug}`}>Track overview<ChevronRight size={18} /></Link>}
        </nav>
      </article>
    </main>
  );
}
