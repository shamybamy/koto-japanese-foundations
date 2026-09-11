import { Direction, KanaScript, kanaById, kanaItems } from "@/lib/kana";
import { ProgressState, StoredCard } from "@/lib/progress";

export type PracticeScript = KanaScript | "both";
export type PracticeDirection = Direction | "mixed";

export type ReviewQueuePayload = {
  cards: StoredCard[];
  dueCount: number;
  newCount: number;
  serverTime: string;
};

export function cardMatchesPracticeFilters(
  card: Pick<StoredCard, "itemId" | "direction">,
  script: PracticeScript,
  direction: PracticeDirection,
) {
  const item = kanaById[card.itemId];
  return Boolean(
    item &&
    (script === "both" || item.script === script) &&
    (direction === "mixed" || card.direction === direction),
  );
}

/** Build the guest queue with the same due-first and global daily-limit rules as AWS. */
export function buildGuestReviewQueue(
  progress: ProgressState,
  script: PracticeScript,
  direction: PracticeDirection,
  now = new Date(),
): ReviewQueuePayload {
  const matches = (card: StoredCard) => cardMatchesPracticeFilters(card, script, direction);
  const due = Object.values(progress.cards)
    .filter((card) => card.reps > 0 && new Date(card.due) <= now && matches(card))
    .sort((left, right) => new Date(left.due).getTime() - new Date(right.due).getTime());

  const today = now.toISOString().slice(0, 10);
  const introducedToday = progress.dailyNew?.date === today ? progress.dailyNew.count : 0;
  const remainingNew = Math.max(0, 10 - introducedToday);
  const directions: Direction[] = direction === "mixed" ? ["recognition", "recall"] : [direction];
  const orderedNew = kanaItems.flatMap((item) => directions.map((cardDirection) =>
    progress.cards[`${item.id}:${cardDirection}`],
  )).filter((card): card is StoredCard => Boolean(card && card.reps === 0 && matches(card)));
  const newCards = orderedNew.slice(0, remainingNew);

  return {
    cards: [...due, ...newCards],
    dueCount: due.length,
    newCount: newCards.length,
    serverTime: now.toISOString(),
  };
}

export function reviewQueuePath(script: PracticeScript, direction: PracticeDirection) {
  const query = new URLSearchParams({ script, direction });
  return `reviews/queue?${query.toString()}`;
}
