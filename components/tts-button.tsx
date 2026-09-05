"use client";

import { Volume2, Square } from "lucide-react";
import { useEffect, useState } from "react";

export function TtsButton({ text, label = "Play synthesized Japanese" }: { text: string; label?: string }) {
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => setSupported("speechSynthesis" in window), []);

  function speak() {
    if (!supported) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ja-JP";
    utterance.rate = 0.78;
    const voices = window.speechSynthesis.getVoices();
    utterance.voice = voices.find((voice) => voice.lang.toLowerCase().startsWith("ja")) ?? null;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }

  return (
    <button type="button" className="audio-button" onClick={speak} disabled={!supported} aria-label={label} title={supported ? "Synthesized Japanese audio" : "TTS is unavailable in this browser"}>
      {speaking ? <Square size={15} fill="currentColor" /> : <Volume2 size={17} />}<span>{speaking ? "Stop" : "Listen"}</span><i>TTS</i>
    </button>
  );
}
