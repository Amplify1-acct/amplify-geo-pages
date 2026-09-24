import { NextRequest, NextResponse } from "next/server";
import { getClientProfileAsync } from "@/lib/client-store";
import { getGoogleAccessToken, getGoogleEmail } from "@/lib/google";
import { getWordPressConfigAsync, wordPressAuthorization } from "@/lib/wordpress";
import { insertCtaBlocks } from "@/lib/cta";
import { normalizeEnhancementLocation } from "@/lib/enhancement-location";
import { buildAmplifyFaqSchemaNode } from "@/lib/faq-standard";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type WordPressPage = {
  id?: number;
  link?: string;
  slug?: string;
  status?: string;
  featured_media?: number;
  title?: { raw?: string; rendered?: string };
  excerpt?: { raw?: string; rendered?: string };
  content?: { raw?: string; rendered?: string };
  message?: string;
};

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
  if (challenged) throw new Error("Cloudflare challenged the WordPress repair request.");
  if (!text.trim()) throw new Error(`WordPress returned an empty response while ${action}.`);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`WordPress returned an unexpected response while ${action}.`);
  }
}

function decodedText(value: string) {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(?:p|div|h[1-6]|li)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateAtWord(value: string, maximum: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maximum) return normalized;
  return normalized.slice(0, maximum + 1).replace(/\s+\S*$/, "").trim();
}

function pageSchema(options: {
  content: string;
  pageUrl: string;
  clientName: string;
  clientUrl: string;
  phone: string;
  location: string;
  practiceArea: string;
}) {
  const legalService: Record<string, unknown> = {
    "@type": "LegalService",
    "@id": `${options.pageUrl}#legal-service`,
    name: `${options.clientName} — ${options.practiceArea} in ${options.location}`,
    url: options.pageUrl,
    serviceType: options.practiceArea,
    provider: { "@type": "LegalService", name: options.clientName, url: options.clientUrl },
    areaServed: { "@type": "City", name: options.location },
  };
  if (options.phone) legalService.telephone = options.phone;
  const graph: Array<Record<string, unknown>> = [legalService];
  const faq = buildAmplifyFaqSchemaNode(options.content, options.pageUrl);
  if (faq) graph.push(faq);
  return { "@context": "https://schema.org", "@graph": graph };
}

export async function POST(request: NextRequest) {
  try {
    const input = await request.json() as {
      clientId?: string;
      pageIds?: number[];
      expectedPracticeArea?: string;
      confirmed?: boolean;
    };
    const pageIds = [...new Set((input.pageIds || []).map(Number))]
      .filter((id) => Number.isInteger(id) && id > 0)
      .slice(0, 100);
    if (input.confirmed !== true || !pageIds.length) {
      return NextResponse.json({ error: "Confirmed WordPress page IDs are required." }, { status: 400 });
    }
    const accessToken = await getGoogleAccessToken();
    const email = await getGoogleEmail(accessToken);
    if (!allowedPublisher(email)) {
      return NextResponse.json({ error: "This Google account is not allowed to repair WordPress pages." }, { status: 403 });
    }
    const client = await getClientProfileAsync(input.clientId, undefined, accessToken);
    if (!client?.wordpress) {
      return NextResponse.json({ error: "This client is not connected to WordPress." }, { status: 400 });
    }
    const config = await getWordPressConfigAsync(client.id, undefined, accessToken);
    const authorization = wordPressAuthorization(config);
    const repaired: Array<{ id: number; title: string; url: string }> = [];
    const failed: Array<{ id: number; error: string }> = [];

    for (const pageId of pageIds) {
      try {
        const lookup = await fetch(
          `${config.siteUrl}/wp-json/wp/v2/pages/${pageId}?context=edit&_fields=id,link,slug,status,featured_media,title,excerpt,content`,
          { headers: { Authorization: authorization }, cache: "no-store" },
        );
        const page = await wordPressJson<WordPressPage>(lookup, `opening page ${pageId}`);
        if (!lookup.ok || !page.id || page.status !== "publish") {
          throw new Error(page.message || "The target is not a published WordPress page.");
        }
        const originalTitle = page.title?.raw || page.title?.rendered || "";
        const rawContent = page.content?.raw || page.content?.rendered || "";
        if (!originalTitle || !rawContent) throw new Error("The page title or content is empty.");
        let repairTitle = originalTitle.replace(/\b(PA|NJ)uck\b/gi, "$1 Truck");
        const repairContent = rawContent.replace(/\b(PA|NJ)uck\b/gi, "$1 Truck");
        if (
          input.expectedPracticeArea
          && /truck\s+accident/i.test(input.expectedPracticeArea)
          && /truck-accident/i.test(page.slug || "")
          && !/truck\s+accident/i.test(repairTitle)
        ) {
          repairTitle = repairTitle.replace(/personal\s+injury\s+lawyers?/i, "Truck Accident Lawyers");
        }
        const normalized = normalizeEnhancementLocation({
          pageTitle: repairTitle,
          content: repairContent,
          sourceContent: repairContent,
          pageUrl: page.link || config.siteUrl,
          client,
        });
        let imageUrl = "";
        if (page.featured_media) {
          const mediaLookup = await fetch(
            `${config.siteUrl}/wp-json/wp/v2/media/${page.featured_media}?context=edit&_fields=id,source_url`,
            { headers: { Authorization: authorization }, cache: "no-store" },
          );
          const media = await wordPressJson<{ id?: number; source_url?: string }>(mediaLookup, "opening the CTA image");
          if (mediaLookup.ok && media.id && media.source_url) imageUrl = media.source_url;
        }
        if (!imageUrl) throw new Error("The existing featured image could not be opened for the CTA.");
        const content = insertCtaBlocks(normalized.content, {
          origin: request.nextUrl.origin,
          client,
          location: normalized.location,
          practiceArea: normalized.practiceArea,
          imageUrl,
          forceRefresh: true,
        });
        const update = await fetch(`${config.siteUrl}/wp-json/wp/v2/pages/${page.id}`, {
          method: "POST",
          headers: { Authorization: authorization, "Content-Type": "application/json" },
          body: JSON.stringify({ title: normalized.pageTitle, content }),
          cache: "no-store",
        });
        const updated = await wordPressJson<WordPressPage>(update, `updating page ${page.id}`);
        if (!update.ok || updated.status !== "publish" || !updated.id) {
          throw new Error(updated.message || "WordPress did not save the location repair.");
        }
        const pageUrl = updated.link || page.link || config.siteUrl;
        const metaDescription = truncateAtWord(
          page.excerpt?.raw
            || decodedText(page.excerpt?.rendered || "")
            || decodedText(content).slice(0, 160)
            || `${client.name} explains the legal issues and next steps that may apply.`,
          160,
        );
        const meta = await fetch(`${config.siteUrl}/wp-json/amplify-geo/v1/page-meta`, {
          method: "POST",
          headers: { Authorization: authorization, "Content-Type": "application/json" },
          body: JSON.stringify({
            page_id: page.id,
            seo_title: truncateAtWord(`${normalized.pageTitle} | ${client.name}`, 70),
            meta_description: metaDescription,
            client_id: client.id,
            hero_image_id: 0,
            schema: pageSchema({
              content,
              pageUrl,
              clientName: client.name,
              clientUrl: client.website,
              phone: client.phoneDisplay,
              location: normalized.location,
              practiceArea: normalized.practiceArea,
            }),
          }),
          cache: "no-store",
        });
        const metaSaved = await wordPressJson<{ saved?: boolean; message?: string }>(meta, "saving repaired SEO metadata");
        if (!meta.ok || metaSaved.saved !== true) {
          throw new Error(metaSaved.message || "The page was updated, but its repaired SEO metadata was not saved.");
        }
        repaired.push({ id: page.id, title: normalized.pageTitle, url: pageUrl });
      } catch (error) {
        failed.push({ id: pageId, error: error instanceof Error ? error.message : "The page could not be repaired." });
      }
    }

    return NextResponse.json({ ok: failed.length === 0, repaired, failed });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The enhancement locations could not be repaired.";
    console.error("[wordpress/repair-enhancement-locations]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
