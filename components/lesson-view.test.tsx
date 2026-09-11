import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LessonView } from "@/components/lesson-view";
import { Lesson, Track } from "@/lib/curriculum";
import { emptyProgress } from "@/lib/progress";

const mocks = vi.hoisted(() => ({
  context: {} as Record<string, unknown>,
}));

vi.mock("@/app/providers", () => ({ useProgress: () => mocks.context }));
vi.mock("@/components/tts-button", () => ({
  TtsButton: ({ text }: { text: string }) => <button type="button" data-testid="tts-control" data-text={text}>{text}</button>,
}));
vi.mock("@/components/pitch-contour", () => ({ PitchContour: () => null }));
vi.mock("@/components/mora-tap-along", () => ({ MoraTapAlong: () => null }));

const lesson: Lesson = {
  slug: "contrast",
  title: "Sound contrast",
  duration: "1 min",
  summary: "Compare two sounds.",
  sections: [{
    title: "Listen separately",
    body: [],
    examples: [{
      japanese: "カット / コート",
      label: "katto / kōto",
      note: "Compare the vowel length.",
    }],
  }],
  quiz: [{
    prompt: "Which word is longer?",
    options: ["カット", "コート"],
    answer: 1,
    explanation: "コート contains a long vowel.",
  }],
};

const track: Track = {
  slug: "test-track",
  index: "01",
  japanese: "音",
  title: "Test track",
  description: "A test track.",
  color: "coral",
  lessons: [lesson],
};

describe("LessonView contrast audio", () => {
  afterEach(cleanup);

  it("gives each side of a slash-separated contrast its own TTS control", () => {
    mocks.context = {
      progress: structuredClone(emptyProgress),
      completeLesson: vi.fn(),
      authReady: true,
    };

    render(<LessonView track={track} lesson={lesson} />);

    const example = screen.getByText("カット / コート").closest(".sound-example");
    expect(example).not.toBeNull();
    const controls = within(example as HTMLElement).getAllByTestId("tts-control");
    expect(controls).toHaveLength(2);
    expect(controls.map((control) => control.dataset.text)).toEqual(["カット", "コート"]);
  });

  it("does not expose the lesson check while authentication is restoring", () => {
    mocks.context = {
      progress: structuredClone(emptyProgress),
      completeLesson: vi.fn(),
      authReady: false,
    };

    render(<LessonView track={track} lesson={lesson} />);
    expect(screen.getByText("Loading your lesson progress…")).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });
});

it("requires 100% and retains correct answers across repeated retries", async () => {
  const quizLesson = { ...lesson, quiz: Array.from({ length: 5 }, (_, index) => ({
    prompt: `Question ${index + 1}`, options: ["Wrong", "Right"], answer: 1, explanation: "Choose right.",
  })) };
  const completeLesson = vi.fn(async (_key: string, score: number) => ({ score }));
  mocks.context = { progress: structuredClone(emptyProgress), completeLesson, authReady: true };
  render(<LessonView track={{ ...track, lessons: [quizLesson] }} lesson={quizLesson} />);
  const questions = screen.getAllByRole("group");
  questions.forEach((question, index) => fireEvent.click(within(question).getByRole("radio", { name: index === 4 ? "Wrong" : "Right" })));
  fireEvent.click(screen.getByRole("button", { name: "Check my answers" }));
  expect(await screen.findByText("80%")).toBeVisible();
  expect(screen.queryByText("Lesson complete")).not.toBeInTheDocument();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    fireEvent.click(screen.getByRole("button", { name: "Retry incorrect answers" }));
    questions.slice(0, 4).forEach((question) => {
      expect(within(question).getByRole("radio", { name: "Right" })).toBeChecked();
      expect(within(question).getByRole("radio", { name: "Right" })).toBeDisabled();
    });
    expect(within(questions[4]).getByRole("radio", { name: "Wrong" })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Check my answers" })).toBeDisabled();
    fireEvent.click(within(questions[4]).getByRole("radio", { name: attempt === 0 ? "Wrong" : "Right" }));
    fireEvent.click(screen.getByRole("button", { name: "Check my answers" }));
    await screen.findByText(attempt === 0 ? "80%" : "100%");
  }
  expect(screen.getByText("Lesson complete")).toBeVisible();
  expect(completeLesson).toHaveBeenLastCalledWith("test-track/contrast", 100, [1, 1, 1, 1, 1]);
  cleanup();
});
