import { NextRequest, NextResponse } from "next/server";
import { getGoogleAccessToken, getGoogleEmail } from "@/lib/google";
import {
  getWordPressConfig,
  wordPressRequestHeaders,
} from "@/lib/wordpress";
import type { WordPressConnectionInput } from "@/lib/wordpress";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function allowedPublisher(email: string | null) {
  if (!email) return false;
  const allowed = (process.env.WORDPRESS_ALLOWED_GOOGLE_EMAILS || "accounts@amplifylaw.ai")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}

export async function POST(request: NextRequest) {
  try {
    const connection = (await request.json()) as WordPressConnectionInput;

    const accessToken = await getGoogleAccessToken();
    const googleEmail = await getGoogleEmail(accessToken);
    if (!allowedPublisher(googleEmail)) {
      return NextResponse.json(
        { error: "This Google account is not allowed to connect WordPress sites." },
        { status: 403 },
      );
    }

    const config = getWordPressConfig(connection);
    const response = await fetch(
      `${config.siteUrl}/wp-json/wp/v2/users/me?context=edit&_fields=id,name,capabilities`,
      {
        headers: wordPressRequestHeaders(config),
        redirect: "follow",
        cache: "no-store",
      },
    );

    if (response.headers.get("cf-mitigated") === "challenge") {
      throw new Error(
        `Cloudflare is challenging ${new URL(config.siteUrl).hostname}. Exempt this app from the site’s bot challenge for /wp-json/.`,
      );
    }

    const text = await response.text();
    let data: {
      id?: number;
      name?: string;
      message?: string;
      capabilities?: Record<string, boolean>;
    };
    try {
      data = JSON.parse(text) as typeof data;
    } catch {
      throw new Error("WordPress returned an unexpected response instead of its REST API.");
    }

    if (!response.ok || !data.id) {
      throw new Error(data.message || `WordPress rejected the connection (${response.status}).`);
    }
    if (
      data.capabilities &&
      !data.capabilities.edit_pages &&
      !data.capabilities.publish_pages
    ) {
      throw new Error("This WordPress user cannot create page drafts.");
    }

    return NextResponse.json({
      connected: true,
      siteUrl: config.siteUrl,
      hostname: new URL(config.siteUrl).hostname.replace(/^www\./, ""),
      name: data.name || config.username,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "The WordPress connection could not be tested.",
      },
      { status: 422 },
    );
  }
}
