import { NextRequest, NextResponse } from "next/server";
import { getClientProfileAsync } from "@/lib/client-store";
import {
  allTruckGeoLinkAnchorLabels,
  normalizeAllTruckGeoLinkAnchors,
  normalizeTruckGeoDirectoryAnchors,
  truckGeoDirectoryAnchorLabels,
} from "@/lib/geo-directory-labels";
import { getGoogleAccessToken, getGoogleEmail } from "@/lib/google";
import { getWordPressConfigAsync, wordPressAuthorization } from "@/lib/wordpress";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const FULGINITI_TRUCK_GEO_PAGES = [
  { id: 2450, label: "Abington", slug: "abington-truck-accident-lawyers" },
  { id: 2458, label: "Bensalem", slug: "bensalem-truck-accident-lawyer" },
  { id: 2462, label: "Camden", slug: "camden-truck-accident-lawyers" },
  { id: 2465, label: "Cherry Hill", slug: "cherry-hill-truck-accident-lawyer" },
  { id: 2469, label: "Chester", slug: "chester-truck-accident-lawyers" },
  { id: 2665, label: "Coatesville", slug: "coatesville-truck-accident-lawyers" },
  { id: 2479, label: "Deptford", slug: "deptford-truck-accident-lawyers" },
  { id: 2492, label: "Doylestown", slug: "doylestown-truck-accident-lawyers" },
  { id: 2475, label: "East Norriton", slug: "east-norriton-truck-accident-lawyers" },
  { id: 2485, label: "Glassboro", slug: "glassboro-truck-accident-lawyers" },
  { id: 2500, label: "Gloucester", slug: "gloucester-truck-accident-lawyers" },
  { id: 2511, label: "Haverford", slug: "haverford-truck-accident-lawyers" },
  { id: 2517, label: "King of Prussia", slug: "king-of-prussia-truck-accident-lawyers" },
  { id: 2525, label: "Lansdale", slug: "lansdale-truck-accident-lawyers" },
  { id: 2521, label: "Levittown", slug: "levittown-truck-accident-lawyers" },
  { id: 2529, label: "Lower Merion", slug: "lower-merion-truck-accident-lawyers" },
  { id: 2533, label: "Media", slug: "media-truck-accident-lawyers" },
  { id: 2537, label: "Middletown", slug: "middletown-truck-accident-lawyers" },
  { id: 2541, label: "Mount Laurel", slug: "mount-laurel-truck-accident-lawyers" },
  { id: 2544, label: "Norristown", slug: "norristown-truck-accident-lawyers" },
  { id: 2547, label: "Pennsauken", slug: "pennsauken-truck-accident-lawyers" },
  { id: 2550, label: "Pottstown", slug: "pottstown-truck-accident-lawyers" },
  { id: 2553, label: "Upper Darby", slug: "upper-darby-truck-accident-lawyers" },
  { id: 2556, label: "Voorhees", slug: "voorhees-truck-accident-lawyers" },
  { id: 2659, label: "West Chester", slug: "west-chester-truck-accident-lawyers" },
  { id: 2561, label: "Willingboro", slug: "willingboro-truck-accident-lawyers" },
];

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function replaceMismatchedLansdaleDirectory(content: string, siteUrl: string) {
  const items = FULGINITI_TRUCK_GEO_PAGES
    .filter((page) => page.id !== 2525)
    .map((page) => `<li><a href="${escapeHtml(`${siteUrl}/${page.slug}/`)}" target="_blank" rel="noopener noreferrer">${escapeHtml(page.label)}</a></li>`)
    .join("\n");
  const withTruckHeading = content.replace(
    /Other(?:\s|&nbsp;|&#160;)+areas(?:\s|&nbsp;|&#160;)+where(?:\s|&nbsp;|&#160;)+we(?:\s|&nbsp;|&#160;)+handle(?:\s|&nbsp;|&#160;)+Personal(?:\s|&nbsp;|&#160;)+Injury/i,
    "Other areas where we handle Truck Accident",
  );
  return withTruckHeading.replace(/<ul\b[^>]*>[\s\S]*?<\/ul>/gi, (list, offset: number, source: string) => {
    const preceding = source
      .slice(Math.max(0, offset - 800), offset)
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;|&#160;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!/Other\s+areas\s+where\s+we\s+handle\s+Truck\s+Accident\s*:?\s*$/i.test(preceding)) return list;
    return `<ul class="wp-block-list">\n${items}\n</ul>`;
  });
}

type WordPressPage = {
  id?: number;
  link?: string;
  slug?: string;
  status?: string;
  title?: { raw?: string; rendered?: string };
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
  if (challenged) throw new Error("Cloudflare challenged the WordPress directory update.");
  if (!text.trim()) throw new Error(`WordPress returned an empty response while ${action}.`);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`WordPress returned an unexpected response while ${action}.`);
  }
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
    const updated: Array<{ id: number; title: string; url: string; anchorsChanged: number }> = [];
    const unchanged: Array<{ id: number; title: string; url: string }> = [];
    const failed: Array<{ id: number; error: string }> = [];

    for (const target of FULGINITI_TRUCK_GEO_PAGES) {
      const pageId = target.id;
      try {
        const lookup = await fetch(
          `${config.siteUrl}/wp-json/wp/v2/pages/${pageId}?context=edit&_fields=id,link,slug,status,title,content`,
          { headers: { Authorization: authorization }, cache: "no-store" },
        );
        const page = await wordPressJson<WordPressPage>(lookup, `opening page ${pageId}`);
        if (!lookup.ok || !page.id || page.status !== "publish") {
          throw new Error(page.message || "The target is not a published WordPress page.");
        }
        if (!/-truck-accident-lawyers?$/i.test(page.slug || "")) {
          throw new Error("The target is not a verified truck-accident GEO page.");
        }
        const title = page.title?.raw || page.title?.rendered || `Page ${page.id}`;
        const raw = page.content?.raw || "";
        const directoryReadyContent = page.id === 2525 && !truckGeoDirectoryAnchorLabels(raw).length
          ? replaceMismatchedLansdaleDirectory(raw, config.siteUrl.replace(/\/$/, ""))
          : raw;
        const normalized = normalizeTruckGeoDirectoryAnchors(directoryReadyContent);
        if (!normalized.changed) {
          const existingLabels = truckGeoDirectoryAnchorLabels(directoryReadyContent);
          if (existingLabels.length !== FULGINITI_TRUCK_GEO_PAGES.length - 1) {
            throw new Error(`Expected 25 truck GEO directory links, found ${existingLabels.length}.`);
          }
          if (existingLabels.some((label) => /truck\s+accidents?|lawyers?|attorneys?/i.test(label))) {
            throw new Error("The existing directory still contains a repeated practice-area anchor.");
          }
          if (directoryReadyContent === raw) {
            unchanged.push({ id: page.id, title, url: page.link || config.siteUrl });
            continue;
          }
          normalized.content = directoryReadyContent;
          normalized.changed = existingLabels.length;
        }
        const update = await fetch(`${config.siteUrl}/wp-json/wp/v2/pages/${page.id}`, {
          method: "POST",
          headers: { Authorization: authorization, "Content-Type": "application/json" },
          body: JSON.stringify({ content: normalized.content }),
          cache: "no-store",
        });
        const saved = await wordPressJson<WordPressPage>(update, `updating page ${page.id}`);
        if (!update.ok || saved.status !== "publish" || !saved.id) {
          throw new Error(saved.message || "WordPress did not save the directory labels.");
        }
        const savedContent = saved.content?.raw || saved.content?.rendered || "";
        const labels = truckGeoDirectoryAnchorLabels(savedContent);
        if (labels.length !== FULGINITI_TRUCK_GEO_PAGES.length - 1
          || labels.some((label) => /truck\s+accidents?|lawyers?|attorneys?/i.test(label))) {
          throw new Error("The saved directory did not pass the city-only anchor verification.");
        }
        updated.push({
          id: page.id,
          title,
          url: saved.link || page.link || config.siteUrl,
          anchorsChanged: normalized.changed,
        });
      } catch (error) {
        failed.push({ id: pageId, error: error instanceof Error ? error.message : "The directory could not be updated." });
      }
    }

    try {
      const parentId = 751;
      const lookup = await fetch(
        `${config.siteUrl}/wp-json/wp/v2/pages/${parentId}?context=edit&_fields=id,link,slug,status,title,content`,
        { headers: { Authorization: authorization }, cache: "no-store" },
      );
      const page = await wordPressJson<WordPressPage>(lookup, "opening the main truck-accident page");
      if (!lookup.ok || !page.id || page.status !== "publish" || page.slug !== "truck-accident") {
        throw new Error(page.message || "The published main truck-accident page was not found.");
      }
      const title = page.title?.raw || page.title?.rendered || "Philadelphia Truck Accident Lawyer";
      const raw = page.content?.raw || "";
      const normalized = normalizeAllTruckGeoLinkAnchors(raw);
      let savedContent = raw;
      let savedUrl = page.link || config.siteUrl;
      if (normalized.changed) {
        const update = await fetch(`${config.siteUrl}/wp-json/wp/v2/pages/${page.id}`, {
          method: "POST",
          headers: { Authorization: authorization, "Content-Type": "application/json" },
          body: JSON.stringify({ content: normalized.content }),
          cache: "no-store",
        });
        const saved = await wordPressJson<WordPressPage>(update, "updating the main truck-accident page");
        if (!update.ok || saved.status !== "publish" || !saved.id) {
          throw new Error(saved.message || "WordPress did not save the main truck-page directory labels.");
        }
        savedContent = saved.content?.raw || saved.content?.rendered || "";
        savedUrl = saved.link || savedUrl;
      }
      const labels = allTruckGeoLinkAnchorLabels(savedContent);
      const uniqueLabels = new Set(labels);
      const missing = FULGINITI_TRUCK_GEO_PAGES.filter((target) => !uniqueLabels.has(target.label));
      if (missing.length || labels.some((label) => /truck\s+accidents?|lawyers?|attorneys?/i.test(label))) {
        throw new Error(`The main truck page failed city-only link verification${missing.length ? `; missing ${missing.map((item) => item.label).join(", ")}` : ""}.`);
      }
      if (normalized.changed) {
        updated.push({ id: page.id, title, url: savedUrl, anchorsChanged: normalized.changed });
      } else {
        unchanged.push({ id: page.id, title, url: savedUrl });
      }
    } catch (error) {
      failed.push({ id: 751, error: error instanceof Error ? error.message : "The main truck page could not be updated." });
    }

    return NextResponse.json({ ok: failed.length === 0, updated, unchanged, failed });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "The Fulginiti truck directories could not be updated.",
    }, { status: 500 });
  }
}
