"use client";

import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, CircleAlert, Lock, Sparkles } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { Lesson, Track } from "@/lib/curriculum";
import { lessonUnlocked } from "@/lib/progress";
import { useProgress } from "@/app/providers";
import { TtsButton } from "@/components/tts-button";
import { PitchContour } from "@/components/pitch-contour";

export function LessonView({ track, lesson }: { track: Track; lesson: Lesson }) {
  const { progress, completeLesson } = useProgress();
  const lessonIndex = track.lessons.findIndex((candidate) => candidate.slug === lesson.slug);
  const unlocked = lessonUnlocked(progress, track.slug, lessonIndex, track.lessons.map((item) => item.slug));
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [score, setScore] = useState<number | null>(null);
  const next = track.lessons[lessonIndex + 1];
  const previous = track.lessons[lessonIndex - 1];
  const pitchPatterns = useMemo(() => lesson.slug === "four-patterns" ? (["heiban", "atamadaka", "nakadaka", "odaka"] as const) : [], [lesson.slug]);

  function grade(event: FormEvent) {
    event.preventDefault();
    if (Object.keys(answers).length < lesson.quiz.length) return;
    const correct = lesson.quiz.filter((question, index) => answers[index] === question.answer).length;
    const result = Math.round((correct / lesson.quiz.length) * 100);
    setScore(result);
    completeLesson(`${track.slug}/${lesson.slug}`, result, lesson.quiz.map((_, index) => answers[index]));
  }

  if (!unlocked) {
    return (
      <main className="page-shell locked-lesson">
        <Lock size={34} /><span className="eyebrow">Lesson locked</span><h1>{lesson.title}</h1>
        <p>Complete “{track.lessons[lessonIndex - 1]?.title}” with at least 80% first.</p>
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
        <div className="rail-note"><span>合成音声</span><p>Audio examples use Japanese text-to-speech. They never autoplay.</p></div>
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
                <p>{example.note}</p><TtsButton text={example.japanese.split("/")[0].trim()} />
              </div>
            ))}
            {section.callout && <div className="lesson-callout"><Sparkles size={18} /><p>{section.callout}</p></div>}
          </section>
        ))}

        {track.slug === "pitch" && <p className="source-note"><CircleAlert size={16} />Word accent varies by context and speaker. Check production examples with the University of Tokyo&apos;s <a href="https://www.gavo.t.u-tokyo.ac.jp/ojad/eng/pages/home" target="_blank" rel="noreferrer">OJAD accent dictionary</a>.</p>}

        <section className="lesson-check" id="check">
          <span className="eyebrow">Quick check · 80% to complete</span><h2>Make it stick</h2>
          <form onSubmit={grade}>
            {lesson.quiz.map((question, questionIndex) => (
              <fieldset key={question.prompt}>
                <legend><span>{questionIndex + 1}</span>{question.prompt}</legend>
                {question.options.map((option, optionIndex) => (
                  <label key={option} className={score !== null && optionIndex === question.answer ? "correct-option" : ""}>
                    <input type="radio" name={`question-${questionIndex}`} value={optionIndex} checked={answers[questionIndex] === optionIndex} onChange={() => setAnswers((current) => ({ ...current, [questionIndex]: optionIndex }))} disabled={score !== null} />
                    <span>{option}</span>{score !== null && optionIndex === question.answer && <Check size={16} />}
                  </label>
                ))}
                {score !== null && <p className="explanation">{question.explanation}</p>}
              </fieldset>
            ))}
            {score === null ? <button className="button primary" disabled={Object.keys(answers).length < lesson.quiz.length}>Check my answers</button> : (
              <div className={score >= 80 ? "score-card passed" : "score-card"}>
                <strong>{score}%</strong><div><h3>{score >= 80 ? "Lesson complete" : "Nearly there"}</h3><p>{score >= 80 ? "The next lesson is now unlocked." : "Review the explanations and try the check again."}</p></div>
                {score < 80 && <button type="button" className="button secondary" onClick={() => { setScore(null); setAnswers({}); }}>Try again</button>}
              </div>
            )}
          </form>
        </section>

        <nav className="lesson-pagination">
          {previous ? <Link href={`/learn/${track.slug}/${previous.slug}`}><ChevronLeft size={18} />{previous.title}</Link> : <span />}
          {next && score !== null && score >= 80 ? <Link href={`/learn/${track.slug}/${next.slug}`}>{next.title}<ChevronRight size={18} /></Link> : <Link href={`/learn/${track.slug}`}>Track overview<ChevronRight size={18} /></Link>}
        </nav>
      </article>
    </main>
  );
}
