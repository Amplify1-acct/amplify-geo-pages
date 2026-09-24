import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { AsyncLocalStorage } from "node:async_hooks";

// Server-only context for durable upload jobs; never populated from request headers.
const jobGoogleToken = new AsyncLocalStorage<string>();
export function withJobGoogleToken<T>(token: string, work: () => Promise<T>) {
  return jobGoogleToken.run(token, work);
}

export const GOOGLE_REFRESH_COOKIE = "amplify_google_refresh";
export const GOOGLE_STATE_COOKIE = "amplify_google_state";
export const GOOGLE_RETURN_COOKIE = "amplify_google_return_to";

export function googleConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_TOKEN_SECRET,
  );
}

export function appUrl(requestUrl?: string) {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }

  return requestUrl ? new URL(requestUrl).origin : "http://localhost:3000";
}

function encryptionKey() {
  const secret = process.env.GOOGLE_TOKEN_SECRET;
  if (!secret) throw new Error("GOOGLE_TOKEN_SECRET is not configured.");
  return createHash("sha256").update(secret).digest();
}

export function encryptToken(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function decryptToken(value: string) {
  const payload = Buffer.from(value, "base64url");
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const encrypted = payload.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export async function getGoogleAccessToken() {
  const jobToken = jobGoogleToken.getStore();
  if (jobToken) return jobToken;
  if (!googleConfigured()) {
    throw new Error("Google OAuth is not configured.");
  }

  const cookieStore = await cookies();
  const encrypted = cookieStore.get(GOOGLE_REFRESH_COOKIE)?.value;
  if (!encrypted) throw new Error("Google Drive is not connected.");

  return refreshGoogleAccessToken(encrypted);
}

export async function refreshGoogleAccessToken(encrypted: string) {

  let refreshToken: string;
  try {
    refreshToken = decryptToken(encrypted);
  } catch {
    throw new Error("The Google connection expired. Please reconnect Google Drive.");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });

  const data = (await response.json()) as { access_token?: string; error_description?: string };
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || "Google Drive could not be authorized.");
  }

  return data.access_token;
}

export async function getGoogleEmail(accessToken: string) {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!response.ok) return null;
  const data = (await response.json()) as { email?: string };
  return data.email || null;
}
