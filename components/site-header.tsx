"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { useProgress } from "@/app/providers";

const links = [
  ["Learn", "/learn"],
  ["Kana learning", "/kana"],
  ["Test", "/practice"],
  ["Progress", "/dashboard"],
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { learner } = useProgress();
  return (
    <header className="site-header">
      <Link href="/" className="wordmark" aria-label="Koto home">
        <span className="wordmark-mark">こ</span><span>Koto</span>
      </Link>
      <button className="menu-button" onClick={() => setOpen((value) => !value)} aria-label="Toggle navigation" aria-expanded={open}>
        {open ? <X size={22} /> : <Menu size={22} />}
      </button>
      <nav className={open ? "nav-links nav-open" : "nav-links"} aria-label="Main navigation">
        {links.map(([label, href]) => <Link key={href} href={href} onClick={() => setOpen(false)}>{label}</Link>)}
        <Link className="nav-account" href={learner ? "/settings" : "/login"} onClick={() => setOpen(false)}>
          {learner ? "Account" : "Sign in"}
        </Link>
      </nav>
    </header>
  );
}
