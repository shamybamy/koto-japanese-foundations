"use client";

import Link from "next/link";
import { Cloud, LogOut, Volume2 } from "lucide-react";
import { useProgress } from "@/app/providers";

export default function SettingsPage() {
  const { learner, signOutUser } = useProgress();
  return <main className="settings-page page-shell"><header><span className="eyebrow">Account & preferences</span><h1>Settings</h1></header><div className="settings-grid"><section><div><Cloud size={20} /><span><strong>Learning account</strong><small>{learner?.email ?? "Guest session"}</small></span></div>{learner ? <button className="button secondary" onClick={signOutUser}><LogOut size={16} />Sign out</button> : <Link className="button primary" href="/login">Sign in for future progress</Link>}</section><section><div><Volume2 size={20} /><span><strong>Audio</strong><small>Japanese browser TTS · rate 0.78</small></span></div><p>Available voices depend on your device and browser.</p></section></div></main>;
}
