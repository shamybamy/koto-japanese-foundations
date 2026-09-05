import Link from "next/link";
import { ArrowRight, CircleAlert } from "lucide-react";

export const metadata = { title: "About the method" };
export default function AboutPage() {
  return (
    <main className="about-page page-shell">
      <header>
        <span className="eyebrow">How Koto teaches</span>
        <h1>
          Accuracy first.
          <br />
          Approximation in its place.
        </h1>
        <p>
          Koto is designed for native English speakers who need an explicit
          bridge into Japanese sound and writing—without mistaking that bridge
          for the destination.
        </p>
      </header>
      <div className="about-grid">
        <section>
          <span>01</span>
          <h2>English comparisons are clues</h2>
          <p>
            They help you find a mouth shape, then the Japanese model takes
            over. Every comparison is labelled as an approximation.
          </p>
        </section>
        <section>
          <span>02</span>
          <h2>TTS makes repetition available</h2>
          <p>
            Your browser&apos;s Japanese synthesized voice provides consistent,
            replayable examples. It is convenient practice, not a guarantee of
            every regional or pitch-accent detail.
          </p>
        </section>
        <section>
          <span>03</span>
          <h2>Voice is an input method</h2>
          <p>
            Browser speech recognition checks the transcription it heard. It
            does not measure your articulation or score pronunciation quality.
          </p>
        </section>
        <section>
          <span>04</span>
          <h2>FSRS schedules memory</h2>
          <p>
            Recognition and recall remain independent. A 90% desired retention
            target determines useful review timing without inventing a
            proficiency percentage.
          </p>
        </section>
      </div>
      <aside>
        <CircleAlert size={20} />
        <p>
          Pronunciation and pitch-accent curriculum should receive final
          approval from a qualified Japanese phonetics reviewer before
          production release.
        </p>
      </aside>
      <Link className="button primary" href="/learn">
        Enter the curriculum <ArrowRight size={17} />
      </Link>
    </main>
  );
}
