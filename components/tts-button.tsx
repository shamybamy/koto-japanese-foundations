"use client";

import { Volume2, VolumeX, Square } from "lucide-react";
import { useEffect, useState } from "react";

type Availability = "checking" | "available" | "unsupported" | "no-japanese-voice";

export function TtsButton({ text, label = "Play synthesized Japanese" }: { text: string; label?: string }) {
  const [speaking, setSpeaking] = useState(false);
  const [availability, setAvailability] = useState<Availability>("checking");
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined" || typeof window.speechSynthesis.getVoices !== "function") {
      setAvailability("unsupported");
      return;
    }

    const synthesis = window.speechSynthesis;
    const refreshVoice = () => {
      const japaneseVoice = synthesis.getVoices().find((candidate) => candidate.lang.toLowerCase().startsWith("ja")) ?? null;
      setVoice(japaneseVoice);
      setAvailability(japaneseVoice ? "available" : "no-japanese-voice");
    };

    refreshVoice();
    if (typeof synthesis.addEventListener === "function") {
      synthesis.addEventListener("voiceschanged", refreshVoice);
      return () => synthesis.removeEventListener("voiceschanged", refreshVoice);
    }

    const previousHandler = synthesis.onvoiceschanged;
    synthesis.onvoiceschanged = refreshVoice;
    return () => {
      if (synthesis.onvoiceschanged === refreshVoice) synthesis.onvoiceschanged = previousHandler;
    };
  }, []);

  function speak() {
    if (availability !== "available" || !voice) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ja-JP";
    utterance.rate = 0.78;
    utterance.voice = voice;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }

  const unavailableMessage = availability === "unsupported"
    ? "Japanese audio is unavailable because this browser does not support speech synthesis."
    : availability === "no-japanese-voice"
      ? "Japanese audio is unavailable because no Japanese text-to-speech voice is installed."
      : availability === "checking"
        ? "Checking for a Japanese text-to-speech voice."
        : "";
  const visibleLabel = availability === "unsupported"
    ? "Audio unavailable"
    : availability === "no-japanese-voice"
      ? "No Japanese voice"
      : availability === "checking"
        ? "Checking audio…"
        : speaking ? "Stop" : "Listen";

  return (
    <button
      type="button"
      className="audio-button"
      onClick={speak}
      disabled={availability !== "available"}
      aria-label={unavailableMessage ? `${label} unavailable. ${unavailableMessage}` : speaking ? `Stop audio: ${label}` : label}
      title={unavailableMessage || "Synthesized Japanese audio"}
    >
      {availability !== "available" ? <VolumeX size={17} /> : speaking ? <Square size={15} fill="currentColor" /> : <Volume2 size={17} />}<span>{visibleLabel}</span>
    </button>
  );
}
