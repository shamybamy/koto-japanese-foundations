import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("authenticated AWS requests", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_COGNITO_USER_POOL_ID", "ap-southeast-1_example");
    vi.stubEnv("NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID", "example-client");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.test/v1/");
    vi.doMock("aws-amplify", () => ({ Amplify: { configure: vi.fn() } }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.doUnmock("aws-amplify");
    vi.doUnmock("aws-amplify/auth");
  });

  it("normalizes the URL and includes the signed Cognito token", async () => {
    vi.doMock("aws-amplify/auth", () => ({
      fetchAuthSession: vi.fn().mockResolvedValue({ tokens: { idToken: { toString: () => "signed-token" } } }),
    }));
    const request = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    const { authenticatedFetch } = await import("@/lib/aws");

    await authenticatedFetch("/dashboard");

    expect(request).toHaveBeenCalledWith("https://api.example.test/v1/dashboard", expect.any(Object));
    const options = request.mock.calls[0][1];
    expect(new Headers(options?.headers).get("authorization")).toBe("signed-token");
  });

  it("rejects a request when no signed-in token exists", async () => {
    vi.doMock("aws-amplify/auth", () => ({ fetchAuthSession: vi.fn().mockResolvedValue({}) }));
    const request = vi.spyOn(globalThis, "fetch");
    const { authenticatedFetch } = await import("@/lib/aws");

    await expect(authenticatedFetch("dashboard")).rejects.toThrow("session has expired");
    expect(request).not.toHaveBeenCalled();
  });

  it("turns a rejected API response into a useful error", async () => {
    vi.doMock("aws-amplify/auth", () => ({
      fetchAuthSession: vi.fn().mockResolvedValue({ tokens: { idToken: { toString: () => "signed-token" } } }),
    }));
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: "Complete the previous lesson first", code: "LESSON_LOCKED" }), {
      status: 409,
      headers: { "content-type": "application/json" },
    }));
    const { authenticatedJson } = await import("@/lib/aws");

    await expect(authenticatedJson("lessons/check", { method: "POST" })).rejects.toEqual(
      expect.objectContaining({ message: "Complete the previous lesson first", status: 409, code: "LESSON_LOCKED" }),
    );
  });
});
