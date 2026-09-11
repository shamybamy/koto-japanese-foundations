import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TtsButton } from "@/components/tts-button";
import { createElement } from "react";

describe("TtsButton", () => {
  const speak = vi.fn();
  const cancel = vi.fn();
  let voices: Array<{ lang: string; name: string }>;
  let voicesChanged: (() => void) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    voices = [{ lang: "ja-JP", name: "Japanese" }];
    voicesChanged = undefined;
    class MockUtterance { lang = ""; rate = 1; voice = null; onend = null; onerror = null; constructor(public text: string) {} }
    Object.defineProperty(window, "SpeechSynthesisUtterance", { value: MockUtterance, configurable: true });
    Object.defineProperty(globalThis, "SpeechSynthesisUtterance", { value: MockUtterance, configurable: true });
    Object.defineProperty(window, "speechSynthesis", {
      value: {
        speak,
        cancel,
        getVoices: () => voices,
        addEventListener: vi.fn((event: string, listener: () => void) => {
          if (event === "voiceschanged") voicesChanged = listener;
        }),
        removeEventListener: vi.fn(),
      },
      configurable: true,
    });
  });

  afterEach(cleanup);

  it("uses a Japanese voice without autoplaying", () => {
    render(createElement(TtsButton, { text: "あ" }));
    expect(speak).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /play synthesized japanese/i }));
    expect(speak).toHaveBeenCalledOnce();
    expect(speak.mock.calls[0][0]).toMatchObject({ text: "あ", lang: "ja-JP", rate: 0.78 });
    expect(speak.mock.calls[0][0].voice).toBe(voices[0]);
  });

  it("shows a clear disabled state when no Japanese voice is installed", () => {
    voices = [{ lang: "en-US", name: "English" }];

    render(<div><strong lang="ja">あ</strong><TtsButton text="あ" label="Listen to a" /></div>);

    expect(screen.getByText("あ")).toBeVisible();
    const button = screen.getByRole("button", { name: /listen to a unavailable.*no japanese text-to-speech voice is installed/i });
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("No Japanese voice");
    fireEvent.click(button);
    expect(speak).not.toHaveBeenCalled();
  });

  it("enables playback when a Japanese voice arrives after voiceschanged", async () => {
    voices = [];
    render(createElement(TtsButton, { text: "コート" }));
    expect(screen.getByRole("button", { name: /no japanese text-to-speech voice is installed/i })).toBeDisabled();

    const japaneseVoice = { lang: "ja-JP", name: "Japanese (late)" };
    voices = [japaneseVoice];
    act(() => voicesChanged?.());

    const button = await screen.findByRole("button", { name: /play synthesized japanese/i });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    expect(speak).toHaveBeenCalledOnce();
    expect(speak.mock.calls[0][0].voice).toBe(japaneseVoice);
  });
});
