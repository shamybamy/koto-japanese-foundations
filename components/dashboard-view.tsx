"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, Check, Languages, RotateCcw, Sparkles } from "lucide-react";
import { useEffect } from "react";
import { useProgress } from "@/app/providers";
import { curriculum } from "@/lib/curriculum";
import { kanaGroups } from "@/lib/kana";
import { dueReviewCards, groupIsProficient, scheduledReviewCards } from "@/lib/progress";

export function DashboardView() {
  const { progress, isGuest, authReady, dashboardSummary, dashboardServerTime, refreshDashboard } = useProgress();
  useEffect(() => {
    if (authReady && !isGuest) void refreshDashboard();
  }, [authReady, isGuest, refreshDashboard]);

  const parsedServerTime = dashboardServerTime ? new Date(dashboardServerTime) : null;
  const referenceNow = parsedServerTime && !Number.isNaN(parsedServerTime.getTime()) ? parsedServerTime : new Date();
  const completedLessons = Object.values(progress.lessons).filter((lesson) => lesson.completed).length;
  const totalLessons = curriculum.reduce((total, track) => total + track.lessons.length, 0);
  const completedGroups = kanaGroups.filter((group) => groupIsProficient(progress, group)).length;
  const localDue = dueReviewCards(progress, referenceNow).length;
  const due = !isGuest && dashboardSummary ? dashboardSummary.reviewsDue : localDue;
  const scheduled = scheduledReviewCards(progress);
  const today = referenceNow.toISOString().slice(0, 10);
  const introducedToday = progress.dailyNew?.date === today ? progress.dailyNew.count : 0;
  const localNewAvailable = Math.min(Object.values(progress.cards).filter((card) => card.reps === 0).length, Math.max(0, 10 - introducedToday));
  const newAvailable = !isGuest && dashboardSummary ? dashboardSummary.newCardsAvailableToday : localNewAvailable;
  const nextLesson = curriculum.flatMap((track) => track.lessons.map((lesson) => ({ track, lesson }))).find(({ track, lesson }) => !progress.lessons[`${track.slug}/${lesson.slug}`]?.completed);
  const nextReview = scheduled.find((card) => new Date(card.due) > referenceNow);
  const kanaOverview = (["hiragana", "katakana"] as const).map((script) => {
    const groups = kanaGroups.filter((group) => group.script === script);
    return {
      script,
      total: groups.length,
      recognition: groups.filter((group) => progress.recognitionGroups.includes(group.id)).length,
      recall: groups.filter((group) => progress.proficientGroups.includes(group.id)).length,
    };
  });

  return (
    <main className="dashboard simple-dashboard page-shell">
      <header className="dashboard-heading simple-dashboard-heading"><div><span className="eyebrow">Progress</span><h1>Your progress</h1><p>Curriculum, kana learning, and scheduled tests in one place.</p></div><Link className="button primary" href="/practice">Start test <ArrowRight size={16} /></Link></header>

      <section className="simple-metrics" aria-label="Progress summary">
        <div><span><BookOpen size={17} /></span><p><strong>{completedLessons}/{totalLessons}</strong><small>Lessons complete</small></p></div>
        <div><span><Languages size={17} /></span><p><strong>{completedGroups}/{kanaGroups.length}</strong><small>Kana groups complete</small></p></div>
        <div><span><RotateCcw size={17} /></span><p><strong>{due}</strong><small>Reviews due</small></p></div>
        <div><span><Sparkles size={17} /></span><p><strong>{newAvailable}</strong><small>New cards available</small></p></div>
      </section>

      <section className="progress-actions">
        <article>
          <span className="progress-icon"><BookOpen size={18} /></span><div><small>Curriculum</small><h2>{nextLesson ? nextLesson.lesson.title : "Curriculum complete"}</h2><p>{nextLesson ? nextLesson.lesson.summary : "All foundation lessons are complete."}</p></div>{nextLesson && <Link href={`/learn/${nextLesson.track.slug}/${nextLesson.lesson.slug}`}>Continue lesson <ArrowRight size={15} /></Link>}
        </article>
        <article className="kana-overview">
          <header><span className="progress-icon"><Languages size={18} /></span><div><small>Kana overview</small><h2>Reading and recall</h2></div></header>
          {kanaOverview.map((row) => <div className="kana-progress-row" key={row.script}><strong>{row.script === "hiragana" ? "Hiragana" : "Katakana"}</strong><span><b>{row.recognition}/{row.total}</b><small>Recognition</small></span><span><b>{row.recall}/{row.total}</b><small>Recall</small></span></div>)}
          <Link href="/kana">Open kana path <ArrowRight size={15} /></Link>
        </article>
      </section>

      <section className="review-summary">
        <div><span className="progress-icon"><RotateCcw size={18} /></span><div><small>Scheduled test</small><h2>{due ? `${due} ${due === 1 ? "card" : "cards"} due now` : "No reviews due"}</h2><p>{due ? `Complete due cards first; ${newAvailable} new ${newAvailable === 1 ? "card is" : "cards are"} available today.` : newAvailable ? `${newAvailable} new ${newAvailable === 1 ? "card is" : "cards are"} available today.` : nextReview ? `Next review ${new Date(nextReview.due).toLocaleDateString([], { month: "short", day: "numeric" })}.` : "Learn a kana group to add test cards."}</p></div></div><Link className="button secondary" href="/practice">{due ? "Start test" : "Open test"}<ArrowRight size={15} /></Link>
      </section>

      {(completedLessons > 0 || completedGroups > 0) && <p className="progress-note"><Check size={14} />Completed lessons and groups remain available to revisit.</p>}
    </main>
  );
}
