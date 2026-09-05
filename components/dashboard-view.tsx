"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, Check, Languages, RotateCcw } from "lucide-react";
import { useProgress } from "@/app/providers";
import { curriculum } from "@/lib/curriculum";
import { kanaGroups } from "@/lib/kana";
import { dueReviewCards, groupIsAvailable, groupIsProficient, scheduledReviewCards } from "@/lib/progress";

export function DashboardView() {
  const { progress } = useProgress();
  const completedLessons = Object.values(progress.lessons).filter((lesson) => lesson.completed).length;
  const totalLessons = curriculum.reduce((total, track) => total + track.lessons.length, 0);
  const completedGroups = kanaGroups.filter((group) => groupIsProficient(progress, group)).length;
  const due = dueReviewCards(progress).length;
  const scheduled = scheduledReviewCards(progress);
  const nextLesson = curriculum.flatMap((track) => track.lessons.map((lesson) => ({ track, lesson }))).find(({ track, lesson }) => !progress.lessons[`${track.slug}/${lesson.slug}`]?.completed);
  const nextKanaGroup = kanaGroups.find((group) => groupIsAvailable(progress, group) && !groupIsProficient(progress, group));
  const nextReview = scheduled.find((card) => new Date(card.due) > new Date());

  return (
    <main className="dashboard simple-dashboard page-shell">
      <header className="dashboard-heading simple-dashboard-heading"><div><span className="eyebrow">Progress</span><h1>Your progress</h1><p>Curriculum, kana learning, and scheduled tests in one place.</p></div><Link className="button primary" href="/practice">Start test <ArrowRight size={16} /></Link></header>

      <section className="simple-metrics" aria-label="Progress summary">
        <div><span><BookOpen size={17} /></span><p><strong>{completedLessons}/{totalLessons}</strong><small>Lessons complete</small></p></div>
        <div><span><Languages size={17} /></span><p><strong>{completedGroups}/{kanaGroups.length}</strong><small>Kana groups complete</small></p></div>
        <div><span><RotateCcw size={17} /></span><p><strong>{due}</strong><small>Reviews due</small></p></div>
      </section>

      <section className="progress-actions">
        <article>
          <span className="progress-icon"><BookOpen size={18} /></span><div><small>Curriculum</small><h2>{nextLesson ? nextLesson.lesson.title : "Curriculum complete"}</h2><p>{nextLesson ? nextLesson.lesson.summary : "All foundation lessons are complete."}</p></div>{nextLesson && <Link href={`/learn/${nextLesson.track.slug}/${nextLesson.lesson.slug}`}>Continue lesson <ArrowRight size={15} /></Link>}
        </article>
        <article>
          <span className="progress-icon"><Languages size={18} /></span><div><small>Kana learning</small><h2>{nextKanaGroup ? nextKanaGroup.label : "Kana path complete"}</h2><p>{nextKanaGroup ? `${nextKanaGroup.script === "hiragana" ? "Hiragana" : "Katakana"} · ${nextKanaGroup.eyebrow}` : "You can repeat any recognition or recall group."}</p></div><Link href="/kana">Open kana path <ArrowRight size={15} /></Link>
        </article>
      </section>

      <section className="review-summary">
        <div><span className="progress-icon"><RotateCcw size={18} /></span><div><small>Scheduled test</small><h2>{due ? `${due} ${due === 1 ? "card" : "cards"} due now` : "No reviews due"}</h2><p>{due ? "Complete the due cards before new ones." : nextReview ? `Next review ${new Date(nextReview.due).toLocaleDateString([], { month: "short", day: "numeric" })}.` : "Learn a kana group to add test cards."}</p></div></div><Link className="button secondary" href="/practice">{due ? "Start test" : "Open test"}<ArrowRight size={15} /></Link>
      </section>

      {(completedLessons > 0 || completedGroups > 0) && <p className="progress-note"><Check size={14} />Completed lessons and groups remain available to revisit.</p>}
    </main>
  );
}
