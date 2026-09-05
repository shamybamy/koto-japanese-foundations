import { describe, expect, it } from "vitest";
import { isRomajiAnswer, kanaGroups, normalizeRomaji, seededShuffle } from "@/lib/kana";

describe("rōmaji normalization", () => {
  it("normalizes case, whitespace, punctuation, and macrons", () => {
    expect(normalizeRomaji("  KŌ! ")).toBe("ko");
  });

  it("accepts common Kunrei-style aliases", () => {
    const shi = kanaGroups[2].items.find((item) => item.romaji === "shi")!;
    const tsu = kanaGroups[3].items.find((item) => item.romaji === "tsu")!;
    expect(isRomajiAnswer(shi, "si")).toBe(true);
    expect(isRomajiAnswer(tsu, "TU")).toBe(true);
  });

  it("keeps hiragana and katakana in separate ordered paths", () => {
    const hiragana = kanaGroups.filter((group) => group.script === "hiragana");
    const katakana = kanaGroups.filter((group) => group.script === "katakana");
    expect(hiragana[0].items.map((item) => item.kana)).toEqual(["あ", "い", "う", "え", "お"]);
    expect(katakana[0].items.map((item) => item.kana)).toEqual(["ア", "イ", "ウ", "エ", "オ"]);
    expect(hiragana).toHaveLength(katakana.length);
  });

  it("reshuffles kana choices between attempts", () => {
    const choices = kanaGroups.slice(0, 3).flatMap((group) => group.items.map((item) => item.kana));
    expect(seededShuffle(choices, "attempt-1")).toEqual(seededShuffle(choices, "attempt-1"));
    expect(seededShuffle(choices, "attempt-1")).not.toEqual(seededShuffle(choices, "attempt-2"));
  });
});
