"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Rating } from "ts-fsrs";
import { ApiRequestError, authenticatedJson, awsConfigured, configureAws } from "@/lib/aws";
import { Direction, KanaGroup, kanaGroups } from "@/lib/kana";
import { PracticeDirection, PracticeScript, ReviewQueuePayload, reviewQueuePath } from "@/lib/practice-queue";
import { emptyProgress, LessonResult, ProgressState, ReviewEntry, StoredCard, reviewKanaCard, reviewKanaLearning, startKanaGroup, startKanaRecall } from "@/lib/progress";

type Learner = { username: string; email?: string } | null;
type LessonSubmission = { score: number; completed: boolean; bestScore: number };
type CloudLessonSubmission = LessonSubmission & { lesson?: LessonResult; serverTime?: string };
type LearningSubmission = {
  correct: boolean;
  learningStreak: number;
  recognitionComplete: boolean;
  groupComplete: boolean;
};
type CloudLearningSubmission = LearningSubmission & {
  card: StoredCard;
  serverTime: string;
};
type ReviewSubmission = { correct: boolean; expected?: string; rating: Rating; serverTime: string };
type ReviewRejection = { rejected: true; code: string; message: string };
type ReviewResult = ReviewSubmission | ReviewRejection;
type CloudGroupSubmission = {
  started: boolean;
  recognitionComplete: boolean;
  recallStarted: boolean;
  proficient: boolean;
  cards: StoredCard[];
  serverTime: string;
};
type DashboardActivity = { type: "lesson" | "kana" | "review"; key: string; at: string; correct?: boolean };
type DashboardSummary = { reviewsDue: number; newCardsAvailableToday: number; recentActivity: DashboardActivity[] };

type ProgressContextValue = {
  progress: ProgressState;
  learner: Learner;
  authReady: boolean;
  isGuest: boolean;
  cloudPending: boolean;
  syncError: string | null;
  dashboardSummary: DashboardSummary | null;
  dashboardServerTime: string | null;
  refreshDashboard: () => Promise<void>;
  completeLesson: (key: string, score: number, answers?: number[]) => Promise<LessonSubmission | null>;
  startGroup: (group: KanaGroup) => Promise<boolean>;
  startRecall: (group: KanaGroup) => Promise<boolean>;
  recordLearningAnswer: (itemId: string, direction: Direction, answer: string, correct: boolean, inputMode?: "typed" | "grid") => Promise<LearningSubmission | null>;
  reviewCard: (itemId: string, direction: Direction, answer: string, correct: boolean, rating?: Rating, inputMode?: "typed" | "grid", responseMs?: number, clientReviewId?: string) => Promise<ReviewResult | null>;
  loadReviewQueue: (script: PracticeScript, direction: PracticeDirection) => Promise<ReviewQueuePayload | null>;
  refreshUser: () => Promise<void>;
  signOutUser: () => Promise<void>;
};

const ProgressContext = createContext<ProgressContextValue | null>(null);
const STORAGE_KEY = "koto-guest-progress-v1";

function freshProgress(): ProgressState {
  return {
    ...emptyProgress,
    lessons: {},
    cards: {},
    startedGroups: [],
    recognitionGroups: [],
    recallStartedGroups: [],
    proficientGroups: [],
    groupCompletedAt: {},
    reviews: [],
    dailyNew: { ...emptyProgress.dailyNew },
  };
}

function normalizeProgress(value: unknown): ProgressState {
  if (!value || typeof value !== "object") return freshProgress();
  const candidate = value as Partial<ProgressState>;
  return {
    ...freshProgress(),
    ...candidate,
    lessons: candidate.lessons && typeof candidate.lessons === "object" ? candidate.lessons : {},
    cards: candidate.cards && typeof candidate.cards === "object" ? candidate.cards : {},
    startedGroups: Array.isArray(candidate.startedGroups) ? candidate.startedGroups : [],
    recognitionGroups: Array.isArray(candidate.recognitionGroups) ? candidate.recognitionGroups : [],
    recallStartedGroups: Array.isArray(candidate.recallStartedGroups) ? candidate.recallStartedGroups : [],
    proficientGroups: Array.isArray(candidate.proficientGroups) ? candidate.proficientGroups : [],
    groupCompletedAt: candidate.groupCompletedAt && typeof candidate.groupCompletedAt === "object" ? candidate.groupCompletedAt : {},
    reviews: Array.isArray(candidate.reviews) ? candidate.reviews : [],
    dailyNew: candidate.dailyNew && typeof candidate.dailyNew === "object"
      ? candidate.dailyNew
      : { ...emptyProgress.dailyNew },
  };
}

function readGuestProgress() {
  const stored = sessionStorage.getItem(STORAGE_KEY);
  if (!stored) return freshProgress();
  try {
    return normalizeProgress(JSON.parse(stored));
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
    return freshProgress();
  }
}

function messageFor(error: unknown) {
  return error instanceof Error ? error.message : "Koto could not save your latest change.";
}

function normalizeDashboardSummary(value: unknown): DashboardSummary | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<DashboardSummary>;
  if (!Number.isFinite(candidate.reviewsDue) || !Number.isFinite(candidate.newCardsAvailableToday) || !Array.isArray(candidate.recentActivity)) return null;
  const recentActivity = candidate.recentActivity.filter((activity): activity is DashboardActivity => Boolean(
    activity &&
    ["lesson", "kana", "review"].includes(activity.type) &&
    typeof activity.key === "string" &&
    typeof activity.at === "string",
  ));
  return {
    reviewsDue: Math.max(0, Number(candidate.reviewsDue)),
    newCardsAvailableToday: Math.max(0, Number(candidate.newCardsAvailableToday)),
    recentActivity,
  };
}

function includeGroup(groups: string[], groupId: string, included: boolean) {
  return included && !groups.includes(groupId) ? [...groups, groupId] : groups;
}

function applyCloudGroup(current: ProgressState, group: KanaGroup, result: CloudGroupSubmission) {
  const cards = { ...current.cards };
  for (const card of Array.isArray(result.cards) ? result.cards : []) {
    if (card && typeof card.itemId === "string" && (card.direction === "recognition" || card.direction === "recall")) {
      cards[`${card.itemId}:${card.direction}`] = card;
    }
  }
  return {
    ...current,
    cards,
    startedGroups: includeGroup(current.startedGroups, group.id, Boolean(result.started)),
    recognitionGroups: includeGroup(current.recognitionGroups, group.id, Boolean(result.recognitionComplete)),
    recallStartedGroups: includeGroup(current.recallStartedGroups, group.id, Boolean(result.recallStarted)),
    proficientGroups: includeGroup(current.proficientGroups, group.id, Boolean(result.proficient)),
    groupCompletedAt: result.proficient && !current.groupCompletedAt[group.id]
      ? { ...current.groupCompletedAt, [group.id]: result.serverTime }
      : current.groupCompletedAt,
  };
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [progress, setProgress] = useState<ProgressState>(freshProgress);
  const [learner, setLearner] = useState<Learner>(null);
  const [authReady, setAuthReady] = useState(false);
  const [cloudOperations, setCloudOperations] = useState(0);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
  const [dashboardServerTime, setDashboardServerTime] = useState<string | null>(null);
  const authGeneration = useRef(0);
  const cloudTail = useRef<Promise<void>>(Promise.resolve());
  const lessonOperationIds = useRef(new Map<string, string>());
  const learningOperationIds = useRef(new Map<string, string>());

  const loadCloudProgress = useCallback(async (generation = authGeneration.current) => {
    const payload = await authenticatedJson<{ progress?: unknown; summary?: unknown; serverTime?: unknown }>("dashboard");
    if (!payload.progress || typeof payload.progress !== "object") {
      throw new Error("AWS returned an invalid progress response.");
    }
    const next = normalizeProgress(payload.progress);
    if (generation === authGeneration.current) {
      setProgress(next);
      setDashboardSummary(normalizeDashboardSummary(payload.summary));
      setDashboardServerTime(typeof payload.serverTime === "string" ? payload.serverTime : null);
    }
    return next;
  }, []);

  const enqueueCloud = useCallback(<T,>(
    operation: (generation: number) => Promise<T>,
    options: { failurePrefix?: string; reconcile?: boolean } = {},
  ): Promise<T | null> => {
    const generation = authGeneration.current;
    const run = async () => {
      if (generation !== authGeneration.current) return null;
      setCloudOperations((count) => count + 1);
      setSyncError(null);
      try {
        const result = await operation(generation);
        return result;
      } catch (error) {
        if (generation === authGeneration.current) {
          setSyncError(`${options.failurePrefix ?? "Your latest change was not saved."} ${messageFor(error)}`);
          if (options.reconcile !== false) {
            try {
              await loadCloudProgress(generation);
            } catch {
              // Keep the visible error and the last known state when AWS is unavailable.
            }
          }
        }
        return null;
      } finally {
        if (generation === authGeneration.current) setCloudOperations((count) => Math.max(0, count - 1));
      }
    };
    const task = cloudTail.current.then(run, run);
    cloudTail.current = task.then(() => undefined, () => undefined);
    return task;
  }, [loadCloudProgress]);

  const refreshAfterSave = useCallback(async (generation: number) => {
    try {
      await loadCloudProgress(generation);
    } catch (error) {
      if (generation === authGeneration.current) {
        setSyncError(`Your change was saved to AWS, but Koto could not refresh all progress. Reload before continuing. ${messageFor(error)}`);
      }
    }
  }, [loadCloudProgress]);

  useEffect(() => {
    let cancelled = false;
    const generation = ++authGeneration.current;
    lessonOperationIds.current.clear();
    learningOperationIds.current.clear();

    async function initialize() {
      configureAws();
      if (!awsConfigured) {
        if (!cancelled) {
          setProgress(readGuestProgress());
          setDashboardSummary(null);
          setDashboardServerTime(null);
          setAuthReady(true);
        }
        return;
      }

      const { getCurrentUser, fetchUserAttributes } = await import("aws-amplify/auth");
      let user: Awaited<ReturnType<typeof getCurrentUser>>;
      try {
        user = await getCurrentUser();
      } catch {
        if (!cancelled && generation === authGeneration.current) {
          setLearner(null);
          setProgress(readGuestProgress());
          setDashboardSummary(null);
          setDashboardServerTime(null);
          setAuthReady(true);
        }
        return;
      }

      let email: string | undefined;
      try {
        email = (await fetchUserAttributes()).email;
      } catch {
        // Progress still belongs to the authenticated Cognito identity even if
        // its optional profile attributes cannot be fetched temporarily.
      }
      if (cancelled || generation !== authGeneration.current) return;
      setLearner({ username: user.username, email });
      setProgress(freshProgress());
      setDashboardSummary(null);
      setDashboardServerTime(null);
      try {
        await loadCloudProgress(generation);
        if (!cancelled && generation === authGeneration.current) setSyncError(null);
      } catch (error) {
        if (!cancelled && generation === authGeneration.current) {
          setSyncError(`Your saved progress could not be loaded. ${messageFor(error)}`);
        }
      } finally {
        if (!cancelled && generation === authGeneration.current) setAuthReady(true);
      }
    }

    void initialize();
    return () => { cancelled = true; };
  }, [loadCloudProgress]);

  useEffect(() => {
    if (authReady && !learner) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }, [progress, authReady, learner]);

  const completeLesson = useCallback(async (key: string, score: number, answers?: number[]) => {
    if (!authReady) {
      setSyncError("Koto is still restoring your sign-in session. Please wait before saving an answer.");
      return null;
    }
    const applyLocalResult = () => setProgress((current) => {
      const previous = current.lessons[key];
      const result: LessonResult = {
        bestScore: Math.max(previous?.bestScore ?? 0, score),
        attempts: (previous?.attempts ?? 0) + 1,
        completed: Boolean(previous?.completed || score === 100),
        completedAt: previous?.completedAt ?? (score === 100 ? new Date().toISOString() : undefined),
      };
      return { ...current, lessons: { ...current.lessons, [key]: result } };
    });
    if (!learner) {
      applyLocalResult();
      return { score, completed: score === 100, bestScore: score };
    }
    if (!answers) {
      setSyncError("Your lesson result was not saved because its answers were missing.");
      return null;
    }
    const operationFingerprint = JSON.stringify([key, answers]);
    const clientLessonId = lessonOperationIds.current.get(operationFingerprint) ?? crypto.randomUUID();
    lessonOperationIds.current.set(operationFingerprint, clientLessonId);
    return enqueueCloud(async (generation) => {
      const result = await authenticatedJson<CloudLessonSubmission>("lessons/check", {
        method: "POST",
        body: JSON.stringify({ lessonKey: key, answers, clientLessonId }),
      });
      lessonOperationIds.current.delete(operationFingerprint);
      const savedResult: LessonSubmission = {
        score: Number.isFinite(result.score) ? result.score : score,
        completed: Boolean(result.completed),
        bestScore: Number.isFinite(result.bestScore) ? result.bestScore : score,
      };
      if (generation === authGeneration.current) {
        setProgress((current) => {
          const previous = current.lessons[key];
          const serverLesson = result.lesson;
          const lessonResult: LessonResult = serverLesson && Number.isFinite(serverLesson.bestScore) && Number.isFinite(serverLesson.attempts)
            ? serverLesson
            : {
                bestScore: savedResult.bestScore,
                attempts: (previous?.attempts ?? 0) + 1,
                completed: Boolean(previous?.completed || savedResult.completed),
                completedAt: previous?.completedAt ?? (savedResult.completed ? result.serverTime ?? new Date().toISOString() : undefined),
              };
          return { ...current, lessons: { ...current.lessons, [key]: lessonResult } };
        });
      }
      await refreshAfterSave(generation);
      return savedResult;
    });
  }, [authReady, learner, enqueueCloud, refreshAfterSave]);

  const startGroup = useCallback(async (group: KanaGroup) => {
    if (!authReady) {
      setSyncError("Koto is still restoring your sign-in session. Please wait before starting a kana group.");
      return false;
    }
    if (!learner) {
      setProgress((current) => startKanaGroup(current, group));
      return true;
    }
    const result = await enqueueCloud(async (generation) => {
      const response = await authenticatedJson<CloudGroupSubmission>(`kana/groups/${encodeURIComponent(group.id)}/start`, {
        method: "POST",
        body: JSON.stringify({ phase: "recognition" }),
      });
      if (generation === authGeneration.current) setProgress((current) => applyCloudGroup(current, group, response));
      await refreshAfterSave(generation);
      return true;
    });
    return result ?? false;
  }, [authReady, learner, enqueueCloud, refreshAfterSave]);

  const startRecall = useCallback(async (group: KanaGroup) => {
    if (!authReady) {
      setSyncError("Koto is still restoring your sign-in session. Please wait before starting kana recall.");
      return false;
    }
    if (!learner) {
      setProgress((current) => startKanaRecall(current, group));
      return true;
    }
    const result = await enqueueCloud(async (generation) => {
      const response = await authenticatedJson<CloudGroupSubmission>(`kana/groups/${encodeURIComponent(group.id)}/start`, {
        method: "POST",
        body: JSON.stringify({ phase: "recall" }),
      });
      if (generation === authGeneration.current) setProgress((current) => applyCloudGroup(current, group, response));
      await refreshAfterSave(generation);
      return true;
    });
    return result ?? false;
  }, [authReady, learner, enqueueCloud, refreshAfterSave]);

  const recordLearningAnswer = useCallback(async (
    itemId: string,
    direction: Direction,
    answer: string,
    correct: boolean,
    inputMode: "typed" | "grid" = "typed",
  ) => {
    if (!authReady) {
      setSyncError("Koto is still restoring your sign-in session. Please wait before saving an answer.");
      return null;
    }
    if (!learner) {
      setProgress((current) => reviewKanaLearning(current, itemId, direction, correct));
      return { correct, learningStreak: 0, recognitionComplete: false, groupComplete: false };
    }

    const operationFingerprint = JSON.stringify([itemId, direction, answer, inputMode]);
    const clientLearningId = learningOperationIds.current.get(operationFingerprint) ?? crypto.randomUUID();
    learningOperationIds.current.set(operationFingerprint, clientLearningId);
    return enqueueCloud(async (generation) => {
      const result = await authenticatedJson<CloudLearningSubmission>("kana/learn", {
        method: "POST",
        body: JSON.stringify({ itemId, direction, answer, inputMode, clientLearningId }),
      });
      if (
        typeof result.correct !== "boolean" ||
        !Number.isFinite(result.learningStreak) ||
        !result.card ||
        typeof result.card !== "object" ||
        typeof result.card.due !== "string" ||
        !Number.isFinite(result.card.reps) ||
        typeof result.serverTime !== "string"
      ) {
        throw new Error("AWS returned an invalid kana-learning response.");
      }
      if (generation === authGeneration.current) {
        const group = kanaGroups.find((candidate) => candidate.items.some((item) => item.id === itemId));
        const key = `${itemId}:${direction}`;
        setProgress((current) => {
          const recognitionGroups = result.recognitionComplete && group && !current.recognitionGroups.includes(group.id)
            ? [...current.recognitionGroups, group.id]
            : current.recognitionGroups;
          const proficientGroups = result.groupComplete && group && !current.proficientGroups.includes(group.id)
            ? [...current.proficientGroups, group.id]
            : current.proficientGroups;
          const groupCompletedAt = result.groupComplete && group && !current.groupCompletedAt[group.id]
            ? { ...current.groupCompletedAt, [group.id]: result.serverTime }
            : current.groupCompletedAt;
          return {
            ...current,
            cards: { ...current.cards, [key]: { ...result.card, itemId, direction, learningStreak: result.learningStreak } },
            recognitionGroups,
            proficientGroups,
            groupCompletedAt,
          };
        });
      }
      learningOperationIds.current.delete(operationFingerprint);
      return result;
    }, { failurePrefix: "Your kana answer was not saved.", reconcile: false });
  }, [authReady, learner, enqueueCloud]);

  const reviewCard = useCallback(async (
    itemId: string,
    direction: Direction,
    answer: string,
    correct: boolean,
    rating?: Rating,
    inputMode: "typed" | "grid" = "typed",
    responseMs?: number,
    suppliedClientReviewId?: string,
  ) => {
    if (!authReady) {
      setSyncError("Koto is still restoring your sign-in session. Please wait before saving a review.");
      return null;
    }
    if (!learner) {
      setProgress((current) => reviewKanaCard(current, itemId, direction, correct, rating));
      return { correct, rating: correct ? (rating ?? Rating.Good) : Rating.Again, serverTime: new Date().toISOString() };
    }

    const clientReviewId = suppliedClientReviewId ?? crypto.randomUUID();
    return enqueueCloud(async (generation) => {
      let result: ReviewSubmission & { card: Omit<StoredCard, "itemId" | "direction"> };
      try {
        result = await authenticatedJson("reviews/submit", {
          method: "POST",
          body: JSON.stringify({
            itemId,
            direction,
            answer,
            rating,
            inputMode,
            responseMs: Math.min(60 * 60 * 1000, Math.max(0, Math.round(responseMs ?? 0))),
            clientReviewId,
          }),
        });
      } catch (error) {
        const definitiveCodes = new Set(["CARD_NOT_DUE", "STALE_CARD", "DAILY_NEW_LIMIT_REACHED", "CARD_LOCKED", "IDEMPOTENCY_KEY_REUSED"]);
        if (error instanceof ApiRequestError && error.status === 409 && error.code && definitiveCodes.has(error.code)) {
          return { rejected: true, code: error.code, message: error.message } satisfies ReviewRejection;
        }
        throw error;
      }
      if (
        typeof result.correct !== "boolean" ||
        ![Rating.Again, Rating.Hard, Rating.Good, Rating.Easy].includes(result.rating) ||
        typeof result.serverTime !== "string" ||
        !result.card ||
        typeof result.card !== "object" ||
        typeof result.card.due !== "string" ||
        !Number.isFinite(result.card.reps)
      ) {
        throw new Error("AWS returned an invalid review response.");
      }
      if (generation === authGeneration.current) {
        const nextCard: StoredCard = { ...result.card, itemId, direction };
        const reviewedAt = result.serverTime;
        const review: ReviewEntry = {
          id: `${reviewedAt}#${clientReviewId}`,
          itemId,
          direction,
          correct: result.correct,
          rating: result.rating,
          reviewedAt,
        };
        setProgress((current) => {
          const wasNew = (current.cards[`${itemId}:${direction}`]?.reps ?? 0) === 0;
          const day = reviewedAt.slice(0, 10);
          const previousCount = current.dailyNew.date === day ? current.dailyNew.count : 0;
          return {
            ...current,
            cards: { ...current.cards, [`${itemId}:${direction}`]: nextCard },
            reviews: [review, ...current.reviews].slice(0, 100),
            dailyNew: { date: day, count: previousCount + (wasNew ? 1 : 0) },
          };
        });
      }
      return result;
    });
  }, [authReady, learner, enqueueCloud]);

  const loadReviewQueue = useCallback(async (script: PracticeScript, direction: PracticeDirection) => {
    if (!authReady || !learner) return null;
    return enqueueCloud(async () => {
      const result = await authenticatedJson<ReviewQueuePayload>(reviewQueuePath(script, direction));
      if (
        !Array.isArray(result.cards) ||
        typeof result.dueCount !== "number" ||
        typeof result.newCount !== "number" ||
        typeof result.serverTime !== "string"
      ) {
        throw new Error("AWS returned an invalid review queue.");
      }
      return result;
    }, { failurePrefix: "Your review queue could not be loaded.", reconcile: false });
  }, [authReady, learner, enqueueCloud]);

  const refreshDashboard = useCallback(async () => {
    if (!authReady || !learner) return;
    await enqueueCloud(async (generation) => {
      await loadCloudProgress(generation);
    }, { failurePrefix: "Your dashboard could not be refreshed.", reconcile: false });
  }, [authReady, learner, enqueueCloud, loadCloudProgress]);

  const refreshUser = useCallback(async () => {
    if (!awsConfigured) return;
    setAuthReady(false);
    try {
      configureAws();
      const { getCurrentUser, fetchUserAttributes } = await import("aws-amplify/auth");
      const user = await getCurrentUser();
      let email: string | undefined;
      try {
        email = (await fetchUserAttributes()).email;
      } catch {
        // The Cognito identity is sufficient to load partitioned progress. A
        // temporary profile-attribute failure must not undo a completed sign-in.
      }
      const generation = ++authGeneration.current;
      lessonOperationIds.current.clear();
      learningOperationIds.current.clear();
      setLearner({ username: user.username, email });
      setProgress(freshProgress());
      setDashboardSummary(null);
      setDashboardServerTime(null);
      setSyncError(null);
      await loadCloudProgress(generation);
    } catch (error) {
      setSyncError(`Your saved progress could not be loaded. ${messageFor(error)}`);
      throw error;
    } finally {
      setAuthReady(true);
    }
  }, [loadCloudProgress]);

  const signOutUser = useCallback(async () => {
    if (awsConfigured) {
      const { signOut } = await import("aws-amplify/auth");
      try {
        await signOut();
      } catch (error) {
        setSyncError(`Koto could not sign you out. ${messageFor(error)}`);
        return;
      }
    }
    authGeneration.current += 1;
    cloudTail.current = Promise.resolve();
    lessonOperationIds.current.clear();
    learningOperationIds.current.clear();
    sessionStorage.removeItem(STORAGE_KEY);
    setLearner(null);
    setProgress(freshProgress());
    setDashboardSummary(null);
    setDashboardServerTime(null);
    setCloudOperations(0);
    setSyncError(null);
  }, []);

  const value = useMemo(() => ({
    progress,
    learner,
    authReady,
    isGuest: authReady && !learner,
    cloudPending: cloudOperations > 0,
    syncError,
    dashboardSummary,
    dashboardServerTime,
    refreshDashboard,
    completeLesson,
    startGroup,
    startRecall,
    recordLearningAnswer,
    reviewCard,
    loadReviewQueue,
    refreshUser,
    signOutUser,
  }), [progress, learner, authReady, cloudOperations, syncError, dashboardSummary, dashboardServerTime, refreshDashboard, completeLesson, startGroup, startRecall, recordLearningAnswer, reviewCard, loadReviewQueue, refreshUser, signOutUser]);

  return (
    <ProgressContext.Provider value={value}>
      {syncError && <div className="guest-banner" role="alert">{syncError}</div>}
      {children}
    </ProgressContext.Provider>
  );
}

export function useProgress() {
  const value = useContext(ProgressContext);
  if (!value) throw new Error("useProgress must be used within Providers");
  return value;
}
