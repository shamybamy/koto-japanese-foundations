import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div><span className="wordmark-mark small">こ</span><strong>Koto</strong></div>
      <p>Pronunciation, prosody, pitch accent, and kana.</p>
      <div className="footer-links"><Link href="/learn">Curriculum</Link><Link href="/kana">Kana learning</Link><Link href="/practice">Test</Link><Link href="/about">About</Link></div>
      <small>Audio is synthesized with your browser&apos;s Japanese voice.</small>
    </footer>
  );
}
