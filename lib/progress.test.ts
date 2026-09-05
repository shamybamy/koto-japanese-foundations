import { describe, expect, it } from "vitest";
import { Rating } from "ts-fsrs";
import { kanaGroups } from "@/lib/kana";
import { buildLearningQueue, buildReviewQueue, dueReviewCards, emptyProgress, groupDirectionIsProficient, groupIsAvailable, groupIsProficient, lessonUnlocked, reviewKanaCard, reviewKanaLearning, scheduledReviewCards, startKanaGroup, startKanaRecall } from "@/lib/progress";

const fresh = () => structuredClone(emptyProgress);

describe("kana learning state", () => {
  it("creates recognition cards first and does so idempotently", () => {
    const group = kanaGroups[0];
    const once = startKanaGroup(fresh(), group);
    const twice = startKanaGroup(once, group);
    expect(Object.keys(once.cards)).toHaveLength(group.items.length);
    expect(Object.values(once.cards).every((card) => card.direction === "recognition")).toBe(true);
    expect(Object.keys(twice.cards)).toHaveLength(group.items.length);
  });

  it("keeps recall locked until recognition is complete", () => {
    const group = kanaGroups[0];
    let state = startKanaGroup(fresh(), group);
    state = startKanaRecall(state, group);
    expect(state.recallStartedGroups).toHaveLength(0);
    expect(Object.values(state.cards).some((card) => card.direction === "recall")).toBe(false);

    for (const item of group.items) {
      state = reviewKanaLearning(state, item.id, "recognition", true);
      state = reviewKanaLearning(state, item.id, "recognition", true);
    }
    expect(groupDirectionIsProficient(state, group, "recognition")).toBe(true);
    state = startKanaRecall(state, group);
    expect(state.recallStartedGroups).toContain(group.id);
    expect(Object.values(state.cards).filter((card) => card.direction === "recall")).toHaveLength(group.items.length);
  });

  it("keeps unanswered group cards out of the review queue", () => {
    const group = kanaGroups[0];
    const reviewTime = new Date();
    let state = startKanaGroup(fresh(), group);
    expect(scheduledReviewCards(state)).toHaveLength(0);
    expect(dueReviewCards(state, reviewTime)).toHaveLength(0);

    state = reviewKanaCard(state, group.items[0].id, "recognition", false, undefined, reviewTime);
    expect(scheduledReviewCards(state)).toHaveLength(1);
    expect(dueReviewCards(state, new Date(reviewTime.getTime() + 2 * 60_000))).toHaveLength(1);
    expect(scheduledReviewCards(state).some((card) => card.itemId === group.items[1].id)).toBe(false);
  });

  it("requires two consecutive correct reviews in both directions", () => {
    const group = kanaGroups[0];
    let state = startKanaGroup(fresh(), group);
    for (const item of group.items) {
      state = reviewKanaLearning(state, item.id, "recognition", true, new Date("2026-08-02T00:00:00Z"));
      state = reviewKanaLearning(state, item.id, "recognition", true, new Date("2026-08-02T00:11:00Z"));
    }
    expect(groupIsProficient(state, group)).toBe(false);
    state = startKanaRecall(state, group);
    for (const item of group.items) {
      state = reviewKanaLearning(state, item.id, "recall", true, new Date("2026-08-02T00:20:00Z"));
      state = reviewKanaLearning(state, item.id, "recall", true, new Date("2026-08-02T00:31:00Z"));
    }
    expect(groupIsProficient(state, group)).toBe(true);
    expect(groupIsAvailable(state, kanaGroups[1])).toBe(true);
  });

  it("does not relock a completed group after an optional repeat mistake", () => {
    const group = kanaGroups[0];
    let state = startKanaGroup(fresh(), group);
    for (const item of group.items) {
      state = reviewKanaLearning(state, item.id, "recognition", true);
      state = reviewKanaLearning(state, item.id, "recognition", true);
    }
    state = startKanaRecall(state, group);
    for (const item of group.items) {
      state = reviewKanaLearning(state, item.id, "recall", true);
      state = reviewKanaLearning(state, item.id, "recall", true);
    }
    delete (state as Partial<typeof state>).proficientGroups;
    state = reviewKanaLearning(state, group.items[0].id, "recognition", false);
    expect(groupIsProficient(state, group)).toBe(true);
    expect(groupIsAvailable(state, kanaGroups[1])).toBe(true);
  });

  it("resets the initial proficiency streak after an error", () => {
    const group = kanaGroups[0];
    const item = group.items[0];
    let state = startKanaGroup(fresh(), group);
    state = reviewKanaLearning(state, item.id, "recognition", true);
    state = reviewKanaLearning(state, item.id, "recognition", false);
    expect(state.cards[`${item.id}:recognition`].learningStreak).toBe(0);
  });

  it("keeps scheduled reviews out of the learning queue", () => {
    const currentGroup = kanaGroups[1];
    let state = startKanaGroup(fresh(), kanaGroups[0]);
    state = reviewKanaCard(state, kanaGroups[0].items[0].id, "recognition", false, undefined, new Date("2020-01-01T00:00:00.000Z"));
    state = startKanaGroup(state, currentGroup);
    const older = state.cards[`${kanaGroups[0].items[0].id}:recognition`];
    const queue = buildLearningQueue(state, currentGroup, "recognition");
    expect(queue[0].itemId).toBe(currentGroup.items[0].id);
    expect(queue[1].itemId).toBe(currentGroup.items[1].id);
    expect(queue.some((card) => card.itemId === older.itemId)).toBe(false);
  });

  it("never mixes recognition and recall inside a learning stage", () => {
    const group = kanaGroups[0];
    let state = startKanaGroup(fresh(), group);
    for (const item of group.items) {
      state = reviewKanaLearning(state, item.id, "recognition", true);
      state = reviewKanaLearning(state, item.id, "recognition", true);
    }
    state = startKanaRecall(state, group);
    expect(buildLearningQueue(state, group, "recall").every((card) => card.direction === "recall")).toBe(true);
  });

  it("does not change FSRS scheduling during free learning practice", () => {
    const group = kanaGroups[0];
    const item = group.items[0];
    let state = startKanaGroup(fresh(), group);
    const due = state.cards[`${item.id}:recognition`].due;
    state = reviewKanaLearning(state, item.id, "recognition", true);
    expect(state.cards[`${item.id}:recognition`].reps).toBe(0);
    expect(state.cards[`${item.id}:recognition`].due).toBe(due);
    expect(scheduledReviewCards(state)).toHaveLength(0);
  });

  it("puts due cards before new cards and respects the daily new-card limit", () => {
    let state = startKanaGroup(startKanaGroup(fresh(), kanaGroups[0]), kanaGroups[1]);
    state = reviewKanaCard(state, kanaGroups[0].items[0].id, "recognition", false, Rating.Again, new Date("2026-08-02T00:00:00Z"));
    state.dailyNew = { date: "2026-08-03", count: 8 };
    const queue = buildReviewQueue(state, "hiragana", "recognition", new Date("2026-08-03T00:00:00Z"));
    expect(queue[0].reps).toBeGreaterThan(0);
    expect(queue.filter((card) => card.reps === 0)).toHaveLength(2);
  });

  it("keeps track sequencing independent", () => {
    const state = fresh();
    expect(lessonUnlocked(state, "sounds", 0, ["vowels", "consonants"])).toBe(true);
    expect(lessonUnlocked(state, "sounds", 1, ["vowels", "consonants"])).toBe(false);
    state.lessons["sounds/vowels"] = { bestScore: 100, attempts: 1, completed: true };
    expect(lessonUnlocked(state, "sounds", 1, ["vowels", "consonants"])).toBe(true);
    expect(lessonUnlocked(state, "prosody", 0, ["mora", "length"])).toBe(true);
  });
});
