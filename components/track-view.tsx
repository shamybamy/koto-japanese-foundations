"use client";

import Link from "next/link";
import { ArrowRight, Check, Lock, Play } from "lucide-react";
import { Track } from "@/lib/curriculum";
import { lessonUnlocked } from "@/lib/progress";
import { useProgress } from "@/app/providers";

export function TrackView({ track }: { track: Track }) {
  const { progress } = useProgress();
  const lessonSlugs = track.lessons.map((lesson) => lesson.slug);
  const completed = track.lessons.filter((lesson) => progress.lessons[`${track.slug}/${lesson.slug}`]?.completed).length;
  return (
    <main className="page-shell track-page">
      <Link href="/learn" className="back-link">← All tracks</Link>
      <section className={`track-hero tone-${track.color}`}>
        <div><span className="track-japanese">{track.japanese}</span><span className="eyebrow">Track {track.index}</span></div>
        <div>
          <h1>{track.title}</h1>
          <p>{track.description}</p>
          <div className="track-progress"><span><i style={{ width: `${(completed / track.lessons.length) * 100}%` }} /></span>{completed} of {track.lessons.length} complete</div>
        </div>
      </section>

      <section className="lesson-list" aria-label={`${track.title} lessons`}>
        {track.lessons.map((lesson, index) => {
          const complete = progress.lessons[`${track.slug}/${lesson.slug}`]?.completed;
          const unlocked = lessonUnlocked(progress, track.slug, index, lessonSlugs);
          return (
            <article className={`lesson-row ${!unlocked ? "locked" : ""}`} key={lesson.slug}>
              <div className="lesson-number">{complete ? <Check size={19} /> : String(index + 1).padStart(2, "0")}</div>
              <div className="lesson-copy"><span>{lesson.duration}</span><h2>{lesson.title}</h2><p>{lesson.summary}</p></div>
              {unlocked ? (
                <Link className="circle-link" href={`/learn/${track.slug}/${lesson.slug}`} aria-label={`Open ${lesson.title}`}>
                  {complete ? <ArrowRight size={20} /> : <Play size={18} fill="currentColor" />}
                </Link>
              ) : <span className="circle-link disabled" title="Complete the previous lesson first"><Lock size={17} /></span>}
            </article>
          );
        })}
      </section>
      <aside className="sequence-note"><Lock size={17} /><div><strong>Sequence within each track</strong><p>Score 100% on a lesson check to unlock the next lesson. You can switch to another track whenever you like.</p></div></aside>
    </main>
  );
}
