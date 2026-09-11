import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KanaLearningView } from "@/components/kana-learning-view";
import { kanaGroups } from "@/lib/kana";
import { emptyProgress, reviewKanaLearning, startKanaGroup, startKanaRecall } from "@/lib/progress";

const mocks = vi.hoisted(() => ({
  context: {} as Record<string, unknown>,
}));

vi.mock("@/app/providers", () => ({ useProgress: () => mocks.context }));
vi.mock("@/components/tts-button", () => ({
  TtsButton: ({ text }: { text: string }) => <button type="button">Listen to {text}</button>,
}));

describe("KanaLearningView cloud saves", () => {
  const group = kanaGroups[0];
  const progress = startKanaGroup(structuredClone(emptyProgress), group);
  const startGroup = vi.fn();
  const startRecall = vi.fn();
  const recordLearningAnswer = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    startGroup.mockResolvedValue(true);
    startRecall.mockResolvedValue(true);
    recordLearningAnswer.mockResolvedValue({ correct: true });
    mocks.context = {
      progress,
      startGroup,
      startRecall,
      recordLearningAnswer,
      authReady: true,
    };
  });

  afterEach(cleanup);

  it("keeps the answered card visible while saving and offers a retry when the save fails", async () => {
    let finishSave: (result: null) => void = () => undefined;
    recordLearningAnswer.mockReturnValue(new Promise<null>((resolve) => {
      finishSave = resolve;
    }));

    render(<KanaLearningView />);
    fireEvent.click(screen.getByRole("button", { name: /Continue recognition/ }));

    const answer = await screen.findByLabelText("Type rōmaji");
    fireEvent.change(answer, { target: { value: "a" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    expect(screen.getByText("Correct")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Continue/ }));

    const saving = screen.getByRole("button", { name: /Saving/ });
    expect(saving).toBeDisabled();
    expect(screen.getByLabelText("Type rōmaji")).toHaveValue("a");
    expect(screen.getByText("Correct")).toBeInTheDocument();
    expect(document.querySelector(".trainer-prompt > strong")).toHaveTextContent("あ");

    await act(async () => finishSave(null));

    const retry = await screen.findByRole("button", { name: /Try saving again/ });
    expect(retry).toBeEnabled();
    expect(screen.getByLabelText("Type rōmaji")).toHaveValue("a");
    expect(screen.getByText("Correct")).toBeInTheDocument();
    expect(document.querySelector(".trainer-prompt > strong")).toHaveTextContent("あ");
    await waitFor(() => expect(recordLearningAnswer).toHaveBeenCalledOnce());
    expect(recordLearningAnswer).toHaveBeenCalledWith(group.items[0].id, "recognition", "a", true, "typed");
  });

  it("does not expose kana mutations while authentication is restoring", () => {
    mocks.context = { ...mocks.context, authReady: false };
    render(<KanaLearningView />);

    expect(screen.getByText("Restoring your kana progress…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /recognition/i })).not.toBeInTheDocument();
    expect(startGroup).not.toHaveBeenCalled();
  });

  it("uses typed recognition without offering speech input", async () => {
    render(<KanaLearningView />);
    fireEvent.click(screen.getByRole("button", { name: /Continue recognition/ }));

    expect(await screen.findByLabelText("Type rōmaji")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /speak answer/i })).not.toBeInTheDocument();
  });

  it("shows the new vowels in order before switching to the shuffled mixed review", async () => {
    render(<KanaLearningView />);
    fireEvent.click(screen.getByRole("button", { name: /Continue recognition/ }));

    for (const expected of group.items) {
      await waitFor(() => expect(document.querySelector(".trainer-prompt > strong")).toHaveTextContent(expected.kana));
      expect(screen.getByText("Recognition · New row")).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText("Type rōmaji"), { target: { value: expected.romaji } });
      fireEvent.click(screen.getByRole("button", { name: "Check" }));
      fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
    }

    expect(await screen.findByText("Recognition · Mixed review")).toBeInTheDocument();
    expect(screen.getByText("5 remaining")).toBeInTheDocument();
  });

  it("reconfirms recall cards and opens a five-option grid when recall is practised again", async () => {
    let completed = startKanaGroup(structuredClone(emptyProgress), group);
    for (const item of group.items) {
      completed = reviewKanaLearning(completed, item.id, "recognition", true);
      completed = reviewKanaLearning(completed, item.id, "recognition", true);
    }
    completed = startKanaRecall(completed, group);
    for (const item of group.items) {
      completed = reviewKanaLearning(completed, item.id, "recall", true);
      completed = reviewKanaLearning(completed, item.id, "recall", true);
    }
    mocks.context = { ...mocks.context, progress: completed };

    render(<KanaLearningView />);
    fireEvent.click(screen.getByRole("button", { name: "Practise recall" }));

    await waitFor(() => expect(startRecall).toHaveBeenCalledWith(group));
    const choices = await waitFor(() => {
      const buttons = document.querySelectorAll(".kana-choice-grid button");
      expect(buttons).toHaveLength(5);
      return buttons;
    });
    expect([...choices].some((button) => button.textContent === group.items[0].kana)).toBe(true);
    expect(screen.queryByText("Preparing the next kana…")).not.toBeInTheDocument();
  });

  it("starts the first recall round immediately after recognition", async () => {
    let recognitionComplete = startKanaGroup(structuredClone(emptyProgress), group);
    for (const item of group.items) {
      recognitionComplete = reviewKanaLearning(recognitionComplete, item.id, "recognition", true);
      recognitionComplete = reviewKanaLearning(recognitionComplete, item.id, "recognition", true);
    }
    mocks.context = { ...mocks.context, progress: recognitionComplete };
    startRecall.mockImplementationOnce(async (target) => {
      mocks.context = { ...mocks.context, progress: startKanaRecall(recognitionComplete, target) };
      return true;
    });

    render(<KanaLearningView />);
    fireEvent.click(screen.getByRole("button", { name: "Start recall" }));

    expect(await screen.findByText("Recall · New row")).toBeInTheDocument();
    expect(document.querySelector(".trainer-prompt > strong")).toHaveTextContent(group.items[0].romaji);
    expect(document.querySelectorAll(".kana-choice-grid button")).toHaveLength(5);
    expect(screen.queryByText("Preparing the next kana…")).not.toBeInTheDocument();
  });
});
