import { NextResponse } from "next/server";
import {
  getWordPressConfig,
  wordpressConfigured,
  wordPressRequestHeaders,
} from "@/lib/wordpress";

export const dynamic = "force-dynamic";

export async function GET() {
  const configured = wordpressConfigured();
  if (!configured) {
    return NextResponse.json({ configured: false, connected: false, siteUrl: null });
  }

  try {
    const config = getWordPressConfig();
    const siteUrl = new URL(config.siteUrl).origin;
    const response = await fetch(
      `${config.siteUrl}/wp-json/wp/v2/pages?context=edit&per_page=1&_fields=id`,
      {
        headers: wordPressRequestHeaders(config),
        redirect: "follow",
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const cloudflareChallenge = response.headers.get("cf-mitigated") === "challenge";
      return NextResponse.json({
        configured: true,
        connected: false,
        siteUrl,
        message: cloudflareChallenge
          ? "Cloudflare is challenging the WordPress REST API. Exempt /wp-json/ from the bot challenge to enable publishing."
          : response.status === 401 || response.status === 403
            ? "WordPress rejected the username or Application Password."
            : "WordPress is configured but its Pages API could not be reached.",
      });
    }

    return NextResponse.json({ configured: true, connected: true, siteUrl });
  } catch (error) {
    return NextResponse.json({
      configured: true,
      connected: false,
      siteUrl: null,
      message:
        error instanceof Error ? error.message : "The WordPress connection could not be checked.",
    });
  }
}
