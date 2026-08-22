import { NextRequest, NextResponse } from "next/server";
import {
  appUrl,
  encryptToken,
  GOOGLE_REFRESH_COOKIE,
  GOOGLE_STATE_COOKIE,
} from "@/lib/google";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get(GOOGLE_STATE_COOKIE)?.value;
  const baseUrl = appUrl(request.url);

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(`${baseUrl}/?google=failed`);
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${baseUrl}/api/google/callback`,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });

  const tokenData = (await tokenResponse.json()) as {
    refresh_token?: string;
    error_description?: string;
  };

  if (!tokenResponse.ok || !tokenData.refresh_token) {
    return NextResponse.redirect(`${baseUrl}/?google=failed`);
  }

  const response = NextResponse.redirect(`${baseUrl}/?google=connected`);
  response.cookies.set(GOOGLE_REFRESH_COOKIE, encryptToken(tokenData.refresh_token), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 90,
    path: "/",
  });
  response.cookies.delete(GOOGLE_STATE_COOKIE);
  return response;
}
