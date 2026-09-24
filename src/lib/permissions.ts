import { getGoogleAccessToken, getGoogleEmail } from "@/lib/google";

export function allowedAmplifyEmail(email: string | null) {
  if (!email) return false;
  return (process.env.WORDPRESS_ALLOWED_GOOGLE_EMAILS || "accounts@amplifylaw.ai")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}

export async function authorizedAmplifyUser() {
  const accessToken = await getGoogleAccessToken();
  const email = await getGoogleEmail(accessToken);
  if (!allowedAmplifyEmail(email)) {
    throw new Error("This Google account is not allowed to manage AMPLIFY client connections.");
  }
  return { accessToken, email: email! };
}
