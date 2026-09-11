import { describe, expect, it } from "vitest";
import { curriculum } from "@/lib/curriculum";

describe("curriculum", () => {
  const lessons = curriculum.flatMap((track) => track.lessons);

  it("uses five-question lesson checks", () => {
    expect(lessons).not.toHaveLength(0);
    expect(lessons.every((lesson) => lesson.quiz.length === 5)).toBe(true);
  });

  it("keeps every quiz answer within its options", () => {
    for (const lesson of lessons) {
      for (const question of lesson.quiz) {
        expect(question.answer).toBeGreaterThanOrEqual(0);
        expect(question.answer).toBeLessThan(question.options.length);
      }
    }
  });

  it("includes an interactive hidden-beat exercise", () => {
    const exercises = lessons.flatMap((lesson) => lesson.sections.flatMap((section) => section.tapAlong ? [section.tapAlong] : []));
    expect(exercises).toContainEqual(expect.objectContaining({ units: ["が", "っ", "こ", "う"] }));
  });
});
