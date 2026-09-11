import { Amplify } from "aws-amplify";

export const awsConfigured = Boolean(
  process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID &&
  process.env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID &&
  process.env.NEXT_PUBLIC_API_URL,
);

let configured = false;

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export function configureAws() {
  if (!awsConfigured || configured) return;
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!,
        userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID!,
        signUpVerificationMethod: "code",
        loginWith: { email: true },
      },
    },
  });
  configured = true;
}

export async function authenticatedFetch(path: string, init?: RequestInit) {
  if (!awsConfigured) {
    throw new ApiRequestError("AWS is not configured for this build.");
  }
  configureAws();
  const { fetchAuthSession } = await import("aws-amplify/auth");
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();
  if (!token) {
    throw new ApiRequestError("Your sign-in session has expired. Please sign in again.", 401);
  }

  const baseUrl = process.env.NEXT_PUBLIC_API_URL!.replace(/\/+$/, "");
  const requestPath = path.replace(/^\/+/, "");
  const headers = new Headers(init?.headers);
  if (!headers.has("content-type")) headers.set("content-type", "application/json");
  // API Gateway's REST Cognito user-pool authorizer expects the JWT itself in
  // this header. A `Bearer ` prefix is for different authorizer types.
  headers.set("authorization", token);
  return fetch(`${baseUrl}/${requestPath}`, {
    ...init,
    headers,
  });
}

/**
 * Make an authenticated API request and return its decoded JSON body. Non-2xx
 * responses are errors so callers cannot accidentally treat rejected writes as
 * saved progress.
 */
export async function authenticatedJson<T>(path: string, init?: RequestInit): Promise<T> {
  let result: Response;
  try {
    result = await authenticatedFetch(path, init);
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;
    throw new ApiRequestError("Koto could not reach AWS. Check your connection and try again.");
  }

  const text = await result.text();
  let payload: unknown = {};
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      if (result.ok) throw new ApiRequestError("AWS returned an unreadable response.", result.status);
    }
  }

  if (!result.ok) {
    const serverMessage = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
      ? payload.error
      : `AWS rejected the request (${result.status}).`;
    const serverCode = payload && typeof payload === "object" && "code" in payload && typeof payload.code === "string"
      ? payload.code
      : undefined;
    throw new ApiRequestError(serverMessage, result.status, serverCode);
  }

  return payload as T;
}
