import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Providers, useProgress } from "@/app/providers";
import { kanaGroups } from "@/lib/kana";
import { emptyProgress, ProgressState, startKanaGroup } from "@/lib/progress";

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  configure: vi.fn(),
  currentUser: vi.fn(),
  attributes: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/aws", () => ({
  awsConfigured: true,
  configureAws: mocks.configure,
  authenticatedJson: mocks.api,
}));

vi.mock("aws-amplify/auth", () => ({
  getCurrentUser: mocks.currentUser,
  fetchUserAttributes: mocks.attributes,
  signOut: mocks.signOut,
}));

const fresh = (): ProgressState => structuredClone(emptyProgress);

function Probe() {
  const { learner, progress, authReady, completeLesson, recordLearningAnswer, refreshUser, signOutUser } = useProgress();
  return (
    <div>
      <span>{learner ? "signed-in" : "signed-out"}</span>
      <span>{authReady ? "auth-ready" : "auth-restoring"}</span>
      <output data-testid="progress">{JSON.stringify(progress)}</output>
      <button onClick={() => void completeLesson("sounds/vowels", 80, [1, 0, 1, 0, 0])}>Miss one answer</button>
      <button onClick={() => void completeLesson("sounds/vowels", 100, [1, 0, 1, 0, 1])}>Complete lesson</button>
      <button onClick={() => void recordLearningAnswer(kanaGroups[0].items[0].id, "recognition", "a", true)}>Answer kana</button>
      <button onClick={() => void refreshUser()}>Refresh user</button>
      <button onClick={() => void signOutUser()}>Sign out</button>
    </div>
  );
}

describe("progress provider cloud isolation", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
    mocks.currentUser.mockResolvedValue({ username: "account-user" });
    mocks.attributes.mockResolvedValue({ email: "learner@example.com" });
    mocks.signOut.mockResolvedValue(undefined);
  });

  afterEach(cleanup);

  it("does not write guest progress while a returning session is still being restored", async () => {
    let resolveUser: (value: { username: string }) => void = () => undefined;
    mocks.currentUser.mockReturnValueOnce(new Promise((resolve) => { resolveUser = resolve; }));
    mocks.api.mockResolvedValue({ progress: fresh() });

    render(<Providers><Probe /></Providers>);
    expect(screen.getByText("auth-restoring")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Complete lesson" }));
    fireEvent.click(screen.getByRole("button", { name: "Answer kana" }));

    expect(screen.getByTestId("progress")).not.toHaveTextContent("sounds/vowels");
    expect(sessionStorage.getItem("koto-guest-progress-v1")).toBeNull();

    await act(async () => resolveUser({ username: "account-user" }));
    await waitFor(() => expect(screen.getByText("auth-ready")).toBeInTheDocument());
    expect(screen.getByText("signed-in")).toBeInTheDocument();
    expect(sessionStorage.getItem("koto-guest-progress-v1")).toBeNull();
  });

  it("requires 100% for a guest to complete a lesson", async () => {
    mocks.currentUser.mockRejectedValue(new Error("Guest"));
    render(<Providers><Probe /></Providers>);
    await screen.findByText("auth-ready");
    fireEvent.click(screen.getByRole("button", { name: "Miss one answer" }));
    await waitFor(() => expect(JSON.parse(screen.getByTestId("progress").textContent!).lessons["sounds/vowels"]).toMatchObject({ bestScore: 80, completed: false }));
    fireEvent.click(screen.getByRole("button", { name: "Complete lesson" }));
    await waitFor(() => expect(JSON.parse(screen.getByTestId("progress").textContent!).lessons["sounds/vowels"]).toMatchObject({ bestScore: 100, completed: true }));
  });

  it("never writes account progress into guest session storage and clears state on sign-out", async () => {
    const guest = fresh();
    guest.lessons["sounds/vowels"] = { bestScore: 50, attempts: 1, completed: false };
    sessionStorage.setItem("koto-guest-progress-v1", JSON.stringify(guest));
    const account = fresh();
    account.lessons["sounds/vowels"] = { bestScore: 100, attempts: 2, completed: true };
    mocks.api.mockResolvedValue({ progress: account });

    render(<Providers><Probe /></Providers>);

    await waitFor(() => expect(screen.getByText("signed-in")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId("progress")).toHaveTextContent('"bestScore":100'));
    expect(sessionStorage.getItem("koto-guest-progress-v1")).toContain('"bestScore":50');
    expect(sessionStorage.getItem("koto-guest-progress-v1")).not.toContain('"bestScore":100');

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(screen.getByText("signed-out")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId("progress")).not.toHaveTextContent("sounds/vowels"));
    expect(sessionStorage.getItem("koto-guest-progress-v1")).not.toContain("sounds/vowels");
  });

  it("shows a rejected cloud write and restores the server-authoritative state", async () => {
    const account = fresh();
    mocks.api.mockImplementation(async (path: string) => {
      if (path === "lessons/check") throw new Error("The lesson is locked on the server.");
      return { progress: account };
    });

    render(<Providers><Probe /></Providers>);
    await waitFor(() => expect(screen.getByText("signed-in")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Complete lesson" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("not saved");
    expect(screen.getByRole("alert")).toHaveTextContent("locked on the server");
    await waitFor(() => expect(screen.getByTestId("progress")).not.toHaveTextContent("sounds/vowels"));
  });

  it("keeps a successful lesson save when the follow-up dashboard refresh fails", async () => {
    const account = fresh();
    let dashboardReads = 0;
    mocks.api.mockImplementation(async (path: string) => {
      if (path === "lessons/check") {
        return {
          score: 100,
          completed: true,
          bestScore: 100,
          lesson: { bestScore: 100, attempts: 1, completed: true, completedAt: "2026-09-09T12:00:00.000Z" },
          serverTime: "2026-09-09T12:00:00.000Z",
        };
      }
      dashboardReads += 1;
      if (dashboardReads === 1) return { progress: account };
      throw new Error("Dashboard temporarily unavailable.");
    });

    render(<Providers><Probe /></Providers>);
    await waitFor(() => expect(screen.getByText("signed-in")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Complete lesson" }));

    await waitFor(() => expect(screen.getByTestId("progress")).toHaveTextContent('"bestScore":100'));
    expect(await screen.findByRole("alert")).toHaveTextContent("was saved to AWS");
    expect(screen.getByRole("alert")).not.toHaveTextContent("not saved");
  });

  it("finishes sign-in when optional user attributes are temporarily unavailable", async () => {
    mocks.currentUser.mockRejectedValueOnce(new Error("No current session"));
    mocks.api.mockResolvedValue({ progress: fresh() });
    render(<Providers><Probe /></Providers>);
    await waitFor(() => expect(screen.getByText("auth-ready")).toBeInTheDocument());

    mocks.currentUser.mockResolvedValueOnce({ username: "account-user" });
    mocks.attributes.mockRejectedValueOnce(new Error("Attributes unavailable"));
    fireEvent.click(screen.getByRole("button", { name: "Refresh user" }));

    await waitFor(() => expect(screen.getByText("signed-in")).toBeInTheDocument());
    expect(screen.getByText("auth-ready")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("reuses a lesson idempotency key when an ambiguous save is retried", async () => {
    const account = fresh();
    let submissions = 0;
    mocks.api.mockImplementation(async (path: string) => {
      if (path === "lessons/check") {
        submissions += 1;
        if (submissions === 1) throw new Error("The response was interrupted.");
        return { score: 100, completed: true, bestScore: 100 };
      }
      return { progress: account };
    });

    render(<Providers><Probe /></Providers>);
    await waitFor(() => expect(screen.getByText("signed-in")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Complete lesson" }));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Complete lesson" }));
    await waitFor(() => expect(submissions).toBe(2));

    const requests = mocks.api.mock.calls.filter(([path]) => path === "lessons/check");
    const first = JSON.parse(String(requests[0][1]?.body)) as { clientLessonId: string };
    const second = JSON.parse(String(requests[1][1]?.body)) as { clientLessonId: string };
    expect(first.clientLessonId).toBe(second.clientLessonId);
  });

  it("does not present a rejected kana answer as saved", async () => {
    const account = startKanaGroup(fresh(), kanaGroups[0]);
    const cardKey = `${kanaGroups[0].items[0].id}:recognition`;
    mocks.api.mockImplementation(async (path: string) => {
      if (path === "kana/learn") throw new Error("The answer could not be stored.");
      return { progress: account };
    });

    render(<Providers><Probe /></Providers>);
    await waitFor(() => expect(screen.getByText("signed-in")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Answer kana" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("not saved");
    await waitFor(() => {
      const saved = JSON.parse(screen.getByTestId("progress").textContent ?? "{}") as ProgressState;
      expect(saved.cards[cardKey].learningStreak).toBe(0);
    });
  });

  it("reuses a learning-answer idempotency key after an interrupted response", async () => {
    const account = startKanaGroup(fresh(), kanaGroups[0]);
    const item = kanaGroups[0].items[0];
    const card = account.cards[`${item.id}:recognition`];
    let submissions = 0;
    mocks.api.mockImplementation(async (path: string) => {
      if (path === "kana/learn") {
        submissions += 1;
        if (submissions === 1) throw new Error("The response was interrupted.");
        return {
          correct: true,
          learningStreak: 1,
          recognitionComplete: false,
          groupComplete: false,
          card: { ...card, learningStreak: 1 },
          serverTime: "2026-09-09T12:00:00.000Z",
        };
      }
      return { progress: account };
    });

    render(<Providers><Probe /></Providers>);
    await waitFor(() => expect(screen.getByText("signed-in")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Answer kana" }));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Answer kana" }));
    await waitFor(() => expect(submissions).toBe(2));

    const requests = mocks.api.mock.calls.filter(([path]) => path === "kana/learn");
    const first = JSON.parse(String(requests[0][1]?.body)) as { clientLearningId: string };
    const second = JSON.parse(String(requests[1][1]?.body)) as { clientLearningId: string };
    expect(first.clientLearningId).toBe(second.clientLearningId);
  });
});
