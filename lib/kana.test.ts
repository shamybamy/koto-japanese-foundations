import { describe, expect, it } from "vitest";
import { isRomajiAnswer, kanaGroups, normalizeRomaji, recallDisambiguation, seededShuffle } from "@/lib/kana";

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

  it("identifies a group when a recall reading has more than one valid spelling", () => {
    const dji = kanaGroups.find((group) => group.id === "h-d")!.items.find((item) => item.romaji === "ji")!;
    const ordinaryKa = kanaGroups.find((group) => group.id === "h-k")!.items[0];
    expect(recallDisambiguation(dji)).toBe("D row spelling");
    expect(recallDisambiguation(ordinaryKa)).toBeUndefined();
  });

  it("reshuffles kana choices between attempts", () => {
    const group = kanaGroups.find((candidate) => candidate.id === "h-vowels")!;
    const item = group.items[0];
    const choices = group.items.map((candidate) => candidate.kana);
    const first = seededShuffle(choices, `${item.id}-0-learning-grid`);
    const second = seededShuffle(choices, `${item.id}-1-learning-grid`);
    expect(first).toEqual(seededShuffle(choices, `${item.id}-0-learning-grid`));
    expect(first).not.toEqual(second);
  });
});
