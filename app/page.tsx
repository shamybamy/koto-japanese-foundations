import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { curriculum } from "@/lib/curriculum";

export default function Home() {
  return (
    <main>
      <section className="home-hero page-shell">
        <div className="hero-copy">
          <span className="eyebrow"><i />Japanese, from the sound up</span>
          <h1>Hear the beat.<br />Find your <em>voice.</em></h1>
          <p>Work towards native-level pronunciation with three areas English speakers often overlook: sound foundations, prosody and mora, and pitch accent. Learn kana alongside them as part of your first steps in Japanese.</p>
          <div className="hero-actions"><Link className="button primary" href="/learn">Start learning <ArrowRight size={17} /></Link><Link className="text-link" href="/kana">Learn kana</Link></div>

        </div>
        <div className="hero-visual" aria-label="Preview of a kana recognition card">
          <div className="orbit orbit-one"><span>あ</span></div><div className="orbit orbit-two"><span>音</span></div>
          <div className="floating-label label-one">one mora <i>拍</i></div><div className="floating-label label-two">steady vowel <i>母音</i></div>
          <div className="demo-card">
            <div><span className="direction-pill recognition">READ</span><small>Vowel group · 1 of 5</small></div>
            <strong lang="ja">あ</strong><p>How do you read this?</p>
            <div className="demo-input"><span>a</span><i>✓</i></div>
            <div className="demo-wave"><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
          </div>
        </div>
      </section>

      <section className="tracks-section">
        <div className="page-shell">
          <div className="section-intro"><div><span className="eyebrow">Four study areas</span><h2>Choose an area to study.</h2></div></div>
          <div className="track-card-grid">
            {curriculum.map((track) => (
              <Link href={`/learn/${track.slug}`} className={`track-card tone-${track.color}`} key={track.slug}>
                <div><span>{track.index}</span><i>{track.japanese}</i></div><h3>{track.title}</h3><p>{track.description}</p><footer><span>{track.lessons.length} lessons</span><ArrowRight size={19} /></footer>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="cumulative-section">
        <div className="page-shell cumulative-grid">
          <div className="kana-stack" aria-hidden><span>あ</span><span>か</span><span>さ</span><span>た</span><span>な</span><span>?</span></div>
          <div><span className="eyebrow">Kana learning</span><h2>Learn one group at a time.</h2><p>Hiragana and katakana are part of getting started in Japanese. Learn to recognise and recall them one group at a time.</p>
            <ol><li><span>01</span><div><strong>Meet a small group</strong><p>See the shape, rōmaji, and replayable TTS.</p></div></li><li><span>02</span><div><strong>Retrieve both ways</strong><p>Type or speak the reading; recall from a shuffled grid.</p></div></li><li><span>03</span><div><strong>Keep it alive</strong><p>FSRS schedules the next useful review.</p></div></li></ol>
            <Link className="button dark" href="/kana">Open kana learning <ArrowRight size={17} /></Link>
          </div>
        </div>
      </section>
    </main>
  );
}
