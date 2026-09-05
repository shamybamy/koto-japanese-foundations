import Link from "next/link";
export default function NotFound() {
  return (
    <main className="locked-lesson page-shell">
      <span className="eyebrow">404 · 迷子</span>
      <h1>This page wandered off.</h1>
      <p>The lesson path is still right where you left it.</p>
      <Link className="button primary" href="/learn">
        Back to learning
      </Link>
    </main>
  );
}
