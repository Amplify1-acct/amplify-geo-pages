import {
  BILLY_GEO_CHILD_PARENTS,
  BILLY_GEO_CHILD_SERVICE_TEMPLATES,
} from "@/lib/billy-geo-child-campaign";

type WordPressPage = {
  id: number;
  link?: string;
  slug?: string;
  status?: string;
  title?: { raw?: string; rendered?: string };
  content?: { raw?: string; rendered?: string };
};

const START = "<!-- amplify-geo-child-services:start -->";
const END = "<!-- amplify-geo-child-services:end -->";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function wordpressPage(
  siteUrl: string,
  authorization: string,
  pageId: number,
) {
  const response = await fetch(
    `${siteUrl}/wp-json/wp/v2/pages/${pageId}?context=edit&_fields=id,link,slug,status,title,content`,
    { headers: { Authorization: authorization }, cache: "no-store" },
  );
  const page = await response.json().catch(() => ({})) as WordPressPage & { message?: string };
  if (!response.ok || !page.id) {
    throw new Error(page.message || `WordPress could not open page ${pageId}.`);
  }
  return page;
}

function serviceKey(page: WordPressPage) {
  const haystack = `${page.slug || ""} ${page.title?.raw || page.title?.rendered || ""}`.toLowerCase();
  if (/e[ -]?bike/.test(haystack)) return "e-bike";
  if (/slip[ -]?and[ -]?fall/.test(haystack)) return "slip-and-fall";
  if (/car[ -]?accident/.test(haystack)) return "car";
  return undefined;
}

function managedDirectory(location: string, pages: Map<string, WordPressPage>) {
  const items = BILLY_GEO_CHILD_SERVICE_TEMPLATES.flatMap((service) => {
    const page = pages.get(service.key);
    if (!page?.link || page.status !== "publish") return [];
    return `<li><a href="${escapeHtml(page.link)}">${escapeHtml(service.directoryLabel)} in ${escapeHtml(location)}</a></li>`;
  });
  if (!items.length) return "";
  return `${START}
<!-- wp:heading -->
<h2 class="wp-block-heading">Personal Injury Cases We Handle in ${escapeHtml(location)}</h2>
<!-- /wp:heading -->
<!-- wp:list -->
<ul class="wp-block-list">
${items.join("\n")}
</ul>
<!-- /wp:list -->
${END}`;
}

function insertOrReplaceDirectory(content: string, directory: string) {
  const managed = new RegExp(`${START}[\\s\\S]*?${END}`, "i");
  if (managed.test(content)) return content.replace(managed, directory);
  const firstH2 = content.search(/<h2\b/i);
  if (firstH2 >= 0) return `${content.slice(0, firstH2)}${directory}\n${content.slice(firstH2)}`;
  return `${content}\n${directory}`;
}

export async function syncPublishedBillyGeoChildDirectory(
  siteUrl: string,
  authorization: string,
  parentId: number,
) {
  const parentSpec = BILLY_GEO_CHILD_PARENTS.find((item) => item.pageId === parentId);
  if (!parentSpec) return 0;

  const parent = await wordpressPage(siteUrl, authorization, parentId);
  const childResponse = await fetch(
    `${siteUrl}/wp-json/wp/v2/pages?parent=${parentId}&status=publish&context=edit&per_page=100&_fields=id,link,slug,status,title`,
    { headers: { Authorization: authorization }, cache: "no-store" },
  );
  const childPages = await childResponse.json().catch(() => []) as WordPressPage[] & { message?: string };
  if (!childResponse.ok || !Array.isArray(childPages)) {
    throw new Error(childPages.message || "WordPress could not list the published GEO child pages.");
  }

  const byService = new Map<string, WordPressPage>();
  for (const page of childPages) {
    const key = serviceKey(page);
    if (key && !byService.has(key)) byService.set(key, page);
  }

  for (const service of BILLY_GEO_CHILD_SERVICE_TEMPLATES) {
    if (byService.has(service.key)) continue;
    const existingId = parentSpec.services?.[service.key]?.existingPageId;
    if (!existingId) continue;
    const existing = await wordpressPage(siteUrl, authorization, existingId);
    if (existing.status === "publish" && existing.link) byService.set(service.key, existing);
  }

  const directory = managedDirectory(parentSpec.location, byService);
  if (!directory) return 0;
  const raw = parent.content?.raw || "";
  const updated = insertOrReplaceDirectory(raw, directory);
  if (!raw || updated === raw) return 0;

  const save = await fetch(`${siteUrl}/wp-json/wp/v2/pages/${parentId}`, {
    method: "POST",
    headers: { Authorization: authorization, "Content-Type": "application/json" },
    body: JSON.stringify({ content: updated }),
    cache: "no-store",
  });
  const saved = await save.json().catch(() => ({})) as { message?: string };
  if (!save.ok) throw new Error(saved.message || `WordPress could not update the ${parentSpec.location} service links.`);
  return byService.size;
}

