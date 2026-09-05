"use client";

import { Mic, MicOff } from "lucide-react";
import { useRef, useState } from "react";

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

export function VoiceInput({ onTranscript, disabled = false }: { onTranscript: (value: string) => void; disabled?: boolean }) {
  const [listening, setListening] = useState(false);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const supported = typeof window !== "undefined" && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  function toggle() {
    if (listening) { recognition.current?.stop(); return; }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return;
    const instance = new Recognition();
    instance.lang = "ja-JP";
    instance.interimResults = false;
    instance.maxAlternatives = 1;
    instance.onresult = (event) => onTranscript(event.results[0][0].transcript);
    instance.onerror = () => setListening(false);
    instance.onend = () => setListening(false);
    recognition.current = instance;
    setListening(true);
    instance.start();
  }

  return (
    <button type="button" className={listening ? "voice-button listening" : "voice-button"} onClick={toggle} disabled={disabled || !supported} title={supported ? "Answer with Japanese speech" : "Voice recognition is unavailable in this browser"}>
      {listening ? <MicOff size={18} /> : <Mic size={18} />}{listening ? "Listening…" : "Speak answer"}
    </button>
  );
}
