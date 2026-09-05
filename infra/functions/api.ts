import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand, TransactWriteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { Rating, State, createEmptyCard, fsrs, generatorParameters } from "ts-fsrs";
import { toRomaji } from "wanakana";
import { isRomajiAnswer, kanaById, kanaGroups } from "../../lib/kana";

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } });
const scheduler = fsrs(generatorParameters({ request_retention: 0.9 }));
const learnerTable = process.env.LEARNER_DATA_TABLE!;
const cardsTable = process.env.REVIEW_CARDS_TABLE!;
const logsTable = process.env.REVIEW_LOGS_TABLE!;

const lessonAnswerKeys: Record<string, number[]> = {
  "sounds/vowels": [1,0], "sounds/consonants": [2,1], "sounds/special-timing": [0,1], "sounds/palatalization": [0,1],
  "prosody/mora": [1,0], "prosody/length": [1,1], "prosody/phrasing": [1,1],
  "pitch/pitch-not-stress": [0,1], "pitch/four-patterns": [0,1], "pitch/phrases": [1,1],
  "kana/how-kana-works": [1,1], "kana/hiragana-path": [1,1], "kana/katakana-path": [1,1],
};
const lessonOrder: Record<string, string[]> = {
  sounds: ["vowels", "consonants", "special-timing", "palatalization"],
  prosody: ["mora", "length", "phrasing"],
  pitch: ["pitch-not-stress", "four-patterns", "phrases"],
  kana: ["how-kana-works", "hiragana-path", "katakana-path"],
};

const response = (statusCode: number, body: unknown): APIGatewayProxyResult => ({
  statusCode,
  headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
  body: JSON.stringify(body),
});

function userId(event: APIGatewayProxyEvent) {
  return event.requestContext.authorizer?.claims?.sub as string | undefined;
}

function bodyOf(event: APIGatewayProxyEvent): Record<string, unknown> {
  try { return JSON.parse(event.body ?? "{}"); } catch { return {}; }
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const user = userId(event);
  if (!user) return response(401, { error: "Unauthorized" });
  const path = event.resource;
  try {
    if (event.httpMethod === "GET" && path === "/dashboard") return dashboard(user);
    if (event.httpMethod === "GET" && path === "/reviews/queue") return queue(user, event);
    if (event.httpMethod === "POST" && path === "/reviews/submit") return submitReview(user, bodyOf(event));
    if (event.httpMethod === "POST" && path === "/lessons/check") return submitLesson(user, bodyOf(event));
    if (event.httpMethod === "POST" && path === "/kana/learn") return submitLearning(user, bodyOf(event));
    if (event.httpMethod === "POST" && path === "/kana/groups/{id}/start") return startGroup(user, event.pathParameters?.id ?? "", bodyOf(event));
    if (event.httpMethod === "GET" && path === "/kana/groups/{id}/status") return groupStatus(user, event.pathParameters?.id ?? "");
    return response(404, { error: "Not found" });
  } catch (error) {
    console.error(error);
    return response(500, { error: "The request could not be completed." });
  }
}

async function dashboard(user: string) {
  const [data, cards, logs] = await Promise.all([
    db.send(new QueryCommand({ TableName: learnerTable, KeyConditionExpression: "userId = :user", ExpressionAttributeValues: { ":user": user } })),
    db.send(new QueryCommand({ TableName: cardsTable, KeyConditionExpression: "userId = :user", ExpressionAttributeValues: { ":user": user } })),
    db.send(new QueryCommand({ TableName: logsTable, KeyConditionExpression: "userId = :user", ExpressionAttributeValues: { ":user": user }, ScanIndexForward: false, Limit: 100 })),
  ]);
  const lessons: Record<string, unknown> = {};
  const startedGroups: string[] = [];
  const recognitionGroups: string[] = [];
  const recallStartedGroups: string[] = [];
  const proficientGroups: string[] = [];
  const today = new Date().toISOString().slice(0, 10);
  let dailyNew = { date: today, count: 0 };
  for (const item of data.Items ?? []) {
    if (item.itemKey.startsWith("LESSON#")) lessons[item.itemKey.slice(7)] = { bestScore: item.bestScore, attempts: item.attempts, completed: item.completed, completedAt: item.completedAt };
    if (item.itemKey.startsWith("GROUP#")) {
      const groupId = item.itemKey.slice(6);
      startedGroups.push(groupId);
      if (item.recognitionComplete || item.proficient) recognitionGroups.push(groupId);
      if (item.recallStartedAt || item.proficient) recallStartedGroups.push(groupId);
      if (item.proficient) proficientGroups.push(groupId);
    }
    if (item.itemKey === `DAILY#${today}`) dailyNew = { date: today, count: Number(item.newCards ?? 0) };
  }
  for (const group of kanaGroups) {
    const groupCards = (cards.Items ?? []).filter((card) => group.items.some((item) => item.id === card.itemId));
    if (!recallStartedGroups.includes(group.id) && groupCards.some((card) => card.direction === "recall" && card.reps > 0)) recallStartedGroups.push(group.id);
  }
  const storedCards = Object.fromEntries((cards.Items ?? []).map((card) => [card.cardKey, card]));
  const reviews = (logs.Items ?? []).map((log) => ({ id: log.logKey, itemId: log.itemId, direction: log.direction, correct: log.correct, rating: log.rating, reviewedAt: log.reviewedAt }));
  return response(200, { progress: { lessons, cards: storedCards, startedGroups, recognitionGroups, recallStartedGroups, proficientGroups, reviews, dailyNew } });
}

async function queue(user: string, event: APIGatewayProxyEvent) {
  const now = new Date().toISOString();
  const day = now.slice(0, 10);
  const [result, daily] = await Promise.all([
    db.send(new QueryCommand({ TableName: cardsTable, KeyConditionExpression: "userId = :user", ExpressionAttributeValues: { ":user": user } })),
    db.send(new GetCommand({ TableName: learnerTable, Key: { userId: user, itemKey: `DAILY#${day}` } })),
  ]);
  const script = event.queryStringParameters?.script;
  const direction = event.queryStringParameters?.direction;
  const matches = (card: Record<string, unknown>) => (!script || script === "both" || kanaById[String(card.itemId)]?.script === script) && (!direction || direction === "mixed" || card.direction === direction);
  const due = (result.Items ?? []).filter((card) => Number(card.reps) > 0 && String(card.due) <= now && matches(card)).sort((a, b) => String(a.due).localeCompare(String(b.due)));
  const remainingNew = Math.max(0, 10 - Number(daily.Item?.newCards ?? 0));
  const newCards = (result.Items ?? []).filter((card) => Number(card.reps) === 0 && matches(card)).slice(0, remainingNew);
  return response(200, { cards: [...due, ...newCards], dueCount: due.length, newCount: newCards.length, serverTime: now });
}

async function submitLesson(user: string, body: Record<string, unknown>) {
  const lessonKey = String(body.lessonKey ?? "");
  const answers = Array.isArray(body.answers) ? body.answers.map(Number) : [];
  const key = lessonAnswerKeys[lessonKey];
  if (!key || answers.length !== key.length) return response(400, { error: "Invalid lesson answers" });
  const [track, slug] = lessonKey.split("/");
  const index = lessonOrder[track]?.indexOf(slug) ?? -1;
  if (index > 0) {
    const previous = await db.send(new GetCommand({ TableName: learnerTable, Key: { userId: user, itemKey: `LESSON#${track}/${lessonOrder[track][index - 1]}` } }));
    if (!previous.Item?.completed) return response(409, { error: "Complete the previous lesson first" });
  }
  const score = Math.round((answers.filter((answer, index) => answer === key[index]).length / key.length) * 100);
  const completed = score >= 80;
  const now = new Date().toISOString();
  const result = await db.send(new UpdateCommand({
    TableName: learnerTable,
    Key: { userId: user, itemKey: `LESSON#${lessonKey}` },
    UpdateExpression: "SET attempts = if_not_exists(attempts, :zero) + :one, bestScore = if_not_exists(bestScore, :zero), completed = if_not_exists(completed, :false), updatedAt = :now",
    ExpressionAttributeValues: { ":zero": 0, ":one": 1, ":false": false, ":now": now },
    ReturnValues: "ALL_NEW",
  }));
  const previous = result.Attributes ?? {};
  const bestScore = Math.max(previous.bestScore ?? 0, score);
  const nowComplete = Boolean(previous.completed || completed);
  if (nowComplete) {
    await db.send(new UpdateCommand({ TableName: learnerTable, Key: { userId: user, itemKey: `LESSON#${lessonKey}` }, UpdateExpression: "SET bestScore = :best, completed = :completed, completedAt = if_not_exists(completedAt, :completedAt)", ExpressionAttributeValues: { ":best": bestScore, ":completed": true, ":completedAt": now } }));
  } else {
    await db.send(new UpdateCommand({ TableName: learnerTable, Key: { userId: user, itemKey: `LESSON#${lessonKey}` }, UpdateExpression: "SET bestScore = :best, completed = :completed", ExpressionAttributeValues: { ":best": bestScore, ":completed": false } }));
  }
  return response(200, { score, completed: nowComplete, bestScore });
}

async function startGroup(user: string, groupId: string, body: Record<string, unknown>) {
  const group = kanaGroups.find((candidate) => candidate.id === groupId);
  if (!group) return response(404, { error: "Unknown kana group" });
  const phase = body.phase === "recall" ? "recall" : "recognition";
  const path = kanaGroups.filter((candidate) => candidate.script === group.script);
  const groupIndex = path.findIndex((candidate) => candidate.id === group.id);
  if (phase === "recognition" && groupIndex > 0) {
    const previous = path[groupIndex - 1];
    const previousStatus = await db.send(new GetCommand({ TableName: learnerTable, Key: { userId: user, itemKey: `GROUP#${previous.id}` } }));
    if (!previousStatus.Item?.proficient) return response(409, { error: "Become proficient in the previous kana group first" });
  }
  if (phase === "recall") {
    const [savedStatus, allCards] = await Promise.all([
      db.send(new GetCommand({ TableName: learnerTable, Key: { userId: user, itemKey: `GROUP#${groupId}` } })),
      db.send(new QueryCommand({ TableName: cardsTable, KeyConditionExpression: "userId = :user", ExpressionAttributeValues: { ":user": user } })),
    ]);
    const recognitionComplete = Boolean(savedStatus.Item?.recognitionComplete || savedStatus.Item?.proficient) || group.items.every((item) =>
      ((allCards.Items ?? []).find((card) => card.cardKey === `${item.id}:recognition`)?.streak ?? 0) >= 2,
    );
    if (!recognitionComplete) return response(409, { error: "Complete recognition before starting recall" });
  }
  const now = new Date();
  await Promise.all(group.items.map(async (item) => {
    const card = createEmptyCard(now);
    await db.send(new UpdateCommand({
      TableName: cardsTable,
      Key: { userId: user, cardKey: `${item.id}:${phase}` },
      UpdateExpression: "SET itemId = if_not_exists(itemId, :item), direction = if_not_exists(direction, :direction), due = if_not_exists(due, :due), stability = if_not_exists(stability, :zero), difficulty = if_not_exists(difficulty, :zero), elapsed_days = if_not_exists(elapsed_days, :zero), scheduled_days = if_not_exists(scheduled_days, :zero), learning_steps = if_not_exists(learning_steps, :zero), reps = if_not_exists(reps, :zero), lapses = if_not_exists(lapses, :zero), #state = if_not_exists(#state, :zero), streak = if_not_exists(streak, :zero), learningStreak = if_not_exists(learningStreak, :zero)",
      ExpressionAttributeNames: { "#state": "state" },
      ExpressionAttributeValues: { ":item": item.id, ":direction": phase, ":due": card.due.toISOString(), ":zero": 0 },
    }));
  }));
  const timestampField = phase === "recall" ? "recallStartedAt" : "startedAt";
  await db.send(new UpdateCommand({ TableName: learnerTable, Key: { userId: user, itemKey: `GROUP#${groupId}` }, UpdateExpression: `SET ${timestampField} = if_not_exists(${timestampField}, :now)`, ExpressionAttributeValues: { ":now": now.toISOString() } }));
  return response(200, { groupId, phase, cardsCreated: group.items.length });
}

async function groupStatus(user: string, groupId: string) {
  const group = kanaGroups.find((candidate) => candidate.id === groupId);
  if (!group) return response(404, { error: "Unknown kana group" });
  const [result, savedStatus] = await Promise.all([
    db.send(new QueryCommand({ TableName: cardsTable, KeyConditionExpression: "userId = :user", ExpressionAttributeValues: { ":user": user } })),
    db.send(new GetCommand({ TableName: learnerTable, Key: { userId: user, itemKey: `GROUP#${groupId}` } })),
  ]);
  const relevant = (result.Items ?? []).filter((card) => group.items.some((item) => item.id === card.itemId));
  return response(200, { groupId, recognitionComplete: Boolean(savedStatus.Item?.recognitionComplete || savedStatus.Item?.proficient), recallStarted: Boolean(savedStatus.Item?.recallStartedAt || savedStatus.Item?.proficient), proficient: Boolean(savedStatus.Item?.proficient), cards: relevant });
}

async function submitLearning(user: string, body: Record<string, unknown>) {
  const itemId = String(body.itemId ?? "");
  const direction = String(body.direction ?? "");
  const answer = String(body.answer ?? "");
  const item = kanaById[itemId];
  if (!item || (direction !== "recognition" && direction !== "recall")) return response(400, { error: "Invalid learning card" });
  const existing = await db.send(new GetCommand({ TableName: cardsTable, Key: { userId: user, cardKey: `${itemId}:${direction}` } }));
  if (!existing.Item) return response(409, { error: "This kana has not been unlocked" });
  const voiceCorrect = answer.replace(/[\s。、,.!?！？]/g, "").includes(item.kana) || toRomaji(answer).toLowerCase().replace(/[^a-z]/g, "") === item.romaji;
  const correct = direction === "recognition" ? (body.inputMode === "voice" ? voiceCorrect : isRomajiAnswer(item, answer)) : answer === item.kana;
  const currentStreak = Number(existing.Item.learningStreak ?? existing.Item.streak ?? 0);
  const nextStreak = correct ? currentStreak + 1 : 0;
  const now = new Date().toISOString();
  const group = kanaGroups.find((candidate) => candidate.items.some((groupItem) => groupItem.id === itemId));
  let completedRecognition = false;
  let completedGroup = false;
  if (group) {
    const groupCards = await db.send(new QueryCommand({ TableName: cardsTable, KeyConditionExpression: "userId = :user", ExpressionAttributeValues: { ":user": user } }));
    const streakFor = (candidateItemId: string, candidateDirection: "recognition" | "recall") => candidateItemId === itemId && candidateDirection === direction
      ? nextStreak
      : Number((groupCards.Items ?? []).find((candidate) => candidate.cardKey === `${candidateItemId}:${candidateDirection}`)?.learningStreak ?? (groupCards.Items ?? []).find((candidate) => candidate.cardKey === `${candidateItemId}:${candidateDirection}`)?.streak ?? 0);
    completedRecognition = group.items.every((candidate) => streakFor(candidate.id, "recognition") >= 2);
    completedGroup = completedRecognition && group.items.every((candidate) => streakFor(candidate.id, "recall") >= 2);
  }
  const clientLearningId = String(body.clientLearningId ?? crypto.randomUUID());
  const transaction = [
    { Update: { TableName: cardsTable, Key: { userId: user, cardKey: `${itemId}:${direction}` }, UpdateExpression: "SET learningStreak = :streak", ConditionExpression: "attribute_exists(cardKey)", ExpressionAttributeValues: { ":streak": nextStreak } } },
    { Put: { TableName: learnerTable, Item: { userId: user, itemKey: `LEARN_ATTEMPT#${clientLearningId}`, itemId, direction, correct, answeredAt: now }, ConditionExpression: "attribute_not_exists(itemKey)" } },
  ];
  if (completedGroup && group) transaction.push({ Update: { TableName: learnerTable, Key: { userId: user, itemKey: `GROUP#${group.id}` }, UpdateExpression: "SET recognitionComplete = :true, recognitionCompletedAt = if_not_exists(recognitionCompletedAt, :now), proficient = :true, proficientAt = if_not_exists(proficientAt, :now)", ExpressionAttributeValues: { ":true": true, ":now": now } } } as never);
  else if (completedRecognition && group) transaction.push({ Update: { TableName: learnerTable, Key: { userId: user, itemKey: `GROUP#${group.id}` }, UpdateExpression: "SET recognitionComplete = :true, recognitionCompletedAt = if_not_exists(recognitionCompletedAt, :now)", ExpressionAttributeValues: { ":true": true, ":now": now } } } as never);
  await db.send(new TransactWriteCommand({ TransactItems: transaction }));
  return response(200, { correct, learningStreak: nextStreak, recognitionComplete: completedRecognition, groupComplete: completedGroup });
}

async function submitReview(user: string, body: Record<string, unknown>) {
  const itemId = String(body.itemId ?? "");
  const direction = String(body.direction ?? "");
  const answer = String(body.answer ?? "");
  const item = kanaById[itemId];
  if (!item || (direction !== "recognition" && direction !== "recall")) return response(400, { error: "Invalid card" });
  const existing = await db.send(new GetCommand({ TableName: cardsTable, Key: { userId: user, cardKey: `${itemId}:${direction}` } }));
  if (!existing.Item) return response(409, { error: "This kana has not been unlocked" });
  const voiceCorrect = answer.replace(/[\s。、,.!?！？]/g, "").includes(item.kana) || toRomaji(answer).toLowerCase().replace(/[^a-z]/g, "") === item.romaji;
  const correct = direction === "recognition" ? (body.inputMode === "voice" ? voiceCorrect : isRomajiAnswer(item, answer)) : answer === item.kana;
  const requested = Number(body.rating);
  const rating = correct && [Rating.Hard, Rating.Good, Rating.Easy].includes(requested) ? requested : correct ? Rating.Good : Rating.Again;
  const card = {
    due: new Date(String(existing.Item.due)),
    stability: Number(existing.Item.stability),
    difficulty: Number(existing.Item.difficulty),
    elapsed_days: Number(existing.Item.elapsed_days),
    scheduled_days: Number(existing.Item.scheduled_days),
    learning_steps: Number(existing.Item.learning_steps),
    reps: Number(existing.Item.reps),
    lapses: Number(existing.Item.lapses),
    state: Number(existing.Item.state) as State,
    last_review: existing.Item.last_review ? new Date(String(existing.Item.last_review)) : undefined,
  };
  const now = new Date();
  const scheduled = scheduler.next(card, now, rating as Rating.Again | Rating.Hard | Rating.Good | Rating.Easy);
  const clientReviewId = String(body.clientReviewId ?? crypto.randomUUID());
  const nextCard = { ...scheduled.card, due: scheduled.card.due.toISOString(), last_review: scheduled.card.last_review?.toISOString(), streak: correct ? (existing.Item.streak ?? 0) + 1 : 0, learningStreak: existing.Item.learningStreak ?? existing.Item.streak ?? 0 };
  const logKey = `${now.toISOString()}#${clientReviewId}`;
  const transaction = [
    { Put: { TableName: cardsTable, Item: { userId: user, cardKey: `${itemId}:${direction}`, itemId, direction, ...nextCard } } },
    { Put: { TableName: logsTable, Item: { userId: user, logKey, itemId, direction, answer, correct, rating, responseMs: Number(body.responseMs ?? 0), beforeState: existing.Item, afterState: nextCard, schedulerVersion: "ts-fsrs@5.4.1", reviewedAt: now.toISOString() }, ConditionExpression: "attribute_not_exists(logKey)" } },
  ];
  if (Number(existing.Item.reps) === 0) transaction.push({ Update: { TableName: learnerTable, Key: { userId: user, itemKey: `DAILY#${now.toISOString().slice(0, 10)}` }, UpdateExpression: "SET updatedAt = :now ADD newCards :one", ExpressionAttributeValues: { ":now": now.toISOString(), ":one": 1 } } } as never);
  await db.send(new TransactWriteCommand({ TransactItems: transaction }));
  return response(200, { correct, expected: direction === "recognition" ? item.romaji : item.kana, card: nextCard, serverTime: now.toISOString() });
}
