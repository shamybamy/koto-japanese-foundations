import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TtsButton } from "@/components/tts-button";
import { createElement } from "react";

describe("TtsButton", () => {
  const speak = vi.fn();
  beforeEach(() => {
    speak.mockClear();
    class MockUtterance { lang = ""; rate = 1; voice = null; onend = null; onerror = null; constructor(public text: string) {} }
    Object.defineProperty(window, "SpeechSynthesisUtterance", { value: MockUtterance, configurable: true });
    Object.defineProperty(globalThis, "SpeechSynthesisUtterance", { value: MockUtterance, configurable: true });
    Object.defineProperty(window, "speechSynthesis", { value: { speak, cancel: vi.fn(), getVoices: () => [{ lang: "ja-JP" }] }, configurable: true });
  });

  it("uses a Japanese voice without autoplaying", () => {
    render(createElement(TtsButton, { text: "あ" }));
    expect(speak).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /play synthesized japanese/i }));
    expect(speak).toHaveBeenCalledOnce();
    expect(speak.mock.calls[0][0]).toMatchObject({ text: "あ", lang: "ja-JP", rate: 0.78 });
  });
});
