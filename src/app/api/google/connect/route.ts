import { NextRequest, NextResponse } from "next/server";
import {
  appUrl,
  GOOGLE_RETURN_COOKIE,
  GOOGLE_STATE_COOKIE,
  googleConfigured,
} from "@/lib/google";

function safeReturnTo(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export async function GET(request: NextRequest) {
  if (!googleConfigured()) {
    return NextResponse.redirect(new URL("/?setup=google", request.url));
  }

  const state = crypto.randomUUID();
  const returnTo = safeReturnTo(request.nextUrl.searchParams.get("returnTo"));
  const redirectUri = `${appUrl(request.url)}/api/google/callback`;
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: [
      "openid",
      "email",
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/drive.appdata",
      // Explicit user-selected repair flow only; normal connections stay per-file.
      ...(request.nextUrl.searchParams.get("existingDocs") === "1"
        ? ["https://www.googleapis.com/auth/drive.readonly"] : []),
    ].join(" "),
    state,
  });

  const response = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  );
  response.cookies.set(GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  response.cookies.set(GOOGLE_RETURN_COOKIE, returnTo, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
