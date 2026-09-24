import { NextRequest, NextResponse } from "next/server";
import { getClientProfileAsync } from "@/lib/client-store";
import { getGoogleAccessToken, getGoogleEmail } from "@/lib/google";
import { getWordPressConfigAsync, wordPressAuthorization } from "@/lib/wordpress";
import { syncPublishedGeoDirectory } from "@/lib/geo-directory";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function allowedPublisher(email: string | null) {
  if (!email) return false;
  return (process.env.WORDPRESS_ALLOWED_GOOGLE_EMAILS || "accounts@amplifylaw.ai")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}

export async function POST(request: NextRequest) {
  try {
    const input = await request.json() as { clientId?: string; pageId?: number };
    const pageId = Number(input.pageId);
    const accessToken = await getGoogleAccessToken();
    const email = await getGoogleEmail(accessToken);
    if (!allowedPublisher(email)) {
      return NextResponse.json({ error: "This Google account is not allowed to update WordPress pages." }, { status: 403 });
    }
    const client = await getClientProfileAsync(input.clientId, undefined, accessToken);
    if (!client?.wordpress || !Number.isInteger(pageId) || pageId <= 0) {
      return NextResponse.json({ error: "The client or published GEO page is missing." }, { status: 400 });
    }
    const config = await getWordPressConfigAsync(client.id, undefined, accessToken);
    const authorization = wordPressAuthorization(config);
    const directoryPagesLinked = await syncPublishedGeoDirectory(config.siteUrl, authorization, pageId);
    return NextResponse.json({ ok: true, pageId, directoryPagesLinked });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The GEO directory links could not be synchronized.";
    const status = /not connected|reconnect|expired|authorized/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
