import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Rating } from "ts-fsrs";
import { DashboardView } from "@/components/dashboard-view";
import { kanaGroups } from "@/lib/kana";
import { emptyProgress, reviewKanaCard, startKanaGroup } from "@/lib/progress";

const mocks = vi.hoisted(() => ({
  context: {} as Record<string, unknown>,
}));

vi.mock("@/app/providers", () => ({ useProgress: () => mocks.context }));

function localProgress() {
  const group = kanaGroups[0];
  let progress = startKanaGroup(structuredClone(emptyProgress), group);
  progress = reviewKanaCard(
    progress,
    group.items[1].id,
    "recognition",
    false,
    Rating.Again,
    new Date("2000-01-01T00:00:00.000Z"),
  );
  return progress;
}

describe("DashboardView summary source", () => {
  const refreshDashboard = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(cleanup);

  it("refreshes and renders the server summary for a signed-in learner", async () => {
    mocks.context = {
      progress: localProgress(),
      isGuest: false,
      authReady: true,
      dashboardSummary: {
        reviewsDue: 7,
        newCardsAvailableToday: 3,
        recentActivity: [{
          type: "review",
          key: kanaGroups[2].items[0].id,
          at: "2026-09-09T10:00:00.000Z",
          correct: true,
        }],
      },
      dashboardServerTime: "2026-09-09T12:00:00.000Z",
      refreshDashboard,
    };

    render(<DashboardView />);

    await waitFor(() => expect(refreshDashboard).toHaveBeenCalledOnce());
    const metrics = screen.getByRole("region", { name: "Progress summary" });
    expect(within(metrics).getByText("Reviews due").closest("p")).toHaveTextContent("7");
    expect(within(metrics).getByText("New cards available").closest("p")).toHaveTextContent("3");
    expect(screen.getByRole("heading", { name: "7 cards due now" })).toBeInTheDocument();
    expect(screen.queryByText("Recent activity")).not.toBeInTheDocument();
    expect(screen.queryByText("い · i")).not.toBeInTheDocument();
  });

  it("uses local progress for a guest and does not request an authenticated refresh", () => {
    mocks.context = {
      progress: localProgress(),
      isGuest: true,
      authReady: true,
      dashboardSummary: null,
      dashboardServerTime: null,
      refreshDashboard,
    };

    render(<DashboardView />);

    const metrics = screen.getByRole("region", { name: "Progress summary" });
    expect(within(metrics).getByText("Reviews due").closest("p")).toHaveTextContent("1");
    expect(within(metrics).getByText("New cards available").closest("p")).toHaveTextContent("4");
    expect(screen.getByRole("heading", { name: "1 card due now" })).toBeInTheDocument();
    expect(screen.getByText("Kana overview")).toBeInTheDocument();
    expect(refreshDashboard).not.toHaveBeenCalled();
  });
});
