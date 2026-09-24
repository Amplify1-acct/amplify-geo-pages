import { NextRequest, NextResponse } from "next/server";
import { getClientProfileAsync } from "@/lib/client-store";
import {
  normalizePersonalInjuryGeoDirectoryAnchors,
  personalInjuryGeoDirectoryAnchorLabels,
} from "@/lib/geo-directory-labels";
import { getGoogleAccessToken, getGoogleEmail } from "@/lib/google";
import { getWordPressConfigAsync, wordPressAuthorization } from "@/lib/wordpress";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type WordPressPage = {
  id?: number;
  link?: string;
  slug?: string;
  status?: string;
  title?: { raw?: string; rendered?: string };
  content?: { raw?: string; rendered?: string };
  message?: string;
};

const personalInjuryGeoSlugPattern = /^.+-personal-injury-lawyers?$/i;

function allowedPublisher(email: string | null) {
  if (!email) return false;
  return (process.env.WORDPRESS_ALLOWED_GOOGLE_EMAILS || "accounts@amplifylaw.ai")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}

async function wordPressJson<T>(response: Response, action: string): Promise<T> {
  const text = await response.text();
  const challenged = response.headers.get("cf-mitigated") === "challenge"
    || /<title>\s*Just a moment\.\.\.\s*<\/title>/i.test(text);
  if (challenged) throw new Error("Cloudflare challenged the WordPress directory update.");
  if (!text.trim()) throw new Error(`WordPress returned an empty response while ${action}.`);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`WordPress returned an unexpected response while ${action}.`);
  }
}

async function discoverPersonalInjuryGeoSlugs(siteUrl: string, authorization: string) {
  const slugs = new Set<string>();
  let pageNumber = 1;
  let totalPages = 1;

  do {
    const params = new URLSearchParams({
      status: "publish",
      context: "edit",
      per_page: "100",
      page: String(pageNumber),
      _fields: "slug",
    });
    const response = await fetch(`${siteUrl}/wp-json/wp/v2/pages?${params}`, {
      headers: { Authorization: authorization },
      cache: "no-store",
    });
    const pages = await wordPressJson<WordPressPage[]>(response, `discovering personal-injury GEO pages (batch ${pageNumber})`);
    if (!response.ok || !Array.isArray(pages)) {
      throw new Error("WordPress did not return the published page directory.");
    }
    for (const page of pages) {
      const slug = page.slug?.trim().toLowerCase() || "";
      if (personalInjuryGeoSlugPattern.test(slug)) slugs.add(slug);
    }
    const reportedTotal = Number(response.headers.get("x-wp-totalpages") || "1");
    totalPages = Number.isFinite(reportedTotal) && reportedTotal > 0 ? Math.min(reportedTotal, 50) : 1;
    pageNumber += 1;
  } while (pageNumber <= totalPages);

  return [...slugs].sort();
}

export async function POST(request: NextRequest) {
  try {
    const input = await request.json() as { clientId?: string; confirmed?: boolean };
    if (input.confirmed !== true) {
      return NextResponse.json({ error: "Confirmation is required before updating the published directories." }, { status: 400 });
    }
    const accessToken = await getGoogleAccessToken();
    const email = await getGoogleEmail(accessToken);
    if (!allowedPublisher(email)) {
      return NextResponse.json({ error: "This Google account is not allowed to update WordPress pages." }, { status: 403 });
    }
    const client = await getClientProfileAsync(input.clientId, undefined, accessToken);
    if (!client?.wordpress || new URL(client.website).hostname.replace(/^www\./, "") !== "fulginiti-law.com") {
      return NextResponse.json({ error: "Choose the connected Fulginiti Law client." }, { status: 400 });
    }
    const config = await getWordPressConfigAsync(client.id, undefined, accessToken);
    const authorization = wordPressAuthorization(config);
    const personalInjuryGeoSlugs = await discoverPersonalInjuryGeoSlugs(config.siteUrl, authorization);
    if (!personalInjuryGeoSlugs.length) {
      throw new Error("No published Fulginiti personal-injury GEO pages were found.");
    }
    const updated: Array<{ id: number; title: string; url: string; anchorsChanged: number }> = [];
    const unchanged: Array<{ id: number; title: string; url: string }> = [];
    const failed: Array<{ slug: string; error: string }> = [];

    for (const slug of personalInjuryGeoSlugs) {
      try {
        const params = new URLSearchParams({
          slug,
          status: "publish",
          context: "edit",
          per_page: "10",
          _fields: "id,link,slug,status,title,content",
        });
        const lookup = await fetch(`${config.siteUrl}/wp-json/wp/v2/pages?${params}`, {
          headers: { Authorization: authorization },
          cache: "no-store",
        });
        const pages = await wordPressJson<WordPressPage[]>(lookup, `opening ${slug}`);
        const page = Array.isArray(pages) ? pages.find((candidate) => candidate.slug?.toLowerCase() === slug) : undefined;
        if (!lookup.ok || !page?.id || page.status !== "publish") {
          throw new Error("The published personal-injury GEO page was not found.");
        }
        const title = page.title?.raw || page.title?.rendered || slug;
        const raw = page.content?.raw || "";
        const normalized = normalizePersonalInjuryGeoDirectoryAnchors(raw);
        const currentLabels = personalInjuryGeoDirectoryAnchorLabels(normalized.content);
        if (currentLabels.length < 10) {
          throw new Error(`Expected a personal-injury city directory, found only ${currentLabels.length} matching links.`);
        }
        if (currentLabels.some((label) => /personal\s+injury|lawyers?|attorneys?/i.test(label))) {
          throw new Error("The directory still contains a repeated practice-area label.");
        }
        if (!normalized.changed) {
          unchanged.push({ id: page.id, title, url: page.link || config.siteUrl });
          continue;
        }
        const update = await fetch(`${config.siteUrl}/wp-json/wp/v2/pages/${page.id}`, {
          method: "POST",
          headers: { Authorization: authorization, "Content-Type": "application/json" },
          body: JSON.stringify({ content: normalized.content }),
          cache: "no-store",
        });
        const saved = await wordPressJson<WordPressPage>(update, `updating ${slug}`);
        if (!update.ok || saved.status !== "publish" || !saved.id) {
          throw new Error(saved.message || "WordPress did not save the city-only directory labels.");
        }
        const savedLabels = personalInjuryGeoDirectoryAnchorLabels(saved.content?.raw || saved.content?.rendered || "");
        if (savedLabels.length < 10 || savedLabels.some((label) => /personal\s+injury|lawyers?|attorneys?/i.test(label))) {
          throw new Error("The saved directory did not pass city-only verification.");
        }
        updated.push({
          id: saved.id,
          title,
          url: saved.link || page.link || config.siteUrl,
          anchorsChanged: normalized.changed,
        });
      } catch (error) {
        failed.push({ slug, error: error instanceof Error ? error.message : "The directory could not be updated." });
      }
    }

    return NextResponse.json({
      ok: failed.length === 0,
      discovered: personalInjuryGeoSlugs.length,
      updated,
      unchanged,
      failed,
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "The Fulginiti personal-injury directories could not be updated.",
    }, { status: 500 });
  }
}
