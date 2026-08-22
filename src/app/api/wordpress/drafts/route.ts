import { NextRequest, NextResponse } from "next/server";
import { getGoogleAccessToken, getGoogleEmail } from "@/lib/google";
import { prepareApprovedGoogleDoc } from "@/lib/google-doc-content";
import { getWordPressConfig, wordPressRequestHeaders } from "@/lib/wordpress";
import type { WordPressConnectionInput } from "@/lib/wordpress";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type DraftInput = {
  docId?: string;
  website?: string;
  fallbackTitle?: string;
  connection?: WordPressConnectionInput;
  existingPageId?: number;
};

type WordPressPage = {
  id: number;
  link?: string;
  slug?: string;
  status?: string;
  title?: { raw?: string; rendered?: string };
};

function normalizedHost(value: string) {
  return value.toLowerCase().replace(/^www\./, "");
}

function allowedPublisher(email: string | null) {
  if (!email) return false;
  const allowed = (process.env.WORDPRESS_ALLOWED_GOOGLE_EMAILS || "accounts@amplifylaw.ai")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
}

async function readWordPressJson<T>(response: Response, unexpectedMessage: string) {
  if (response.headers.get("cf-mitigated") === "challenge") {
    throw new Error(
      "Cloudflare challenged the WordPress REST API. Exempt /wp-json/ from the bot challenge before creating drafts.",
    );
  }

  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(unexpectedMessage);
  }
}

export async function POST(request: NextRequest) {
  try {
    const input = (await request.json()) as DraftInput;
    const docId = input.docId?.trim() || "";
    const website = input.website?.trim() || "";
    const fallbackTitle = input.fallbackTitle?.trim() || "New GEO page";
    const existingPageId =
      typeof input.existingPageId === "number" &&
      Number.isInteger(input.existingPageId) &&
      input.existingPageId > 0
        ? input.existingPageId
        : null;

    if (!/^[A-Za-z0-9_-]{10,200}$/.test(docId)) {
      return NextResponse.json({ error: "The approved Google Doc is missing." }, { status: 400 });
    }

    let websiteUrl: URL;
    try {
      websiteUrl = new URL(website);
    } catch {
      return NextResponse.json({ error: "The law firm website URL is invalid." }, { status: 400 });
    }
    if (websiteUrl.protocol !== "https:") {
      return NextResponse.json({ error: "The WordPress website must use HTTPS." }, { status: 400 });
    }

    const accessToken = await getGoogleAccessToken();
    const googleEmail = await getGoogleEmail(accessToken);
    if (!allowedPublisher(googleEmail)) {
      return NextResponse.json(
        { error: "This Google account is not allowed to create WordPress drafts." },
        { status: 403 },
      );
    }

    const config = getWordPressConfig(input.connection);
    const configuredUrl = new URL(config.siteUrl);
    if (normalizedHost(websiteUrl.hostname) !== normalizedHost(configuredUrl.hostname)) {
      return NextResponse.json(
        { error: `This app is connected to ${configuredUrl.hostname}, not ${websiteUrl.hostname}.` },
        { status: 400 },
      );
    }

    const preparedDocument = await prepareApprovedGoogleDoc(accessToken, docId, fallbackTitle);
    const title = preparedDocument.title;
    const slug = slugify(title);
    const content = preparedDocument.html;
    if (!slug) {
      return NextResponse.json({ error: "The approved page needs a usable title." }, { status: 400 });
    }

    const requestHeaders = wordPressRequestHeaders(config);
    let existingPage: WordPressPage | null = null;
    if (existingPageId) {
      const existingResponse = await fetch(
        `${config.siteUrl}/wp-json/wp/v2/pages/${existingPageId}?context=edit&_fields=id,link,slug,status,title`,
        {
          headers: requestHeaders,
          redirect: "follow",
          cache: "no-store",
        },
      );
      const existingData = await readWordPressJson<WordPressPage & { message?: string }>(
        existingResponse,
        "WordPress returned an unexpected response while opening the existing draft.",
      );
      if (!existingResponse.ok || !existingData.id) {
        throw new Error(existingData.message || "The existing WordPress draft could not be opened.");
      }
      if (existingData.status !== "draft" && existingData.status !== "pending") {
        return NextResponse.json(
          { error: "Only an existing draft or pending page can be updated through this action." },
          { status: 409 },
        );
      }
      if (
        existingData.link &&
        normalizedHost(new URL(existingData.link).hostname) !==
          normalizedHost(configuredUrl.hostname)
      ) {
        return NextResponse.json(
          { error: "The existing draft does not belong to the connected WordPress site." },
          { status: 409 },
        );
      }
      existingPage = existingData;
    }

    const duplicateQuery = new URLSearchParams({
      slug,
      context: "edit",
      per_page: "100",
      status: "publish,draft,pending,private,future",
      _fields: "id,link,slug,status,title",
    });
    const duplicateResponse = await fetch(
      `${config.siteUrl}/wp-json/wp/v2/pages?${duplicateQuery}`,
      {
        headers: requestHeaders,
        redirect: "follow",
        cache: "no-store",
      },
    );
    const duplicateData = await readWordPressJson<WordPressPage[] | { message?: string }>(
      duplicateResponse,
      "WordPress returned an unexpected response instead of its Pages API.",
    );
    if (!duplicateResponse.ok || !Array.isArray(duplicateData)) {
      const message = Array.isArray(duplicateData) ? undefined : duplicateData.message;
      throw new Error(message || "WordPress could not check for matching pages.");
    }
    const conflictingPage = duplicateData.find((page) => page.id !== existingPage?.id);
    if (conflictingPage || (!existingPage && duplicateData.length)) {
      return NextResponse.json(
        { error: `A WordPress page with the slug “${slug}” already exists. Open it through Enhance existing instead.` },
        { status: 409 },
      );
    }

    const endpoint = existingPage
      ? `${config.siteUrl}/wp-json/wp/v2/pages/${existingPage.id}`
      : `${config.siteUrl}/wp-json/wp/v2/pages`;
    const createResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        ...requestHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title, slug, content, status: "draft" }),
      redirect: "follow",
      cache: "no-store",
    });
    const created = await readWordPressJson<WordPressPage & { message?: string }>(
      createResponse,
      `WordPress returned an unexpected response while ${existingPage ? "updating" : "creating"} the draft.`,
    );
    if (!createResponse.ok || !created.id) {
      throw new Error(created.message || "WordPress did not accept the approved draft.");
    }

    return NextResponse.json({
      ok: true,
      pageId: created.id,
      title,
      slug: created.slug || slug,
      status: "draft",
      updated: Boolean(existingPage),
      previewUrl: created.link || null,
      editUrl: new URL(`/wp-admin/post.php?post=${created.id}&action=edit`, config.siteUrl).toString(),
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The WordPress draft could not be created.";
    const status = /not connected|reconnect|expired/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
