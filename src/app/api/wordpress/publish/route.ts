import { NextRequest, NextResponse } from "next/server";
import sanitizeHtml from "sanitize-html";
import { getGoogleAccessToken, getGoogleEmail } from "@/lib/google";
import {
  getWordPressConfig,
  wordPressRequestHeaders,
} from "@/lib/wordpress";
import type { WordPressConnectionInput } from "@/lib/wordpress";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type PublishInput = {
  docId?: string;
  pageUrl?: string;
  connection?: WordPressConnectionInput;
};

type WordPressPage = {
  id: number;
  link?: string;
  slug?: string;
  status?: string;
  modified_gmt?: string;
  title?: { raw?: string; rendered?: string };
  content?: { raw?: string; rendered?: string };
};

function normalizedHost(value: string) {
  return value.toLowerCase().replace(/^www\./, "");
}

function normalizedPath(value: string) {
  const path = new URL(value).pathname.replace(/\/+$/, "");
  return path || "/";
}

function allowedPublisher(email: string | null) {
  if (!email) return false;
  const allowed = (process.env.WORDPRESS_ALLOWED_GOOGLE_EMAILS || "accounts@amplifylaw.ai")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}

function cleanGoogleDocHtml(exportedHtml: string) {
  const body = exportedHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || exportedHtml;
  return sanitizeHtml(body, {
    allowedTags: [
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "p",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "sup",
      "sub",
      "ul",
      "ol",
      "li",
      "blockquote",
      "a",
      "hr",
      "table",
      "thead",
      "tbody",
      "tfoot",
      "tr",
      "th",
      "td",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      ol: ["start"],
      th: ["colspan", "rowspan", "scope"],
      td: ["colspan", "rowspan"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    transformTags: {
      a: (_tagName, attribs) => ({
        tagName: "a",
        attribs: {
          ...attribs,
          ...(attribs.href?.startsWith("http")
            ? { target: "_blank", rel: "noopener noreferrer" }
            : {}),
        },
      }),
    },
  }).trim();
}

async function exportApprovedGoogleDoc(accessToken: string, docId: string) {
  const metadataResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(docId)}?fields=id,mimeType,trashed,appProperties&supportsAllDrives=true`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    },
  );
  const metadata = (await metadataResponse.json()) as {
    mimeType?: string;
    trashed?: boolean;
    appProperties?: Record<string, string>;
    error?: { message?: string };
  };
  if (!metadataResponse.ok) {
    throw new Error(metadata.error?.message || "The approved Google Doc could not be opened.");
  }
  if (
    metadata.trashed ||
    metadata.mimeType !== "application/vnd.google-apps.document" ||
    !metadata.appProperties?.amplifyResponseId
  ) {
    throw new Error("Only a Google Doc created by this app can be published.");
  }

  const exportResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(docId)}/export?mimeType=${encodeURIComponent("text/html")}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    },
  );
  if (!exportResponse.ok) {
    throw new Error("The final Google Doc could not be prepared for WordPress.");
  }

  const content = cleanGoogleDocHtml(await exportResponse.text());
  if (!content || content.replace(/<[^>]+>/g, "").trim().length < 100) {
    throw new Error("The approved Google Doc does not contain enough usable page content.");
  }
  return content;
}

async function backUpWordPressPage(
  accessToken: string,
  page: WordPressPage,
  sourcePageUrl: string,
  docId: string,
) {
  const timestamp = new Date().toISOString();
  const backup = JSON.stringify(
    {
      backedUpAt: timestamp,
      sourcePageUrl,
      googleDocId: docId,
      wordpressPage: page,
    },
    null,
    2,
  );
  const form = new FormData();
  form.append(
    "metadata",
    new Blob(
      [
        JSON.stringify({
          name: `wordpress-page-${page.id}-${timestamp.replace(/[:.]/g, "-")}.json`,
          parents: ["appDataFolder"],
          appProperties: {
            amplifyWordPressBackup: "true",
            wordpressPageId: String(page.id),
          },
        }),
      ],
      { type: "application/json" },
    ),
  );
  form.append("file", new Blob([backup], { type: "application/json" }), "backup.json");

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    },
  );
  const data = (await response.json()) as { id?: string; error?: { message?: string } };
  if (!response.ok || !data.id) {
    throw new Error(data.error?.message || "The existing WordPress page could not be backed up.");
  }
  return data.id;
}

export async function POST(request: NextRequest) {
  try {
    const input = (await request.json()) as PublishInput;
    const docId = input.docId?.trim() || "";
    const pageUrl = input.pageUrl?.trim() || "";
    if (!/^[A-Za-z0-9_-]{10,200}$/.test(docId)) {
      return NextResponse.json({ error: "The approved Google Doc is missing." }, { status: 400 });
    }

    let sourceUrl: URL;
    try {
      sourceUrl = new URL(pageUrl);
    } catch {
      return NextResponse.json({ error: "The original WordPress page URL is invalid." }, { status: 400 });
    }
    if (sourceUrl.protocol !== "https:") {
      return NextResponse.json({ error: "The WordPress page must use HTTPS." }, { status: 400 });
    }

    const accessToken = await getGoogleAccessToken();
    const googleEmail = await getGoogleEmail(accessToken);
    if (!allowedPublisher(googleEmail)) {
      return NextResponse.json(
        { error: "This Google account is not allowed to publish to WordPress." },
        { status: 403 },
      );
    }

    const config = getWordPressConfig(input.connection);
    const configuredUrl = new URL(config.siteUrl);
    if (normalizedHost(sourceUrl.hostname) !== normalizedHost(configuredUrl.hostname)) {
      return NextResponse.json(
        { error: `This app is connected to ${configuredUrl.hostname}, not ${sourceUrl.hostname}.` },
        { status: 400 },
      );
    }

    const slug = decodeURIComponent(
      sourceUrl.pathname.split("/").filter(Boolean).at(-1) || "",
    );
    if (!slug) {
      return NextResponse.json(
        { error: "The homepage cannot be replaced through this workflow." },
        { status: 400 },
      );
    }

    const requestHeaders = wordPressRequestHeaders(config);
    const query = new URLSearchParams({
      slug,
      context: "edit",
      per_page: "100",
      _fields: "id,link,slug,status,modified_gmt,title,content",
    });
    const lookupResponse = await fetch(
      `${config.siteUrl}/wp-json/wp/v2/pages?${query}`,
      {
        headers: requestHeaders,
        redirect: "follow",
        cache: "no-store",
      },
    );
    if (lookupResponse.headers.get("cf-mitigated") === "challenge") {
      throw new Error(
        "Cloudflare challenged the WordPress REST API. Exempt /wp-json/ from the bot challenge before publishing.",
      );
    }
    const lookupText = await lookupResponse.text();
    let lookupData: WordPressPage[] | { message?: string };
    try {
      lookupData = JSON.parse(lookupText) as WordPressPage[] | { message?: string };
    } catch {
      throw new Error("WordPress returned an unexpected response instead of its Pages API.");
    }
    if (!lookupResponse.ok || !Array.isArray(lookupData)) {
      const message = Array.isArray(lookupData) ? undefined : lookupData.message;
      throw new Error(message || "WordPress could not be reached with the connected account.");
    }

    const matchingPage =
      lookupData.find(
        (page) => page.link && normalizedPath(page.link) === normalizedPath(sourceUrl.toString()),
      ) || (lookupData.length === 1 ? lookupData[0] : null);
    if (!matchingPage) {
      return NextResponse.json(
        { error: "The matching WordPress page could not be found. Its URL may use a custom page type." },
        { status: 404 },
      );
    }

    const finalContent = await exportApprovedGoogleDoc(accessToken, docId);
    const backupId = await backUpWordPressPage(accessToken, matchingPage, pageUrl, docId);

    const updateResponse = await fetch(
      `${config.siteUrl}/wp-json/wp/v2/pages/${matchingPage.id}`,
      {
        method: "POST",
        headers: {
          ...requestHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: finalContent }),
        redirect: "follow",
        cache: "no-store",
      },
    );
    if (updateResponse.headers.get("cf-mitigated") === "challenge") {
      throw new Error(
        "Cloudflare challenged the WordPress REST API. Exempt /wp-json/ from the bot challenge before publishing.",
      );
    }
    const updateText = await updateResponse.text();
    let updated: WordPressPage & { message?: string };
    try {
      updated = JSON.parse(updateText) as WordPressPage & { message?: string };
    } catch {
      throw new Error("WordPress returned an unexpected response while updating the page.");
    }
    if (!updateResponse.ok) {
      throw new Error(updated.message || "WordPress did not accept the approved page.");
    }

    return NextResponse.json({
      ok: true,
      pageId: updated.id || matchingPage.id,
      pageUrl: updated.link || matchingPage.link || pageUrl,
      backupId,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The page could not be published.";
    const status = /not connected|reconnect|expired/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
