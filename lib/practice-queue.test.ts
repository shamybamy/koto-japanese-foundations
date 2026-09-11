import { describe, expect, it } from "vitest";
import { Rating } from "ts-fsrs";
import { kanaGroups } from "@/lib/kana";
import { buildGuestReviewQueue, cardMatchesPracticeFilters, reviewQueuePath } from "@/lib/practice-queue";
import { emptyProgress, reviewKanaCard, startKanaGroup } from "@/lib/progress";

const fresh = () => structuredClone(emptyProgress);

describe("practice queue filters", () => {
  it("accepts both scripts and mixed directions", () => {
    const hiragana = startKanaGroup(fresh(), kanaGroups[0]).cards[`${kanaGroups[0].items[0].id}:recognition`];
    const recall = { ...hiragana, direction: "recall" as const };
    const katakanaItem = kanaGroups.find((group) => group.script === "katakana")!.items[0];
    const katakana = { ...hiragana, itemId: katakanaItem.id };

    expect(cardMatchesPracticeFilters(hiragana, "both", "mixed")).toBe(true);
    expect(cardMatchesPracticeFilters(recall, "hiragana", "mixed")).toBe(true);
    expect(cardMatchesPracticeFilters(katakana, "both", "recognition")).toBe(true);
    expect(cardMatchesPracticeFilters(katakana, "hiragana", "mixed")).toBe(false);
    expect(cardMatchesPracticeFilters(recall, "both", "recognition")).toBe(false);
  });

  it("keeps due cards first and applies one daily limit across filters", () => {
    const now = new Date("2026-09-09T12:00:00.000Z");
    let progress = startKanaGroup(startKanaGroup(fresh(), kanaGroups[0]), kanaGroups[1]);
    progress = reviewKanaCard(progress, kanaGroups[1].items[0].id, "recognition", false, Rating.Again, new Date("2026-09-09T10:00:00.000Z"));
    progress.dailyNew = { date: "2026-09-09", count: 8 };

    const result = buildGuestReviewQueue(progress, "both", "mixed", now);
    expect(result.cards[0].itemId).toBe(kanaGroups[1].items[0].id);
    expect(result.dueCount).toBe(1);
    expect(result.newCount).toBe(2);
    expect(result.cards).toHaveLength(3);
    expect(result.serverTime).toBe(now.toISOString());
  });

  it("introduces new cards in curriculum order rather than object insertion order", () => {
    const progress = startKanaGroup(startKanaGroup(fresh(), kanaGroups[1]), kanaGroups[0]);
    const reversed = Object.entries(progress.cards).reverse();
    progress.cards = Object.fromEntries(reversed);

    const result = buildGuestReviewQueue(progress, "hiragana", "recognition", new Date("2026-09-09T12:00:00.000Z"));
    expect(result.cards.slice(0, 5).map((card) => card.itemId)).toEqual(kanaGroups[0].items.map((item) => item.id));
  });

  it("builds the authenticated queue path for every filter", () => {
    expect(reviewQueuePath("both", "mixed")).toBe("reviews/queue?script=both&direction=mixed");
  });
});
