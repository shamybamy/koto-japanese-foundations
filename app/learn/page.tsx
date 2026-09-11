import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { curriculum } from "@/lib/curriculum";

export const metadata = { title: "Curriculum" };

export default function LearnPage() {
  return (
    <main className="learn-index page-shell">
      <header><span className="eyebrow">Foundational curriculum</span><h1>Building the foundation.<br /></h1><p>Sound foundations, prosody and mora, and pitch accent are the three areas I feel are key to working towards native-level pronunciation. Kana is here alongside them as an essential part of beginning Japanese.</p></header>
      <div className="curriculum-grid">
        {curriculum.map((track) => <Link href={`/learn/${track.slug}`} key={track.slug} className={`curriculum-card tone-${track.color}`}><div className="curriculum-number"><span>{track.index}</span><i>{track.japanese}</i></div><div><h2>{track.title}</h2><p>{track.description}</p><ul>{track.lessons.map((lesson) => <li key={lesson.slug}>{lesson.title}</li>)}</ul></div><footer><span>{track.lessons.length} lessons</span><ArrowRight size={20} /></footer></Link>)}
      </div>
    </main>
  );
}
