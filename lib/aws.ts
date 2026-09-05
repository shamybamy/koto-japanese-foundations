import { Amplify } from "aws-amplify";

export const awsConfigured = Boolean(
  process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID &&
  process.env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID &&
  process.env.NEXT_PUBLIC_API_URL,
);

let configured = false;

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
  configureAws();
  const { fetchAuthSession } = await import("aws-amplify/auth");
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();
  return fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    ...init,
    headers: { "content-type": "application/json", authorization: `Bearer ${token}`, ...init?.headers },
  });
}
