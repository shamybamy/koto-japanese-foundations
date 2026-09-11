import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PracticeView } from "@/components/practice-view";
import { kanaGroups } from "@/lib/kana";
import { emptyProgress, startKanaGroup } from "@/lib/progress";

const mocks = vi.hoisted(() => ({
  context: {} as Record<string, unknown>,
}));

vi.mock("@/app/providers", () => ({ useProgress: () => mocks.context }));

const progress = startKanaGroup(structuredClone(emptyProgress), kanaGroups[0]);
const card = progress.cards[`${kanaGroups[0].items[0].id}:recognition`];

describe("PracticeView cloud queue", () => {
  const loadReviewQueue = vi.fn();
  const reviewCard = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    loadReviewQueue.mockResolvedValue({
      cards: [card],
      dueCount: 0,
      newCount: 1,
      serverTime: "2026-09-09T12:00:00.000Z",
    });
    reviewCard.mockResolvedValue({ correct: true });
    mocks.context = {
      progress,
      reviewCard,
      loadReviewQueue,
      isGuest: false,
      authReady: true,
      cloudPending: false,
    };
  });

  afterEach(cleanup);

  it("requests Both and Mixed filters from the authenticated endpoint", async () => {
    render(<PracticeView />);
    await waitFor(() => expect(loadReviewQueue).toHaveBeenCalledWith("hiragana", "recognition"));

    fireEvent.click(screen.getByRole("button", { name: "Both" }));
    await waitFor(() => expect(loadReviewQueue).toHaveBeenCalledWith("both", "recognition"));
    fireEvent.click(screen.getByRole("button", { name: "Mixed" }));
    await waitFor(() => expect(loadReviewQueue).toHaveBeenCalledWith("both", "mixed"));
  });

  it("uses typed recognition without offering speech input", async () => {
    render(<PracticeView />);

    expect(await screen.findByLabelText("Rōmaji answer")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /speak answer/i })).not.toBeInTheDocument();
  });

  it("records response time and reuses the idempotency key after a failed save", async () => {
    reviewCard.mockResolvedValueOnce(null).mockResolvedValueOnce({ correct: true });
    render(<PracticeView />);
    await screen.findByText("あ");

    fireEvent.change(screen.getByLabelText("Rōmaji answer"), { target: { value: "a" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    fireEvent.click(screen.getByRole("button", { name: "Good" }));
    await screen.findByText(/That answer was not saved/);
    fireEvent.click(screen.getByRole("button", { name: "Good" }));

    await waitFor(() => expect(reviewCard).toHaveBeenCalledTimes(2));
    const first = reviewCard.mock.calls[0];
    const second = reviewCard.mock.calls[1];
    expect(first[6]).toEqual(expect.any(Number));
    expect(first[6]).toBeGreaterThanOrEqual(0);
    expect(first[7]).toEqual(expect.any(String));
    expect(first[7]).not.toBe("");
    expect(second[6]).toBe(first[6]);
    expect(second[7]).toBe(first[7]);
  });

  it("refreshes past a card rejected as stale instead of offering an endless retry", async () => {
    reviewCard.mockResolvedValueOnce({ rejected: true, code: "CARD_NOT_DUE", message: "This card is not due yet." });
    loadReviewQueue
      .mockResolvedValueOnce({ cards: [card], dueCount: 1, newCount: 0, serverTime: "2026-09-09T12:00:00.000Z" })
      .mockResolvedValueOnce({ cards: [], dueCount: 0, newCount: 0, serverTime: "2026-09-09T12:00:01.000Z" });

    render(<PracticeView />);
    await screen.findByText("あ");
    fireEvent.change(screen.getByLabelText("Rōmaji answer"), { target: { value: "a" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    fireEvent.click(screen.getByRole("button", { name: "Good" }));

    expect(await screen.findByRole("status")).toHaveTextContent("schedule has been refreshed");
    await waitFor(() => expect(loadReviewQueue).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("button", { name: /Try saving again/ })).not.toBeInTheDocument();
    expect(screen.getByText("Nothing due here")).toBeInTheDocument();
  });
});
