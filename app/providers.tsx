"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Rating } from "ts-fsrs";
import { awsConfigured, configureAws } from "@/lib/aws";
import { authenticatedFetch } from "@/lib/aws";
import { KanaGroup, Direction } from "@/lib/kana";
import { emptyProgress, LessonResult, ProgressState, reviewKanaCard, reviewKanaLearning, startKanaGroup, startKanaRecall } from "@/lib/progress";

type Learner = { username: string; email?: string } | null;
type ProgressContextValue = {
  progress: ProgressState;
  learner: Learner;
  authReady: boolean;
  isGuest: boolean;
  completeLesson: (key: string, score: number, answers?: number[]) => void;
  startGroup: (group: KanaGroup) => void;
  startRecall: (group: KanaGroup) => void;
  recordLearningAnswer: (itemId: string, direction: Direction, answer: string, correct: boolean, inputMode?: "typed" | "voice" | "grid") => void;
  reviewCard: (itemId: string, direction: Direction, answer: string, correct: boolean, rating?: Rating, inputMode?: "typed" | "voice" | "grid") => void;
  refreshUser: () => Promise<void>;
  signOutUser: () => Promise<void>;
};

const ProgressContext = createContext<ProgressContextValue | null>(null);
const STORAGE_KEY = "koto-guest-progress-v1";

export function Providers({ children }: { children: React.ReactNode }) {
  const [progress, setProgress] = useState<ProgressState>(emptyProgress);
  const [learner, setLearner] = useState<Learner>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      try { setProgress(JSON.parse(stored)); } catch { sessionStorage.removeItem(STORAGE_KEY); }
    }
    configureAws();
    if (!awsConfigured) { setAuthReady(true); return; }
    import("aws-amplify/auth").then(async ({ getCurrentUser, fetchUserAttributes }) => {
      try {
        const user = await getCurrentUser();
        const attrs = await fetchUserAttributes();
        setLearner({ username: user.username, email: attrs.email });
        const cloud = await authenticatedFetch("dashboard");
        if (cloud.ok) {
          const payload = await cloud.json();
          if (payload.progress) setProgress(payload.progress);
        }
      } catch { setLearner(null); }
      setAuthReady(true);
    });
  }, []);

  useEffect(() => {
    if (authReady) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }, [progress, authReady]);

  const completeLesson = useCallback((key: string, score: number, answers?: number[]) => {
    setProgress((current) => {
      const previous = current.lessons[key];
      const result: LessonResult = {
        bestScore: Math.max(previous?.bestScore ?? 0, score),
        attempts: (previous?.attempts ?? 0) + 1,
        completed: Boolean(previous?.completed || score >= 80),
        completedAt: previous?.completedAt ?? (score >= 80 ? new Date().toISOString() : undefined),
      };
      return { ...current, lessons: { ...current.lessons, [key]: result } };
    });
    if (learner && answers) void authenticatedFetch("lessons/check", { method: "POST", body: JSON.stringify({ lessonKey: key, answers }) });
  }, [learner]);

  const startGroup = useCallback((group: KanaGroup) => {
    setProgress((current) => startKanaGroup(current, group));
    if (learner) void authenticatedFetch(`kana/groups/${group.id}/start`, { method: "POST", body: JSON.stringify({ phase: "recognition" }) });
  }, [learner]);
  const startRecall = useCallback((group: KanaGroup) => {
    setProgress((current) => startKanaRecall(current, group));
    if (learner) void authenticatedFetch(`kana/groups/${group.id}/start`, { method: "POST", body: JSON.stringify({ phase: "recall" }) });
  }, [learner]);
  const recordLearningAnswer = useCallback((itemId: string, direction: Direction, answer: string, correct: boolean, inputMode: "typed" | "voice" | "grid" = "typed") => {
    setProgress((current) => reviewKanaLearning(current, itemId, direction, correct));
    if (learner) void authenticatedFetch("kana/learn", { method: "POST", body: JSON.stringify({ itemId, direction, answer, inputMode, clientLearningId: crypto.randomUUID() }) });
  }, [learner]);
  const reviewCard = useCallback((itemId: string, direction: Direction, answer: string, correct: boolean, rating?: Rating, inputMode: "typed" | "voice" | "grid" = "typed") => {
    setProgress((current) => reviewKanaCard(current, itemId, direction, correct, rating));
    if (learner) void authenticatedFetch("reviews/submit", { method: "POST", body: JSON.stringify({ itemId, direction, answer, rating, inputMode, clientReviewId: crypto.randomUUID() }) });
  }, [learner]);

  const refreshUser = useCallback(async () => {
    if (!awsConfigured) return;
    const { getCurrentUser, fetchUserAttributes } = await import("aws-amplify/auth");
    const user = await getCurrentUser();
    const attrs = await fetchUserAttributes();
    setLearner({ username: user.username, email: attrs.email });
  }, []);

  const signOutUser = useCallback(async () => {
    if (awsConfigured) {
      const { signOut } = await import("aws-amplify/auth");
      await signOut();
    }
    setLearner(null);
  }, []);

  const value = useMemo(() => ({
    progress, learner, authReady, isGuest: !learner, completeLesson, startGroup, startRecall, recordLearningAnswer, reviewCard, refreshUser, signOutUser,
  }), [progress, learner, authReady, completeLesson, startGroup, startRecall, recordLearningAnswer, reviewCard, refreshUser, signOutUser]);

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress() {
  const value = useContext(ProgressContext);
  if (!value) throw new Error("useProgress must be used within Providers");
  return value;
}
