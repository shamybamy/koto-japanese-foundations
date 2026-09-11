import { Card, Rating, State, createEmptyCard, fsrs, generatorParameters } from "ts-fsrs";
import { Direction, KanaGroup, KanaScript, kanaGroups, seededShuffle } from "@/lib/kana";

export type StoredCard = Omit<Card, "due" | "last_review"> & {
  due: string;
  last_review?: string;
  itemId: string;
  direction: Direction;
  streak: number;
  learningStreak?: number;
};

export type LessonResult = { bestScore: number; attempts: number; completed: boolean; completedAt?: string };
export type ReviewEntry = { id: string; itemId: string; direction: Direction; correct: boolean; rating: Rating; reviewedAt: string };

export type ProgressState = {
  lessons: Record<string, LessonResult>;
  cards: Record<string, StoredCard>;
  startedGroups: string[];
  recognitionGroups: string[];
  recallStartedGroups: string[];
  proficientGroups: string[];
  groupCompletedAt: Record<string, string>;
  reviews: ReviewEntry[];
  dailyNew: { date: string; count: number };
};

export const emptyProgress: ProgressState = {
  lessons: {}, cards: {}, startedGroups: [], recognitionGroups: [], recallStartedGroups: [], proficientGroups: [], groupCompletedAt: {}, reviews: [], dailyNew: { date: "", count: 0 },
};

const scheduler = fsrs(generatorParameters({ request_retention: 0.9 }));

export function cardKey(itemId: string, direction: Direction) {
  return `${itemId}:${direction}`;
}

function serializeCard(card: Card, itemId: string, direction: Direction, streak = 0, learningStreak = 0): StoredCard {
  return {
    ...card,
    itemId,
    direction,
    due: card.due.toISOString(),
    last_review: card.last_review?.toISOString(),
    streak,
    learningStreak,
  };
}

function hydrateCard(card: StoredCard): Card {
  return {
    ...card,
    due: new Date(card.due),
    last_review: card.last_review ? new Date(card.last_review) : undefined,
  };
}

export function startKanaGroup(state: ProgressState, group: KanaGroup): ProgressState {
  if (state.startedGroups.includes(group.id)) return state;
  const cards = { ...state.cards };
  const now = new Date();
  for (const item of group.items) {
    const key = cardKey(item.id, "recognition");
    if (!cards[key]) cards[key] = serializeCard(createEmptyCard(now), item.id, "recognition");
  }
  return { ...state, cards, startedGroups: [...state.startedGroups, group.id] };
}

export function startKanaRecall(state: ProgressState, group: KanaGroup): ProgressState {
  if (!groupDirectionIsProficient(state, group, "recognition")) return state;
  const cards = { ...state.cards };
  const now = new Date();
  for (const item of group.items) {
    const key = cardKey(item.id, "recall");
    if (!cards[key]) cards[key] = serializeCard(createEmptyCard(now), item.id, "recall");
  }
  const recallStartedGroups = (state.recallStartedGroups ?? []).includes(group.id)
    ? (state.recallStartedGroups ?? [])
    : [...(state.recallStartedGroups ?? []), group.id];
  return { ...state, cards, recallStartedGroups };
}

export function reviewKanaCard(
  state: ProgressState,
  itemId: string,
  direction: Direction,
  correct: boolean,
  ratingOverride?: Rating,
  now = new Date(),
): ProgressState {
  const key = cardKey(itemId, direction);
  const existing = state.cards[key] ?? serializeCard(createEmptyCard(now), itemId, direction);
  const rating = correct ? (ratingOverride ?? Rating.Good) : Rating.Again;
  const result = scheduler.next(
    hydrateCard(existing),
    now,
    rating as Rating.Again | Rating.Hard | Rating.Good | Rating.Easy,
  );
  const next = serializeCard(result.card, itemId, direction, correct ? existing.streak + 1 : 0, existing.learningStreak ?? existing.streak);
  const log: ReviewEntry = {
    id: `${now.toISOString()}-${itemId}-${direction}`,
    itemId, direction, correct, rating, reviewedAt: now.toISOString(),
  };
  const day = now.toISOString().slice(0, 10);
  const previousDailyNew = state.dailyNew?.date === day ? state.dailyNew.count : 0;
  return {
    ...state,
    cards: { ...state.cards, [key]: next },
    reviews: [log, ...state.reviews].slice(0, 100),
    dailyNew: existing.reps === 0 ? { date: day, count: previousDailyNew + 1 } : { date: day, count: previousDailyNew },
  };
}

export function reviewKanaLearning(
  state: ProgressState,
  itemId: string,
  direction: Direction,
  correct: boolean,
  now = new Date(),
): ProgressState {
  const key = cardKey(itemId, direction);
  const existing = state.cards[key] ?? serializeCard(createEmptyCard(now), itemId, direction);
  const learningStreak = existing.learningStreak ?? existing.streak;
  const cards = { ...state.cards, [key]: { ...existing, learningStreak: correct ? learningStreak + 1 : 0 } };
  const group = kanaGroups.find((candidate) => candidate.items.some((item) => item.id === itemId));
  const recognitionGroups = state.recognitionGroups ?? kanaGroups.filter((candidate) => candidate.items.every((item) =>
    ((state.cards[cardKey(item.id, "recognition")]?.learningStreak ?? state.cards[cardKey(item.id, "recognition")]?.streak) ?? 0) >= 2,
  )).map((candidate) => candidate.id);
  const reachedRecognition = Boolean(group && group.items.every((item) =>
    ((cards[cardKey(item.id, "recognition")]?.learningStreak ?? cards[cardKey(item.id, "recognition")]?.streak) ?? 0) >= 2,
  ));
  const reachedProficiency = Boolean(group && group.items.every((item) =>
    (["recognition", "recall"] as const).every((cardDirection) => ((cards[cardKey(item.id, cardDirection)]?.learningStreak ?? cards[cardKey(item.id, cardDirection)]?.streak) ?? 0) >= 2),
  ));
  const proficientGroups = state.proficientGroups ?? kanaGroups.filter((candidate) => candidate.items.every((item) =>
    (["recognition", "recall"] as const).every((cardDirection) => ((state.cards[cardKey(item.id, cardDirection)]?.learningStreak ?? state.cards[cardKey(item.id, cardDirection)]?.streak) ?? 0) >= 2),
  )).map((candidate) => candidate.id);
  const groupCompletedAt = reachedProficiency && group && !state.groupCompletedAt?.[group.id]
    ? { ...(state.groupCompletedAt ?? {}), [group.id]: now.toISOString() }
    : (state.groupCompletedAt ?? {});
  return {
    ...state,
    cards,
    recognitionGroups: reachedRecognition && group && !recognitionGroups.includes(group.id) ? [...recognitionGroups, group.id] : recognitionGroups,
    proficientGroups: reachedProficiency && group && !proficientGroups.includes(group.id) ? [...proficientGroups, group.id] : proficientGroups,
    groupCompletedAt,
  };
}

export function groupDirectionIsProficient(state: ProgressState, group: KanaGroup, direction: Direction) {
  if (direction === "recognition" && state.recognitionGroups !== undefined) return state.recognitionGroups.includes(group.id);
  if (direction === "recall" && state.proficientGroups !== undefined) return state.proficientGroups.includes(group.id);
  return group.items.every((item) => ((state.cards[cardKey(item.id, direction)]?.learningStreak ?? state.cards[cardKey(item.id, direction)]?.streak) ?? 0) >= 2);
}

export function groupIsProficient(state: ProgressState, group: KanaGroup) {
  if (state.proficientGroups !== undefined) return state.proficientGroups.includes(group.id);
  return group.items.every((item) => (["recognition", "recall"] as const).every((direction) => ((state.cards[cardKey(item.id, direction)]?.learningStreak ?? state.cards[cardKey(item.id, direction)]?.streak) ?? 0) >= 2));
}

export function groupIsAvailable(state: ProgressState, group: KanaGroup) {
  const scriptGroups = kanaGroups.filter((candidate) => candidate.script === group.script);
  const index = scriptGroups.findIndex((candidate) => candidate.id === group.id);
  return index === 0 || groupIsProficient(state, scriptGroups[index - 1]);
}

export function strengthLabel(card?: StoredCard) {
  if (!card || card.state === State.New || card.reps === 0) return "New";
  if (card.state === State.Learning || card.state === State.Relearning || card.stability < 2) return "Learning";
  if (card.stability < 14) return "Developing";
  return "Strong";
}

export function dueCards(state: ProgressState, now = new Date()) {
  return Object.values(state.cards)
    .filter((card) => new Date(card.due) <= now)
    .sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime());
}

export function scheduledReviewCards(state: ProgressState) {
  return Object.values(state.cards)
    .filter((card) => card.reps > 0)
    .sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime());
}

export function dueReviewCards(state: ProgressState, now = new Date()) {
  return scheduledReviewCards(state).filter((card) => new Date(card.due) <= now);
}

export function buildLearningQueue(state: ProgressState, group: KanaGroup, direction: Direction) {
  const currentIds = new Set(group.items.map((item) => item.id));
  return Object.values(state.cards).filter((card) => card.direction === direction && currentIds.has(card.itemId) && (card.learningStreak ?? card.streak) < 2);
}

export function buildLearningRounds(state: ProgressState, group: KanaGroup, direction: Direction, seed: string) {
  const firstPass = group.items.map((item) => cardKey(item.id, direction));
  const scriptGroups = kanaGroups.filter((candidate) => candidate.script === group.script);
  const currentIndex = scriptGroups.findIndex((candidate) => candidate.id === group.id);
  const previous = currentIndex <= 0 ? [] : scriptGroups
    .slice(0, currentIndex)
    .flatMap((candidate) => candidate.items)
    .map((item) => cardKey(item.id, direction))
    .filter((key) => Boolean(state.cards[key]));
  const shuffledCurrent = seededShuffle(firstPass, `${seed}-current`);
  const shuffledPrevious = seededShuffle(previous, `${seed}-previous`);
  const previousSample = shuffledPrevious.slice(0, 10);
  const mixedReview = seededShuffle(
    [...shuffledCurrent, ...previousSample],
    `${seed}-mixed`,
  );

  // A shuffle may legitimately reproduce the input order. Rotate a group's
  // review when there are no earlier cards so the second pass still feels shuffled.
  if (previousSample.length === 0 && mixedReview.length === firstPass.length && mixedReview.every((key, index) => key === firstPass[index])) {
    mixedReview.push(mixedReview.shift()!);
  }
  return { firstPass, mixedReview };
}

export function buildReviewQueue(state: ProgressState, script: KanaScript, direction: Direction, now = new Date()) {
  const itemIds = new Set(kanaGroups.filter((group) => group.script === script).flatMap((group) => group.items.map((item) => item.id)));
  const matches = (card: StoredCard) => card.direction === direction && itemIds.has(card.itemId);
  const due = dueReviewCards(state, now).filter(matches);
  const day = now.toISOString().slice(0, 10);
  const introducedToday = state.dailyNew?.date === day ? state.dailyNew.count : 0;
  const remainingNew = Math.max(0, 10 - introducedToday);
  const newCards = Object.values(state.cards).filter((card) => card.reps === 0 && matches(card)).slice(0, remainingNew);
  return [...due, ...newCards];
}

export function lessonUnlocked(state: ProgressState, trackSlug: string, lessonIndex: number, lessonSlugs: string[]) {
  if (lessonIndex === 0) return true;
  return Boolean(state.lessons[`${trackSlug}/${lessonSlugs[lessonIndex - 1]}`]?.completed);
}
