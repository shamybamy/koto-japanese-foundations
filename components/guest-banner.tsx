"use client";

import Link from "next/link";
import { CloudOff } from "lucide-react";
import { useProgress } from "@/app/providers";

export function GuestBanner() {
  const { isGuest, authReady } = useProgress();
  if (!authReady || !isGuest) return null;
  return (
    <div className="guest-banner">
      <CloudOff size={16} aria-hidden />
      <span>You are exploring as a guest. Everything is open, but progress lasts only for this browser session.</span>
      <Link href="/login">Save progress</Link>
    </div>
  );
}
