import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { curriculum } from "@/lib/curriculum";

export const metadata = { title: "Curriculum" };

export default function LearnPage() {
  return (
    <main className="learn-index page-shell">
      <header><span className="eyebrow">Foundational curriculum</span><h1>Four ways into<br />the same language.</h1><p>Start anywhere. Each track remembers its own place and unlocks lesson by lesson.</p></header>
      <div className="curriculum-grid">
        {curriculum.map((track) => <Link href={`/learn/${track.slug}`} key={track.slug} className={`curriculum-card tone-${track.color}`}><div className="curriculum-number"><span>{track.index}</span><i>{track.japanese}</i></div><div><h2>{track.title}</h2><p>{track.description}</p><ul>{track.lessons.map((lesson) => <li key={lesson.slug}>{lesson.title}</li>)}</ul></div><footer><span>{track.lessons.length} lessons</span><ArrowRight size={20} /></footer></Link>)}
      </div>
    </main>
  );
}
