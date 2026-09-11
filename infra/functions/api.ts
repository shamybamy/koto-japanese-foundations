import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  BatchGetCommand,
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
  type QueryCommandInput,
  type TransactWriteCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { Rating, State, createEmptyCard, fsrs, generatorParameters, type Card } from "ts-fsrs";
import { z } from "zod";
import { curriculum } from "../../lib/curriculum";
import { isRomajiAnswer, kanaById, kanaGroups, kanaItems, type Direction, type KanaItem } from "../../lib/kana";

type DynamoRecord = Record<string, unknown>;
type TransactionItems = NonNullable<TransactWriteCommandInput["TransactItems"]>;

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});
const scheduler = fsrs(generatorParameters({ request_retention: 0.9 }));
const maxNewCardsPerDay = 10;
const learningStreakRequired = 2;
const idempotencyTtlSeconds = 7 * 24 * 60 * 60;
const optimisticAttempts = 5;

// Curriculum and grading share one source of truth. The browser receives the
// content, but these values are bundled independently into the trusted Lambda.
const lessonAnswerKeys = Object.fromEntries(
  curriculum.flatMap((track) => track.lessons.map((lesson) => [
    `${track.slug}/${lesson.slug}`,
    lesson.quiz.map((question) => question.answer),
  ])),
) as Record<string, number[]>;
const lessonOrder = Object.fromEntries(
  curriculum.map((track) => [track.slug, track.lessons.map((lesson) => lesson.slug)]),
) as Record<string, string[]>;
const curriculumOrder: Map<string, number> = new Map(
  kanaItems.flatMap((item, itemIndex) => (["recognition", "recall"] as const).map((direction, directionIndex) => [
    `${item.id}:${direction}`,
    itemIndex * 2 + directionIndex,
  ] as const)),
);

const directionSchema = z.enum(["recognition", "recall"]);
const inputModeSchema = z.enum(["typed", "grid"]);
const requestIdSchema = z.uuid();
const queueSchema = z.strictObject({
  script: z.enum(["hiragana", "katakana", "both"]).optional().default("both"),
  direction: z.enum(["recognition", "recall", "mixed"]).optional().default("mixed"),
});
const lessonSchema = z.strictObject({
  lessonKey: z.string().min(1).max(100),
  answers: z.array(z.number().int().min(0).max(20)).min(1).max(20),
  clientLessonId: requestIdSchema,
});
const startGroupSchema = z.strictObject({ phase: directionSchema });
const answerSchema = z.strictObject({
  itemId: z.string().min(1).max(100),
  direction: directionSchema,
  answer: z.string().trim().min(1).max(256),
  inputMode: inputModeSchema,
});
const learningSchema = answerSchema.extend({ clientLearningId: requestIdSchema }).superRefine(validateInputMode);
const reviewSchema = answerSchema.extend({
  rating: z.union([z.literal(Rating.Hard), z.literal(Rating.Good), z.literal(Rating.Easy)]).optional(),
  responseMs: z.number().finite().int().min(0).max(60 * 60 * 1000),
  clientReviewId: requestIdSchema,
}).superRefine(validateInputMode);
const storedFsrsSchema = z.object({
  due: z.string().datetime({ offset: true }),
  stability: z.number().finite().nonnegative(),
  difficulty: z.number().finite().nonnegative(),
  elapsed_days: z.number().int().nonnegative(),
  scheduled_days: z.number().int().nonnegative(),
  learning_steps: z.number().int().nonnegative(),
  reps: z.number().int().nonnegative(),
  lapses: z.number().int().nonnegative(),
  state: z.number().int().min(State.New).max(State.Relearning),
  last_review: z.string().datetime({ offset: true }).optional(),
});

class ApiError extends Error {
  constructor(readonly statusCode: number, readonly code: string, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

function validateInputMode(value: { direction: Direction; inputMode: "typed" | "grid" }, context: z.RefinementCtx) {
  if (value.direction === "recall" && value.inputMode !== "grid") {
    context.addIssue({ code: "custom", path: ["inputMode"], message: "Recall answers must use the kana grid" });
  }
  if (value.direction === "recognition" && value.inputMode === "grid") {
    context.addIssue({ code: "custom", path: ["inputMode"], message: "Recognition answers must be typed" });
  }
}

const jsonResponse = (statusCode: number, body: unknown): APIGatewayProxyResult => ({
  statusCode,
  headers: { "content-type": "application/json", "cache-control": "no-store" },
  body: JSON.stringify(body),
});

function withCors(result: APIGatewayProxyResult, event: APIGatewayProxyEvent) {
  const configured = process.env.ALLOWED_ORIGINS?.split(",").map((origin) => origin.trim()).filter(Boolean) ?? ["*"];
  const requestOrigin = event.headers.origin ?? event.headers.Origin;
  const allowedOrigin = configured.includes("*") ? "*" : requestOrigin && configured.includes(requestOrigin) ? requestOrigin : undefined;
  return {
    ...result,
    headers: {
      ...result.headers,
      ...(allowedOrigin ? { "access-control-allow-origin": allowedOrigin, vary: "Origin" } : {}),
    },
  };
}

function preflightResponse(event: APIGatewayProxyEvent): APIGatewayProxyResult {
  return withCors({
    statusCode: 204,
    headers: {
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type,authorization",
      "access-control-max-age": "600",
      "cache-control": "no-store",
    },
    body: "",
  }, event);
}

function requiredEnvironment(name: "LEARNER_DATA_TABLE" | "REVIEW_CARDS_TABLE" | "REVIEW_LOGS_TABLE") {
  const value = process.env[name];
  if (!value) throw new Error(`Missing Lambda environment variable: ${name}`);
  return value;
}

function userId(event: APIGatewayProxyEvent) {
  const parsed = z.string().min(1).max(256).safeParse(event.requestContext.authorizer?.claims?.sub);
  return parsed.success ? parsed.data : undefined;
}

function verifiedEmail(event: APIGatewayProxyEvent) {
  const parsed = z.string().email().safeParse(event.requestContext.authorizer?.claims?.email);
  return parsed.success ? parsed.data : undefined;
}

function requestBody(event: APIGatewayProxyEvent): unknown {
  if (!event.body) return {};
  try {
    const body = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
    return JSON.parse(body);
  } catch {
    throw new ApiError(400, "INVALID_JSON", "The request body must be valid JSON");
  }
}

function parseWith<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => `${issue.path.join(".") || "request"}: ${issue.message}`).join("; ");
    throw new ApiError(400, "INVALID_REQUEST", message);
  }
  return parsed.data;
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  // Preflight is intentionally unauthenticated. `withCors` only echoes origins
  // from the deployment allowlist, including when more than one is configured.
  if (event.httpMethod === "OPTIONS") return preflightResponse(event);

  const finish = (result: APIGatewayProxyResult) => withCors(result, event);
  const user = userId(event);
  if (!user) return finish(jsonResponse(401, { error: "Unauthorized", code: "UNAUTHORIZED" }));

  try {
    const path = event.resource;
    let result: APIGatewayProxyResult;
    if (event.httpMethod === "GET" && path === "/dashboard") result = await dashboard(user, verifiedEmail(event));
    else if (event.httpMethod === "GET" && path === "/reviews/queue") result = await queue(user, event);
    else if (event.httpMethod === "POST" && path === "/reviews/submit") result = await submitReview(user, requestBody(event));
    else if (event.httpMethod === "POST" && path === "/lessons/check") result = await submitLesson(user, requestBody(event));
    else if (event.httpMethod === "POST" && path === "/kana/learn") result = await submitLearning(user, requestBody(event));
    else if (event.httpMethod === "POST" && path === "/kana/groups/{id}/start") result = await startGroup(user, event.pathParameters?.id ?? "", requestBody(event));
    else if (event.httpMethod === "GET" && path === "/kana/groups/{id}/status") result = await groupStatus(user, event.pathParameters?.id ?? "");
    else result = jsonResponse(404, { error: "Not found", code: "NOT_FOUND" });
    return finish(result);
  } catch (error) {
    if (error instanceof ApiError) return finish(jsonResponse(error.statusCode, { error: error.message, code: error.code }));
    console.error(error);
    return finish(jsonResponse(500, { error: "The request could not be completed.", code: "INTERNAL_ERROR" }));
  }
}

async function queryAll(input: QueryCommandInput) {
  const items: DynamoRecord[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const result = await db.send(new QueryCommand({ ...input, ExclusiveStartKey: exclusiveStartKey }));
    items.push(...((result.Items ?? []) as DynamoRecord[]));
    exclusiveStartKey = result.LastEvaluatedKey;
  } while (exclusiveStartKey);
  return items;
}

async function queryByPrefix(tableName: string, user: string, sortKey: string, prefix: string) {
  return queryAll({
    TableName: tableName,
    KeyConditionExpression: "userId = :user AND begins_with(#sortKey, :prefix)",
    ExpressionAttributeNames: { "#sortKey": sortKey },
    ExpressionAttributeValues: { ":user": user, ":prefix": prefix },
    ConsistentRead: true,
  });
}

async function getItem(tableName: string, user: string, sortKey: string, value: string) {
  return db.send(new GetCommand({
    TableName: tableName,
    Key: { userId: user, [sortKey]: value },
    ConsistentRead: true,
  }));
}

async function currentCards(tableName: string, user: string, candidates: DynamoRecord[]) {
  const cardKeys = [...new Set(candidates.map((card) => String(card.cardKey ?? cardKeyOf(card))))];
  const records: DynamoRecord[] = [];

  for (let offset = 0; offset < cardKeys.length; offset += 100) {
    let pending = cardKeys.slice(offset, offset + 100).map((cardKey) => ({ userId: user, cardKey }));
    for (let attempt = 0; pending.length && attempt < optimisticAttempts; attempt += 1) {
      const result = await db.send(new BatchGetCommand({
        RequestItems: { [tableName]: { Keys: pending, ConsistentRead: true } },
      }));
      records.push(...((result.Responses?.[tableName] ?? []) as DynamoRecord[]));
      pending = (result.UnprocessedKeys?.[tableName]?.Keys ?? []) as Array<{ userId: string; cardKey: string }>;
    }
    if (pending.length) throw new ApiError(503, "QUEUE_BUSY", "The review queue is busy; please try again");
  }

  return records;
}

function publicCard(card: DynamoRecord) {
  const result = { ...card };
  delete result.userId;
  delete result.cardKey;
  return result;
}

function publicRecord(record: DynamoRecord) {
  const result = { ...record };
  delete result.userId;
  delete result.itemKey;
  return result;
}

function cardKeyOf(card: DynamoRecord) {
  return `${String(card.itemId)}:${String(card.direction)}`;
}

function rankOf(card: DynamoRecord) {
  const stored = Number(card.curriculumOrder);
  return Number.isFinite(stored) ? stored : curriculumOrder.get(cardKeyOf(card)) ?? Number.MAX_SAFE_INTEGER;
}

function compareCards(left: DynamoRecord, right: DynamoRecord) {
  const due = String(left.due).localeCompare(String(right.due));
  return due || rankOf(left) - rankOf(right) || cardKeyOf(left).localeCompare(cardKeyOf(right));
}

function matchingCard(card: DynamoRecord, script: "hiragana" | "katakana" | "both", direction: Direction | "mixed") {
  const item = kanaById[String(card.itemId)];
  return Boolean(item)
    && (script === "both" || item.script === script)
    && (direction === "mixed" || card.direction === direction);
}

async function ensureProfile(user: string, email?: string) {
  const learnerTable = requiredEnvironment("LEARNER_DATA_TABLE");
  const existing = await getItem(learnerTable, user, "itemKey", "PROFILE");
  if (existing.Item) return existing.Item as DynamoRecord;
  const now = new Date().toISOString();
  try {
    const result = await db.send(new UpdateCommand({
      TableName: learnerTable,
      Key: { userId: user, itemKey: "PROFILE" },
      UpdateExpression: "SET createdAt = :now, updatedAt = :now, email = :email",
      ConditionExpression: "attribute_not_exists(itemKey)",
      ExpressionAttributeValues: { ":now": now, ":email": email ?? "" },
      ReturnValues: "ALL_NEW",
    }));
    return result.Attributes as DynamoRecord;
  } catch (error) {
    if (transactionFailureKind(error) !== "conditional") throw error;
    return (await getItem(learnerTable, user, "itemKey", "PROFILE")).Item as DynamoRecord;
  }
}

async function dashboard(user: string, email?: string) {
  const learnerTable = requiredEnvironment("LEARNER_DATA_TABLE");
  const cardsTable = requiredEnvironment("REVIEW_CARDS_TABLE");
  const logsTable = requiredEnvironment("REVIEW_LOGS_TABLE");
  const today = new Date().toISOString().slice(0, 10);
  const [lessonItems, groupItems, daily, cards, logs, profile] = await Promise.all([
    queryByPrefix(learnerTable, user, "itemKey", "LESSON#"),
    queryByPrefix(learnerTable, user, "itemKey", "GROUP#"),
    getItem(learnerTable, user, "itemKey", `DAILY#${today}`),
    queryAll({ TableName: cardsTable, KeyConditionExpression: "userId = :user", ExpressionAttributeValues: { ":user": user }, ConsistentRead: true }),
    db.send(new QueryCommand({ TableName: logsTable, KeyConditionExpression: "userId = :user", ExpressionAttributeValues: { ":user": user }, ScanIndexForward: false, Limit: 100, ConsistentRead: true })),
    ensureProfile(user, email),
  ]);

  const lessons = Object.fromEntries(lessonItems.map((item) => [String(item.itemKey).slice(7), {
    bestScore: Number(item.bestScore ?? 0),
    attempts: Number(item.attempts ?? 0),
    completed: Boolean(item.completed),
    completedAt: item.completedAt,
  }]));
  const groupRecords = new Map(groupItems.map((item) => [String(item.itemKey).slice(6), item]));
  const startedGroups: string[] = [];
  const recognitionGroups: string[] = [];
  const recallStartedGroups: string[] = [];
  const proficientGroups: string[] = [];

  for (const group of kanaGroups) {
    const saved = groupRecords.get(group.id);
    const relevant = cards.filter((card) => group.items.some((item) => item.id === card.itemId));
    const recognitionComplete = Boolean(saved?.recognitionComplete || saved?.proficient)
      || group.items.every((item) => learningStreak(relevant.find((card) => cardKeyOf(card) === `${item.id}:recognition`)) >= learningStreakRequired);
    const recallStarted = Boolean(saved?.recallStartedAt || saved?.proficient)
      || relevant.some((card) => card.direction === "recall");
    const proficient = Boolean(saved?.proficient)
      || group.items.every((item) => (["recognition", "recall"] as const).every((direction) =>
        learningStreak(relevant.find((card) => cardKeyOf(card) === `${item.id}:${direction}`)) >= learningStreakRequired,
      ));
    if (saved?.startedAt || relevant.some((card) => card.direction === "recognition")) startedGroups.push(group.id);
    if (recognitionComplete) recognitionGroups.push(group.id);
    if (recallStarted) recallStartedGroups.push(group.id);
    if (proficient) proficientGroups.push(group.id);
  }

  const storedCards = Object.fromEntries(cards.map((card) => [String(card.cardKey), publicCard(card)]));
  const recentLogs = (logs.Items ?? []) as DynamoRecord[];
  const reviews = recentLogs.map((log) => ({
    id: log.logKey,
    itemId: log.itemId,
    direction: log.direction,
    correct: log.correct,
    rating: log.rating,
    reviewedAt: log.reviewedAt,
    responseMs: log.responseMs,
  }));
  const now = new Date().toISOString();
  const reviewsDue = cards.filter((card) => Number(card.reps) > 0 && String(card.due) <= now).length;
  const introducedToday = Number(daily.Item?.newCards ?? 0);
  const newCardsAvailableToday = Math.min(
    Math.max(0, maxNewCardsPerDay - introducedToday),
    cards.filter((card) => Number(card.reps) === 0).length,
  );
  const recentActivity = [
    ...lessonItems.filter((item) => item.completedAt).map((item) => ({ type: "lesson", key: String(item.itemKey).slice(7), at: item.completedAt })),
    ...groupItems.filter((item) => item.proficientAt).map((item) => ({ type: "kana", key: String(item.itemKey).slice(6), at: item.proficientAt })),
    ...recentLogs.map((item) => ({ type: "review", key: item.itemId, at: item.reviewedAt, correct: item.correct })),
  ].sort((left, right) => String(right.at).localeCompare(String(left.at))).slice(0, 10);

  return jsonResponse(200, {
    progress: {
      lessons,
      cards: storedCards,
      startedGroups,
      recognitionGroups,
      recallStartedGroups,
      proficientGroups,
      groupCompletedAt: Object.fromEntries(groupItems.flatMap((item) => item.proficientAt ? [[String(item.itemKey).slice(6), String(item.proficientAt)]] : [])),
      reviews,
      dailyNew: { date: today, count: introducedToday },
    },
    summary: { reviewsDue, newCardsAvailableToday, recentActivity },
    profile: { createdAt: profile?.createdAt, updatedAt: profile?.updatedAt },
    serverTime: now,
  });
}

async function queue(user: string, event: APIGatewayProxyEvent) {
  const filters = parseWith(queueSchema, event.queryStringParameters ?? {});
  const now = new Date().toISOString();
  const day = now.slice(0, 10);
  const learnerTable = requiredEnvironment("LEARNER_DATA_TABLE");
  const cardsTable = requiredEnvironment("REVIEW_CARDS_TABLE");
  const [dueResult, newResult, daily] = await Promise.all([
    queryAll({
      TableName: cardsTable,
      IndexName: process.env.DUE_INDEX ?? "due-index",
      KeyConditionExpression: "userId = :user AND due <= :now",
      FilterExpression: "#reps > :zero",
      ExpressionAttributeNames: { "#reps": "reps" },
      ExpressionAttributeValues: { ":user": user, ":now": now, ":zero": 0 },
    }),
    queryAll({
      TableName: cardsTable,
      KeyConditionExpression: "userId = :user",
      FilterExpression: "attribute_not_exists(#reps) OR #reps = :zero",
      ExpressionAttributeNames: { "#reps": "reps" },
      ExpressionAttributeValues: { ":user": user, ":zero": 0 },
      ConsistentRead: true,
    }),
    getItem(learnerTable, user, "itemKey", `DAILY#${day}`),
  ]);
  // A GSI is eventually consistent. Re-read its candidates from the base table
  // so a just-reviewed card cannot reappear with the index's stale due date.
  const currentDue = await currentCards(cardsTable, user, dueResult);
  const due = currentDue
    .filter((card) => Number(card.reps) > 0 && String(card.due) <= now)
    .filter((card) => matchingCard(card, filters.script, filters.direction))
    .sort(compareCards);
  const remainingNew = Math.max(0, maxNewCardsPerDay - Number(daily.Item?.newCards ?? 0));
  const newCards = newResult
    .filter((card) => matchingCard(card, filters.script, filters.direction))
    .sort((left, right) => rankOf(left) - rankOf(right) || cardKeyOf(left).localeCompare(cardKeyOf(right)))
    .slice(0, remainingNew);
  return jsonResponse(200, {
    cards: [...due, ...newCards].map(publicCard),
    dueCount: due.length,
    newCount: newCards.length,
    remainingNewToday: remainingNew,
    serverTime: now,
  });
}

async function submitLesson(user: string, rawBody: unknown) {
  const body = parseWith(lessonSchema, rawBody);
  const answerKey = lessonAnswerKeys[body.lessonKey];
  if (!answerKey || body.answers.length !== answerKey.length) {
    throw new ApiError(400, "INVALID_LESSON", "The lesson or answer count is invalid");
  }
  const [track, slug, extra] = body.lessonKey.split("/");
  const lessonIndex = extra === undefined ? lessonOrder[track]?.indexOf(slug) ?? -1 : -1;
  if (lessonIndex < 0) throw new ApiError(400, "INVALID_LESSON", "The lesson is invalid");

  const score = Math.round((body.answers.filter((answer, index) => answer === answerKey[index]).length / answerKey.length) * 100);
  const passed = score === 100;
  const requestId = body.clientLessonId;
  const requestKey = `REQUEST#LESSON#${requestId}`;
  const fingerprint = JSON.stringify([body.lessonKey, body.answers]);
  const learnerTable = requiredEnvironment("LEARNER_DATA_TABLE");
  const duplicate = await idempotencyRecord(learnerTable, user, requestKey, fingerprint);
  if (duplicate) return lessonResponse(learnerTable, user, body.lessonKey, Number(duplicate.score ?? score), requestId, true);

  const previousLessonKey = lessonIndex > 0 ? `${track}/${lessonOrder[track][lessonIndex - 1]}` : undefined;
  if (previousLessonKey) {
    const previous = await getItem(learnerTable, user, "itemKey", `LESSON#${previousLessonKey}`);
    if (!previous.Item?.completed) throw new ApiError(409, "LESSON_LOCKED", "Complete the previous lesson first");
  }

  for (let attempt = 0; attempt < optimisticAttempts; attempt += 1) {
    const current = await getItem(learnerTable, user, "itemKey", `LESSON#${body.lessonKey}`);
    const currentItem = current.Item as DynamoRecord | undefined;
    const revision = Number(currentItem?.revision ?? 0);
    const now = new Date().toISOString();
    const nextLesson: DynamoRecord = {
      userId: user,
      itemKey: `LESSON#${body.lessonKey}`,
      attempts: Number(currentItem?.attempts ?? 0) + 1,
      bestScore: Math.max(Number(currentItem?.bestScore ?? 0), score),
      completed: Boolean(currentItem?.completed || passed),
      completedAt: currentItem?.completedAt ?? (passed ? now : undefined),
      createdAt: currentItem?.createdAt ?? now,
      updatedAt: now,
      revision: revision + 1,
    };
    const transaction: TransactionItems = [
      { Put: { TableName: learnerTable, Item: idempotencyItem(user, requestKey, fingerprint, now, { score }), ConditionExpression: "attribute_not_exists(itemKey)" } },
      { Put: {
        TableName: learnerTable,
        Item: nextLesson,
        ConditionExpression: currentItem ? revisionCondition(currentItem) : "attribute_not_exists(itemKey)",
        ExpressionAttributeValues: currentItem ? revisionValues(currentItem) : undefined,
      } },
    ];
    if (previousLessonKey) transaction.push({
      ConditionCheck: {
        TableName: learnerTable,
        Key: { userId: user, itemKey: `LESSON#${previousLessonKey}` },
        ConditionExpression: "completed = :true",
        ExpressionAttributeValues: { ":true": true },
      },
    });

    try {
      await db.send(new TransactWriteCommand({ TransactItems: transaction }));
      return jsonResponse(200, { score, completed: nextLesson.completed, bestScore: nextLesson.bestScore, lesson: publicRecord(nextLesson), requestId, serverTime: now });
    } catch (error) {
      if (!(await prepareTransactionRetry(error, attempt))) throw error;
      const replay = await idempotencyRecord(learnerTable, user, requestKey, fingerprint);
      if (replay) return lessonResponse(learnerTable, user, body.lessonKey, Number(replay.score ?? score), requestId, true);
    }
  }
  throw new ApiError(409, "STALE_PROGRESS", "Progress changed in another session; please try again");
}

async function lessonResponse(tableName: string, user: string, lessonKey: string, score: number, requestId: string, idempotentReplay: boolean) {
  const saved = (await getItem(tableName, user, "itemKey", `LESSON#${lessonKey}`)).Item as DynamoRecord | undefined;
  return jsonResponse(200, {
    score,
    completed: Boolean(saved?.completed),
    bestScore: Number(saved?.bestScore ?? score),
    lesson: saved ? publicRecord(saved) : undefined,
    requestId,
    idempotentReplay,
    serverTime: new Date().toISOString(),
  });
}

async function startGroup(user: string, groupId: string, rawBody: unknown) {
  const { phase } = parseWith(startGroupSchema, rawBody);
  const group = kanaGroups.find((candidate) => candidate.id === groupId);
  if (!group) throw new ApiError(404, "UNKNOWN_GROUP", "Unknown kana group");
  const learnerTable = requiredEnvironment("LEARNER_DATA_TABLE");
  const cardsTable = requiredEnvironment("REVIEW_CARDS_TABLE");
  const path = kanaGroups.filter((candidate) => candidate.script === group.script);
  const groupIndex = path.findIndex((candidate) => candidate.id === group.id);
  const previous = groupIndex > 0 ? path[groupIndex - 1] : undefined;

  if (phase === "recognition" && previous) {
    const saved = await getItem(learnerTable, user, "itemKey", `GROUP#${previous.id}`);
    if (!saved.Item?.proficient) throw new ApiError(409, "GROUP_LOCKED", "Become proficient in the previous kana group first");
  }
  if (phase === "recall") {
    await reconcileGroup(user, group.id);
    const saved = await getItem(learnerTable, user, "itemKey", `GROUP#${group.id}`);
    if (!saved.Item?.recognitionComplete && !saved.Item?.proficient) {
      throw new ApiError(409, "RECALL_LOCKED", "Complete recognition before starting recall");
    }
  }

  for (let attempt = 0; attempt < optimisticAttempts; attempt += 1) {
    const now = new Date();
    const emptyCard = createEmptyCard(now);
    const transaction: TransactionItems = group.items.map((item) => ({ Update: {
      TableName: cardsTable,
      Key: { userId: user, cardKey: `${item.id}:${phase}` },
      UpdateExpression: "SET itemId = if_not_exists(itemId, :item), direction = if_not_exists(direction, :direction), due = if_not_exists(due, :due), stability = if_not_exists(stability, :zero), difficulty = if_not_exists(difficulty, :zero), elapsed_days = if_not_exists(elapsed_days, :zero), scheduled_days = if_not_exists(scheduled_days, :zero), learning_steps = if_not_exists(learning_steps, :zero), reps = if_not_exists(reps, :zero), lapses = if_not_exists(lapses, :zero), #state = if_not_exists(#state, :zero), streak = if_not_exists(streak, :zero), learningStreak = if_not_exists(learningStreak, :zero), revision = if_not_exists(revision, :zero), curriculumOrder = if_not_exists(curriculumOrder, :order)",
      ExpressionAttributeNames: { "#state": "state" },
      ExpressionAttributeValues: {
        ":item": item.id,
        ":direction": phase,
        ":due": emptyCard.due.toISOString(),
        ":zero": 0,
        ":order": curriculumOrder.get(`${item.id}:${phase}`),
      },
    } }));
    const timestampField = phase === "recall" ? "recallStartedAt" : "startedAt";
    transaction.push({ Update: {
      TableName: learnerTable,
      Key: { userId: user, itemKey: `GROUP#${groupId}` },
      UpdateExpression: `SET ${timestampField} = if_not_exists(${timestampField}, :now)`,
      ConditionExpression: phase === "recall" ? "recognitionComplete = :true OR proficient = :true" : undefined,
      ExpressionAttributeValues: { ":now": now.toISOString(), ...(phase === "recall" ? { ":true": true } : {}) },
    } });
    if (phase === "recognition" && previous) transaction.push({ ConditionCheck: {
      TableName: learnerTable,
      Key: { userId: user, itemKey: `GROUP#${previous.id}` },
      ConditionExpression: "proficient = :true",
      ExpressionAttributeValues: { ":true": true },
    } });

    try {
      await db.send(new TransactWriteCommand({ TransactItems: transaction }));
      const status = await readGroupStatus(user, groupId);
      return jsonResponse(200, { ...status, phase, cardsCreated: group.items.length, serverTime: now.toISOString() });
    } catch (error) {
      if (!(await prepareTransactionRetry(error, attempt))) throw error;
      if (phase === "recall") {
        const saved = await getItem(learnerTable, user, "itemKey", `GROUP#${group.id}`);
        if (!saved.Item?.recognitionComplete && !saved.Item?.proficient) throw new ApiError(409, "RECALL_LOCKED", "Complete recognition before starting recall");
      }
      if (phase === "recognition" && previous) {
        const saved = await getItem(learnerTable, user, "itemKey", `GROUP#${previous.id}`);
        if (!saved.Item?.proficient) throw new ApiError(409, "GROUP_LOCKED", "Become proficient in the previous kana group first");
      }
    }
  }
  throw new ApiError(409, "GROUP_START_CONFLICT", "The group changed in another session; please try again");
}

async function groupStatus(user: string, groupId: string) {
  if (!kanaGroups.some((candidate) => candidate.id === groupId)) throw new ApiError(404, "UNKNOWN_GROUP", "Unknown kana group");
  await reconcileGroup(user, groupId);
  return jsonResponse(200, { ...(await readGroupStatus(user, groupId)), serverTime: new Date().toISOString() });
}

async function readGroupStatus(user: string, groupId: string) {
  const group = kanaGroups.find((candidate) => candidate.id === groupId);
  if (!group) throw new ApiError(404, "UNKNOWN_GROUP", "Unknown kana group");
  const cardsTable = requiredEnvironment("REVIEW_CARDS_TABLE");
  const learnerTable = requiredEnvironment("LEARNER_DATA_TABLE");
  const [cards, saved] = await Promise.all([
    queryAll({ TableName: cardsTable, KeyConditionExpression: "userId = :user", ExpressionAttributeValues: { ":user": user }, ConsistentRead: true }),
    getItem(learnerTable, user, "itemKey", `GROUP#${groupId}`),
  ]);
  const relevant = cards.filter((card) => group.items.some((item) => item.id === card.itemId));
  return {
    groupId,
    started: Boolean(saved.Item?.startedAt || relevant.some((card) => card.direction === "recognition")),
    recognitionComplete: Boolean(saved.Item?.recognitionComplete || saved.Item?.proficient),
    recallStarted: Boolean(saved.Item?.recallStartedAt || saved.Item?.proficient),
    proficient: Boolean(saved.Item?.proficient),
    cards: relevant.map(publicCard).sort((left, right) => rankOf(left) - rankOf(right)),
  };
}

async function reconcileGroup(user: string, groupId: string) {
  const group = kanaGroups.find((candidate) => candidate.id === groupId);
  if (!group) return;
  const cardsTable = requiredEnvironment("REVIEW_CARDS_TABLE");
  const learnerTable = requiredEnvironment("LEARNER_DATA_TABLE");
  const cards = await queryAll({ TableName: cardsTable, KeyConditionExpression: "userId = :user", ExpressionAttributeValues: { ":user": user }, ConsistentRead: true });
  const recognitionComplete = group.items.every((item) =>
    learningStreak(cards.find((card) => cardKeyOf(card) === `${item.id}:recognition`)) >= learningStreakRequired,
  );
  const proficient = recognitionComplete && group.items.every((item) =>
    learningStreak(cards.find((card) => cardKeyOf(card) === `${item.id}:recall`)) >= learningStreakRequired,
  );
  if (!recognitionComplete) return;
  const now = new Date().toISOString();
  await db.send(new UpdateCommand({
    TableName: learnerTable,
    Key: { userId: user, itemKey: `GROUP#${groupId}` },
    UpdateExpression: proficient
      ? "SET recognitionComplete = :true, recognitionCompletedAt = if_not_exists(recognitionCompletedAt, :now), proficient = :true, proficientAt = if_not_exists(proficientAt, :now)"
      : "SET recognitionComplete = :true, recognitionCompletedAt = if_not_exists(recognitionCompletedAt, :now)",
    ExpressionAttributeValues: { ":true": true, ":now": now },
  }));
}

async function submitLearning(user: string, rawBody: unknown) {
  const body = parseWith(learningSchema, rawBody);
  const item = kanaById[body.itemId];
  if (!item) throw new ApiError(400, "INVALID_CARD", "Invalid learning card");
  const cardsTable = requiredEnvironment("REVIEW_CARDS_TABLE");
  const learnerTable = requiredEnvironment("LEARNER_DATA_TABLE");
  const requestId = body.clientLearningId;
  const requestKey = `LEARN_ATTEMPT#${requestId}`;
  const fingerprint = JSON.stringify([body.itemId, body.direction, body.answer, body.inputMode]);
  const duplicate = await idempotencyRecord(learnerTable, user, requestKey, fingerprint);
  if (duplicate) return learningResponse(user, item, body.direction, Boolean(duplicate.correct), requestId, true);

  for (let attempt = 0; attempt < optimisticAttempts; attempt += 1) {
    const existing = await getItem(cardsTable, user, "cardKey", `${body.itemId}:${body.direction}`);
    const current = existing.Item as DynamoRecord | undefined;
    if (!current) throw new ApiError(409, "CARD_LOCKED", "This kana has not been unlocked");
    const correct = gradeAnswer(item, body.direction, body.answer);
    const nextStreak = correct ? learningStreak(current) + 1 : 0;
    const revision = Number(current.revision ?? 0);
    const now = new Date().toISOString();
    const transaction: TransactionItems = [
      { Update: {
        TableName: cardsTable,
        Key: { userId: user, cardKey: `${body.itemId}:${body.direction}` },
        UpdateExpression: "SET learningStreak = :streak, revision = :nextRevision",
        ConditionExpression: `attribute_exists(cardKey) AND ${revisionCondition(current)}`,
        ExpressionAttributeValues: { ":streak": nextStreak, ":nextRevision": revision + 1, ...revisionValues(current) },
      } },
      { Put: {
        TableName: learnerTable,
        Item: idempotencyItem(user, requestKey, fingerprint, now, { itemId: body.itemId, direction: body.direction, correct, answeredAt: now }),
        ConditionExpression: "attribute_not_exists(itemKey)",
      } },
    ];
    try {
      await db.send(new TransactWriteCommand({ TransactItems: transaction }));
      await reconcileGroup(user, item.groupId);
      return learningResponse(user, item, body.direction, correct, requestId, false);
    } catch (error) {
      if (!(await prepareTransactionRetry(error, attempt))) throw error;
      const replay = await idempotencyRecord(learnerTable, user, requestKey, fingerprint);
      if (replay) return learningResponse(user, item, body.direction, Boolean(replay.correct), requestId, true);
    }
  }
  throw new ApiError(409, "STALE_CARD", "This card changed in another session; please try again");
}

async function learningResponse(user: string, item: KanaItem, direction: Direction, correct: boolean, requestId: string, idempotentReplay: boolean) {
  await reconcileGroup(user, item.groupId);
  const cardsTable = requiredEnvironment("REVIEW_CARDS_TABLE");
  const current = (await getItem(cardsTable, user, "cardKey", `${item.id}:${direction}`)).Item as DynamoRecord | undefined;
  const status = await readGroupStatus(user, item.groupId);
  return jsonResponse(200, {
    correct,
    expected: direction === "recognition" ? item.romaji : item.kana,
    learningStreak: learningStreak(current),
    card: current ? publicCard(current) : undefined,
    recognitionComplete: status.recognitionComplete,
    groupComplete: status.proficient,
    group: status,
    requestId,
    idempotentReplay,
    serverTime: new Date().toISOString(),
  });
}

async function submitReview(user: string, rawBody: unknown) {
  const body = parseWith(reviewSchema, rawBody);
  const item = kanaById[body.itemId];
  if (!item) throw new ApiError(400, "INVALID_CARD", "Invalid review card");
  const cardsTable = requiredEnvironment("REVIEW_CARDS_TABLE");
  const logsTable = requiredEnvironment("REVIEW_LOGS_TABLE");
  const learnerTable = requiredEnvironment("LEARNER_DATA_TABLE");
  const requestId = body.clientReviewId;
  const requestKey = `REQUEST#REVIEW#${requestId}`;
  const fingerprint = JSON.stringify([body.itemId, body.direction, body.answer, body.inputMode, body.rating ?? null, body.responseMs]);
  const duplicate = await idempotencyRecord(learnerTable, user, requestKey, fingerprint);
  if (duplicate) return replayReview(user, duplicate, requestId);

  for (let attempt = 0; attempt < optimisticAttempts; attempt += 1) {
    const existing = await getItem(cardsTable, user, "cardKey", `${body.itemId}:${body.direction}`);
    const current = existing.Item as DynamoRecord | undefined;
    if (!current) throw new ApiError(409, "CARD_LOCKED", "This kana has not been unlocked");
    const now = new Date();
    if (Number(current.reps) > 0 && new Date(String(current.due)).getTime() > now.getTime()) {
      throw new ApiError(409, "CARD_NOT_DUE", "This card is not due yet; refresh the practice queue");
    }
    const correct = gradeAnswer(item, body.direction, body.answer);
    const rating = mapRating(correct, body.rating);
    const card = hydrateCard(current);
    const scheduled = scheduler.next(card, now, rating);
    const revision = Number(current.revision ?? 0);
    const nextCard = {
      ...scheduled.card,
      due: scheduled.card.due.toISOString(),
      last_review: scheduled.card.last_review?.toISOString(),
      streak: correct ? Number(current.streak ?? 0) + 1 : 0,
      learningStreak: learningStreak(current),
      revision: revision + 1,
      curriculumOrder: rankOf(current),
    };
    const reviewedAt = now.toISOString();
    const logKey = `${reviewedAt}#${requestId}`;
    const cardItem = { ...current, userId: user, cardKey: `${body.itemId}:${body.direction}`, itemId: body.itemId, direction: body.direction, ...nextCard };
    const transaction: TransactionItems = [
      { Put: {
        TableName: cardsTable,
        Item: cardItem,
        ConditionExpression: revisionCondition(current),
        ExpressionAttributeValues: revisionValues(current),
      } },
      { Put: {
        TableName: logsTable,
        Item: {
          userId: user,
          logKey,
          itemId: body.itemId,
          direction: body.direction,
          answer: body.answer,
          correct,
          rating,
          responseMs: body.responseMs,
          beforeState: publicCard(current),
          afterState: nextCard,
          schedulerVersion: "ts-fsrs@5.4.1",
          reviewedAt,
        },
        ConditionExpression: "attribute_not_exists(logKey)",
      } },
      { Put: {
        TableName: learnerTable,
        Item: idempotencyItem(user, requestKey, fingerprint, reviewedAt, { logKey }),
        ConditionExpression: "attribute_not_exists(itemKey)",
      } },
    ];
    if (Number(current.reps) === 0) transaction.push({ Update: {
      TableName: learnerTable,
      Key: { userId: user, itemKey: `DAILY#${reviewedAt.slice(0, 10)}` },
      UpdateExpression: "SET updatedAt = :now ADD newCards :one",
      ConditionExpression: "attribute_not_exists(newCards) OR newCards < :limit",
      ExpressionAttributeValues: { ":now": reviewedAt, ":one": 1, ":limit": maxNewCardsPerDay },
    } });

    try {
      await db.send(new TransactWriteCommand({ TransactItems: transaction }));
      return jsonResponse(200, {
        correct,
        expected: body.direction === "recognition" ? item.romaji : item.kana,
        rating,
        card: nextCard,
        requestId,
        serverTime: reviewedAt,
      });
    } catch (error) {
      if (!(await prepareTransactionRetry(error, attempt))) throw error;
      const replay = await idempotencyRecord(learnerTable, user, requestKey, fingerprint);
      if (replay) return replayReview(user, replay, requestId);
      if (Number(current.reps) === 0) {
        const daily = await getItem(learnerTable, user, "itemKey", `DAILY#${reviewedAt.slice(0, 10)}`);
        if (Number(daily.Item?.newCards ?? 0) >= maxNewCardsPerDay) {
          throw new ApiError(409, "DAILY_NEW_LIMIT_REACHED", "The daily new-card limit has been reached");
        }
      }
    }
  }
  throw new ApiError(409, "STALE_CARD", "This card changed in another session; refresh the practice queue");
}

async function replayReview(user: string, idempotency: DynamoRecord, requestId: string) {
  const logKey = String(idempotency.logKey ?? "");
  const logsTable = requiredEnvironment("REVIEW_LOGS_TABLE");
  const log = (await getItem(logsTable, user, "logKey", logKey)).Item as DynamoRecord | undefined;
  if (!log) throw new Error("Review idempotency record exists without its atomic review log");
  const item = kanaById[String(log.itemId)];
  return jsonResponse(200, {
    correct: Boolean(log.correct),
    expected: log.direction === "recognition" ? item?.romaji : item?.kana,
    rating: log.rating,
    card: log.afterState,
    requestId,
    idempotentReplay: true,
    serverTime: log.reviewedAt,
  });
}

function gradeAnswer(item: KanaItem, direction: Direction, answer: string) {
  if (direction === "recall") return answer === item.kana;
  return isRomajiAnswer(item, answer);
}

function mapRating(correct: boolean, requested?: Rating.Hard | Rating.Good | Rating.Easy) {
  if (!correct) return Rating.Again;
  return requested ?? Rating.Good;
}

function hydrateCard(record: DynamoRecord): Card {
  const parsed = storedFsrsSchema.safeParse(record);
  if (!parsed.success) throw new Error(`Invalid persisted FSRS card: ${parsed.error.message}`);
  return {
    due: new Date(parsed.data.due),
    stability: parsed.data.stability,
    difficulty: parsed.data.difficulty,
    elapsed_days: parsed.data.elapsed_days,
    scheduled_days: parsed.data.scheduled_days,
    learning_steps: parsed.data.learning_steps,
    reps: parsed.data.reps,
    lapses: parsed.data.lapses,
    state: parsed.data.state as State,
    last_review: parsed.data.last_review ? new Date(parsed.data.last_review) : undefined,
  };
}

function learningStreak(card?: DynamoRecord) {
  return Number(card?.learningStreak ?? card?.streak ?? 0);
}

function revisionCondition(current: DynamoRecord) {
  return current.revision === undefined ? "attribute_not_exists(revision)" : "revision = :expectedRevision";
}

function revisionValues(current: DynamoRecord) {
  return current.revision === undefined ? undefined : { ":expectedRevision": Number(current.revision) };
}

function idempotencyItem(user: string, itemKey: string, fingerprint: string, now: string, fields: DynamoRecord = {}) {
  return {
    userId: user,
    itemKey,
    fingerprint,
    createdAt: now,
    expiresAt: Math.floor(new Date(now).getTime() / 1000) + idempotencyTtlSeconds,
    ...fields,
  };
}

async function idempotencyRecord(tableName: string, user: string, itemKey: string, fingerprint: string) {
  const existing = (await getItem(tableName, user, "itemKey", itemKey)).Item as DynamoRecord | undefined;
  if (!existing) return undefined;
  if (existing.fingerprint !== fingerprint) {
    throw new ApiError(409, "IDEMPOTENCY_KEY_REUSED", "This request ID was already used for different data");
  }
  return existing;
}

function transactionFailureKind(error: unknown): "conditional" | "conflict" | undefined {
  const name = error instanceof Error ? error.name : String((error as { name?: unknown })?.name ?? "");
  if (name === "ConditionalCheckFailedException") return "conditional";
  if (name === "TransactionConflictException") return "conflict";
  if (name !== "TransactionCanceledException") return undefined;

  const reasons = (error as { CancellationReasons?: Array<{ Code?: unknown }> }).CancellationReasons;
  if (!Array.isArray(reasons)) return undefined;
  const codes = reasons
    .map((reason) => typeof reason?.Code === "string" ? reason.Code : undefined)
    .filter((code): code is string => Boolean(code) && code !== "None");
  if (!codes.length || codes.some((code) => code !== "ConditionalCheckFailed" && code !== "TransactionConflict")) {
    return undefined;
  }
  return codes.includes("TransactionConflict") ? "conflict" : "conditional";
}

async function prepareTransactionRetry(error: unknown, attempt: number) {
  const kind = transactionFailureKind(error);
  if (!kind) return false;
  if (kind === "conflict") {
    await new Promise((resolve) => setTimeout(resolve, Math.min(160, 10 * (2 ** attempt))));
  }
  return true;
}

export const apiTestHelpers = { compareCards, gradeAnswer, mapRating, rankOf, transactionFailureKind };
