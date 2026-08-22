import sanitizeHtml from "sanitize-html";

function directLink(href?: string) {
  if (!href) return href;
  try {
    const parsed = new URL(href.replace(/&amp;/gi, "&"));
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (hostname === "google.com" && parsed.pathname === "/url") {
      const target = parsed.searchParams.get("q") || parsed.searchParams.get("url");
      if (target && /^(https?:|mailto:|tel:)/i.test(target)) return target;
    }
  } catch {
    // The sanitizer handles relative or malformed values.
  }
  return href;
}

function cleanGoogleDocHtml(exportedHtml: string) {
  const body = exportedHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || exportedHtml;
  return sanitizeHtml(body, {
    allowedTags: [
      "h1", "h2", "h3", "h4", "h5", "h6", "p", "br", "strong", "b", "em", "i",
      "u", "s", "sup", "sub", "ul", "ol", "li", "blockquote", "a", "hr", "table",
      "thead", "tbody", "tfoot", "tr", "th", "td",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      ol: ["start"],
      th: ["colspan", "rowspan", "scope"],
      td: ["colspan", "rowspan"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    transformTags: {
      a: (_tagName, attribs) => {
        const href = directLink(attribs.href);
        return {
          tagName: "a",
          attribs: {
            ...attribs,
            ...(href ? { href } : {}),
            ...(href?.startsWith("http")
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {}),
          },
        };
      },
    },
  }).trim();
}

function plainText(value: string) {
  return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function prepareApprovedGoogleDoc(
  accessToken: string,
  docId: string,
  fallbackTitle: string,
) {
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
    throw new Error("Only a Google Doc created by this app can be previewed or sent to WordPress.");
  }

  const exportResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(docId)}/export?mimeType=${encodeURIComponent("text/html")}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    },
  );
  if (!exportResponse.ok) {
    throw new Error("The final Google Doc could not be prepared.");
  }

  const exportedContent = cleanGoogleDocHtml(await exportResponse.text());
  if (!exportedContent || plainText(exportedContent).length < 100) {
    throw new Error("The approved Google Doc does not contain enough usable page content.");
  }

  const headingMatch = exportedContent.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  const title = plainText(headingMatch?.[1] || "") || fallbackTitle.trim() || "New GEO page";
  const html = headingMatch
    ? exportedContent
    : `<h1>${escapeHtml(title)}</h1>\n${exportedContent}`;

  return { title, html };
}
