import type { APIGatewayProxyEvent } from "aws-lambda";
import { BatchGetCommand, GetCommand, QueryCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { Rating } from "ts-fsrs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { kanaById } from "../../lib/kana";

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock("@aws-sdk/lib-dynamodb", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@aws-sdk/lib-dynamodb")>();
  return {
    ...actual,
    DynamoDBDocumentClient: { from: () => ({ send: sendMock }) },
  };
});

import { apiTestHelpers, handler } from "./api";

function event(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    body: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: "GET",
    isBase64Encoded: false,
    path: "/",
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    resource: "/dashboard",
    requestContext: {
      accountId: "test",
      apiId: "test",
      authorizer: { claims: { sub: "claim-user", email: "learner@example.com" } },
      protocol: "HTTP/1.1",
      httpMethod: "GET",
      identity: {} as APIGatewayProxyEvent["requestContext"]["identity"],
      path: "/dashboard",
      stage: "test",
      requestId: "request",
      requestTimeEpoch: 0,
      resourceId: "resource",
      resourcePath: "/dashboard",
    },
    ...overrides,
  };
}

function payload(result: { body: string }) {
  return JSON.parse(result.body) as Record<string, unknown>;
}

describe("API boundary validation", () => {
  beforeEach(() => {
    sendMock.mockReset();
    process.env.LEARNER_DATA_TABLE = "learner-data";
    process.env.REVIEW_CARDS_TABLE = "review-cards";
    process.env.REVIEW_LOGS_TABLE = "review-logs";
    process.env.DUE_INDEX = "due-index";
    process.env.ALLOWED_ORIGINS = "http://localhost:3000";
  });

  it.each([
    [[1, 0, 1, 0, 0], 80, false],
    [[1, 0, 1, 0, 1], 100, true],
  ])("requires every lesson answer to be correct: %j", async (answers, score, completed) => {
    sendMock.mockResolvedValue({});
    const result = await handler(event({
      httpMethod: "POST",
      resource: "/lessons/check",
      body: JSON.stringify({ lessonKey: "sounds/vowels", answers, clientLessonId: crypto.randomUUID() }),
    }));
    expect(result.statusCode).toBe(200);
    const transaction = sendMock.mock.calls.map(([command]) => command).find((command) => command instanceof TransactWriteCommand);
    const lessonWrite = transaction?.input.TransactItems?.find((item: { Put?: { Item?: { itemKey?: string } } }) => item.Put?.Item?.itemKey === "LESSON#sounds/vowels");
    expect(lessonWrite?.Put?.Item).toMatchObject({ bestScore: score, completed });
  });

  it("rejects a request without a verified Cognito subject before touching storage", async () => {
    const result = await handler(event({ requestContext: { ...event().requestContext, authorizer: undefined } }));
    expect(result.statusCode).toBe(401);
    expect(payload(result).code).toBe("UNAUTHORIZED");
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("answers preflight without authentication and only allows configured origins", async () => {
    process.env.ALLOWED_ORIGINS = "http://localhost:3000,https://dev.example.com";
    const allowed = await handler(event({
      httpMethod: "OPTIONS",
      headers: { origin: "https://dev.example.com" },
      requestContext: { ...event().requestContext, authorizer: undefined },
    }));
    const denied = await handler(event({
      httpMethod: "OPTIONS",
      headers: { origin: "https://untrusted.example.com" },
      requestContext: { ...event().requestContext, authorizer: undefined },
    }));

    expect(allowed.statusCode).toBe(204);
    expect(allowed.headers).toMatchObject({
      "access-control-allow-origin": "https://dev.example.com",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type,authorization",
    });
    expect(denied.headers).not.toHaveProperty("access-control-allow-origin");
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON and does not default a mutating request", async () => {
    const result = await handler(event({
      resource: "/kana/groups/{id}/start",
      httpMethod: "POST",
      pathParameters: { id: "h-vowels" },
      body: "{not-json",
    }));
    expect(result.statusCode).toBe(400);
    expect(payload(result).code).toBe("INVALID_JSON");
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("rejects client-supplied authority fields", async () => {
    const result = await handler(event({
      resource: "/reviews/submit",
      httpMethod: "POST",
      body: JSON.stringify({
        itemId: "hiragana-a-あ",
        direction: "recognition",
        answer: "a",
        inputMode: "typed",
        responseMs: 1200,
        clientReviewId: "11111111-1111-4111-8111-111111111111",
        userId: "another-user",
        correct: true,
        due: "2099-01-01T00:00:00.000Z",
        stability: 999,
      }),
    }));
    expect(result.statusCode).toBe(400);
    expect(payload(result).code).toBe("INVALID_REQUEST");
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("rejects an out-of-range response time", async () => {
    const result = await handler(event({
      resource: "/reviews/submit",
      httpMethod: "POST",
      body: JSON.stringify({
        itemId: "hiragana-a-あ",
        direction: "recognition",
        answer: "a",
        inputMode: "typed",
        responseMs: -1,
        clientReviewId: "11111111-1111-4111-8111-111111111111",
      }),
    }));
    expect(result.statusCode).toBe(400);
    expect(payload(result).code).toBe("INVALID_REQUEST");
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("rejects the retired voice input mode", async () => {
    const result = await handler(event({
      resource: "/reviews/submit",
      httpMethod: "POST",
      body: JSON.stringify({
        itemId: "hiragana-a-あ",
        direction: "recognition",
        answer: "a",
        inputMode: "voice",
        responseMs: 1000,
        clientReviewId: "11111111-1111-4111-8111-111111111111",
      }),
    }));
    expect(result.statusCode).toBe(400);
    expect(payload(result).code).toBe("INVALID_REQUEST");
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("rejects reuse of an operation ID with different data", async () => {
    sendMock.mockResolvedValue({ Item: { fingerprint: "different-request" } });
    const result = await handler(event({
      resource: "/reviews/submit",
      httpMethod: "POST",
      body: JSON.stringify({
        itemId: "hiragana-a-あ",
        direction: "recognition",
        answer: "a",
        inputMode: "typed",
        responseMs: 1200,
        clientReviewId: "11111111-1111-4111-8111-111111111111",
      }),
    }));
    expect(result.statusCode).toBe(409);
    expect(payload(result).code).toBe("IDEMPOTENCY_KEY_REUSED");
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][0]).toBeInstanceOf(GetCommand);
  });

  it("rejects unsupported queue filters rather than silently returning no cards", async () => {
    const result = await handler(event({
      resource: "/reviews/queue",
      queryStringParameters: { script: "kanji" },
    }));
    expect(result.statusCode).toBe(400);
    expect(payload(result).code).toBe("INVALID_REQUEST");
    expect(sendMock).not.toHaveBeenCalled();
  });
});

describe("review queue", () => {
  beforeEach(() => {
    sendMock.mockReset();
    process.env.LEARNER_DATA_TABLE = "learner-data";
    process.env.REVIEW_CARDS_TABLE = "review-cards";
    process.env.REVIEW_LOGS_TABLE = "review-logs";
    process.env.DUE_INDEX = "due-index";
  });

  it("paginates the due index, puts all due cards first, and orders new cards by curriculum", async () => {
    const dueA = { userId: "claim-user", cardKey: "hiragana-a-あ:recognition", itemId: "hiragana-a-あ", direction: "recognition", due: "2020-01-02T00:00:00.000Z", reps: 1 };
    const dueI = { userId: "claim-user", cardKey: "hiragana-i-い:recognition", itemId: "hiragana-i-い", direction: "recognition", due: "2020-01-01T00:00:00.000Z", reps: 2 };
    const newA = { userId: "claim-user", cardKey: "hiragana-a-あ:recognition", itemId: "hiragana-a-あ", direction: "recognition", due: "2020-01-01T00:00:00.000Z", reps: 0 };
    const newI = { userId: "claim-user", cardKey: "hiragana-i-い:recognition", itemId: "hiragana-i-い", direction: "recognition", due: "2020-01-01T00:00:00.000Z", reps: 0 };
    let duePage = 0;
    sendMock.mockImplementation(async (command: unknown) => {
      if (command instanceof QueryCommand) {
        if (command.input.IndexName === "due-index") {
          duePage += 1;
          return duePage === 1 ? { Items: [dueA], LastEvaluatedKey: { userId: "claim-user", due: dueA.due } } : { Items: [dueI] };
        }
        return { Items: [newI, newA] };
      }
      if (command instanceof BatchGetCommand) return { Responses: { "review-cards": [dueA, dueI] } };
      if (command instanceof GetCommand) return { Item: { newCards: 2 } };
      throw new Error("Unexpected command");
    });

    const result = await handler(event({ resource: "/reviews/queue", queryStringParameters: { script: "hiragana", direction: "recognition" } }));
    const body = payload(result) as { cards: Array<{ itemId: string; reps: number }>; dueCount: number; newCount: number };
    expect(result.statusCode).toBe(200);
    expect(body.cards.map((card) => `${card.itemId}:${card.reps}`)).toEqual([
      "hiragana-i-い:2",
      "hiragana-a-あ:1",
      "hiragana-a-あ:0",
      "hiragana-i-い:0",
    ]);
    expect(body.dueCount).toBe(2);
    expect(body.newCount).toBe(2);
    const dueQueries = sendMock.mock.calls
      .map(([command]) => command)
      .filter((command) => command instanceof QueryCommand && command.input.IndexName === "due-index");
    expect(dueQueries).toHaveLength(2);
    expect(dueQueries[0].input.KeyConditionExpression).toContain("due <= :now");
  });

  it("drops a stale due-index candidate after a consistent base-table read", async () => {
    const stale = { userId: "claim-user", cardKey: "hiragana-a-あ:recognition", itemId: "hiragana-a-あ", direction: "recognition", due: "2020-01-01T00:00:00.000Z", reps: 1, revision: 1 };
    const current = { ...stale, due: "2099-01-01T00:00:00.000Z", revision: 2 };
    sendMock.mockImplementation(async (command: unknown) => {
      if (command instanceof QueryCommand) return command.input.IndexName ? { Items: [stale] } : { Items: [] };
      if (command instanceof BatchGetCommand) return { Responses: { "review-cards": [current] } };
      if (command instanceof GetCommand) return {};
      throw new Error("Unexpected command");
    });

    const result = await handler(event({ resource: "/reviews/queue", queryStringParameters: { script: "hiragana", direction: "recognition" } }));
    expect(result.statusCode).toBe(200);
    expect(payload(result)).toMatchObject({ cards: [], dueCount: 0 });
  });
});

describe("review submission", () => {
  beforeEach(() => {
    sendMock.mockReset();
    process.env.LEARNER_DATA_TABLE = "learner-data";
    process.env.REVIEW_CARDS_TABLE = "review-cards";
    process.env.REVIEW_LOGS_TABLE = "review-logs";
  });

  it("atomically stores the versioned card, append-only log, idempotency marker, and daily count", async () => {
    const card = {
      userId: "claim-user",
      cardKey: "hiragana-a-あ:recognition",
      itemId: "hiragana-a-あ",
      direction: "recognition",
      due: "2020-01-01T00:00:00.000Z",
      stability: 0,
      difficulty: 0,
      elapsed_days: 0,
      scheduled_days: 0,
      learning_steps: 0,
      reps: 0,
      lapses: 0,
      state: 0,
      streak: 0,
      learningStreak: 0,
      revision: 0,
    };
    let transaction: TransactWriteCommand | undefined;
    sendMock.mockImplementation(async (command: unknown) => {
      if (command instanceof GetCommand) {
        if (command.input.TableName === "review-cards") return { Item: card };
        return {};
      }
      if (command instanceof TransactWriteCommand) {
        transaction = command;
        return {};
      }
      throw new Error("Unexpected command");
    });

    const result = await handler(event({
      resource: "/reviews/submit",
      httpMethod: "POST",
      body: JSON.stringify({
        itemId: "hiragana-a-あ",
        direction: "recognition",
        answer: "wrong",
        inputMode: "typed",
        rating: Rating.Easy,
        responseMs: 1234,
        clientReviewId: "11111111-1111-4111-8111-111111111111",
      }),
    }));

    expect(result.statusCode).toBe(200);
    expect(payload(result)).toMatchObject({ correct: false, rating: Rating.Again });
    expect(transaction).toBeDefined();
    const writes = transaction!.input.TransactItems!;
    expect(writes).toHaveLength(4);
    expect(writes[0].Put?.ConditionExpression).toBe("revision = :expectedRevision");
    expect(writes[0].Put?.Item).toMatchObject({ userId: "claim-user", revision: 1 });
    expect(writes[1].Put?.Item).toMatchObject({ userId: "claim-user", responseMs: 1234, correct: false, rating: Rating.Again });
    expect(writes[1].Put?.ConditionExpression).toBe("attribute_not_exists(logKey)");
    expect(writes[2].Put?.Item).toMatchObject({ userId: "claim-user", itemKey: "REQUEST#REVIEW#11111111-1111-4111-8111-111111111111" });
    expect(writes[3].Update?.ConditionExpression).toContain("newCards < :limit");
  });
});

describe("trusted grading helpers", () => {
  it("maps every incorrect answer to Again and defaults correct answers to Good", () => {
    expect(apiTestHelpers.mapRating(false, Rating.Easy)).toBe(Rating.Again);
    expect(apiTestHelpers.mapRating(true)).toBe(Rating.Good);
    expect(apiTestHelpers.mapRating(true, Rating.Hard)).toBe(Rating.Hard);
  });

  it("accepts a typed rōmaji alias", () => {
    const shi = kanaById["hiragana-shi-し"];
    expect(apiTestHelpers.gradeAnswer(shi, "recognition", "si")).toBe(true);
  });

  it("retries only conditional or transaction-conflict cancellations", () => {
    expect(apiTestHelpers.transactionFailureKind({
      name: "TransactionCanceledException",
      CancellationReasons: [{ Code: "None" }, { Code: "ConditionalCheckFailed" }],
    })).toBe("conditional");
    expect(apiTestHelpers.transactionFailureKind({
      name: "TransactionCanceledException",
      CancellationReasons: [{ Code: "TransactionConflict" }, { Code: "None" }],
    })).toBe("conflict");
    expect(apiTestHelpers.transactionFailureKind({
      name: "TransactionCanceledException",
      CancellationReasons: [{ Code: "ThrottlingError" }, { Code: "None" }],
    })).toBeUndefined();
    expect(apiTestHelpers.transactionFailureKind({
      name: "TransactionCanceledException",
      CancellationReasons: [{ Code: "ConditionalCheckFailed" }, { Code: "ValidationError" }],
    })).toBeUndefined();
    expect(apiTestHelpers.transactionFailureKind({ name: "TransactionCanceledException" })).toBeUndefined();
  });
});
