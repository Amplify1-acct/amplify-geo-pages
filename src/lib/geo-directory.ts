type WordPressTitle = { raw?: string; rendered?: string };

export type WordPressGeoPage = {
  id: number;
  link?: string;
  slug?: string;
  status?: string;
  directoryLabel?: string;
  title?: WordPressTitle;
  content?: { raw?: string; rendered?: string };
};

function plainText(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalized(value: string) {
  return plainText(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function titleCaseSlug(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function pageLabel(page: WordPressGeoPage) {
  if (page.directoryLabel) return page.directoryLabel;
  const title = plainText(page.title?.raw || page.title?.rendered || "");
  const withoutTopic = title.replace(/\s+(?:NY|New York)\s+.+?\s+(?:Lawyer|Attorney)s?$/i, "").trim();
  if (withoutTopic && withoutTopic !== title) return withoutTopic.replace(/,$/, "").trim();
  const slugLocation = page.slug?.match(/^(.+?)-ny-(?:.+)$/i)?.[1];
  return slugLocation ? titleCaseSlug(slugLocation) : title;
}

function topicKey(slug = "", title = "") {
  const topic = plainText(title).match(/\s+NY\s+(.+?)\s+(?:Lawyer|Attorney)s?$/i)?.[1]
    || slug.toLowerCase().replace(/-amplify-draft-.+$/, "").match(/-ny-(.+)$/)?.[1] || "";
  return normalized(topic).replace(/\s+(?:lawyers?|attorneys?)$/, "").replace(/\baccidents\b/g, "accident");
}

function communityList(content: string) {
  const sectionPattern = /(<h2\b[^>]*>(?:(?!<h2\b|<\/h2>)[\s\S])*?(?:(?:cities|towns|areas|communities)\s+(?:we\s+)?serve|(?:lawyers?|attorneys?)\s+serving)[\s\S]*?<\/h2>)([\s\S]*?)(?=<h2\b|$)/i;
  const section = content.match(sectionPattern);
  if (!section || section.index === undefined) return null;
  const list = section[2].match(/<ul\b[^>]*>[\s\S]*?<\/ul>/i);
  if (!list || list.index === undefined) return null;
  const start = section.index + section[1].length + list.index;
  return { html: list[0], start, end: start + list[0].length };
}

export function communityDirectoryLabels(content: string) {
  const list = communityList(content);
  if (!list) return [];
  return [...list.html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((item) => pageLabel({ id: 0, title: { raw: plainText(item[1]) } }))
    .filter(Boolean);
}

function campaignPages(current: WordPressGeoPage, published: WordPressGeoPage[]) {
  const currentContent = current.content?.raw || current.content?.rendered || "";
  const labels = communityDirectoryLabels(currentContent);
  const labelOrder = new Map(labels.map((label, index) => [normalized(label), index]));
  const topic = topicKey(current.slug, current.title?.raw || current.title?.rendered);
  if (!labels.length || !topic) return [];
  return published
    .map((page) => {
      const titleLabel = normalized(pageLabel(page));
      const directoryLabel = labels.find((label) => {
        const key = normalized(label);
        return titleLabel === key || titleLabel.startsWith(`${key} `);
      });
      return directoryLabel ? { ...page, directoryLabel } : page;
    })
    .filter((page) => page.status === "publish"
      && Boolean(page.link)
      && Boolean(page.directoryLabel)
      && topicKey(page.slug, page.title?.raw || page.title?.rendered) === topic)
    .sort((a, b) => {
      const aOrder = labelOrder.get(normalized(pageLabel(a))) ?? Number.MAX_SAFE_INTEGER;
      const bOrder = labelOrder.get(normalized(pageLabel(b))) ?? Number.MAX_SAFE_INTEGER;
      return aOrder - bOrder || pageLabel(a).localeCompare(pageLabel(b));
    });
}

export function linkCommunityDirectory(
  content: string,
  publishedPages: WordPressGeoPage[],
  currentPageId?: number,
  preferredLabels: string[] = [],
) {
  const list = communityList(content);
  if (!list) return content;

  const existingItems = [...list.html.matchAll(/<li\b([^>]*)>([\s\S]*?)<\/li>/gi)]
    .map((item) => ({ attributes: item[1], label: pageLabel({ id: 0, title: { raw: plainText(item[2]) } }) }))
    .filter((item) => item.label);
  const existingByLabel = new Map(existingItems.map((item) => [normalized(item.label), item]));
  const linkedByLabel = new Map(
    publishedPages
      .filter((page) => page.id !== currentPageId && page.status === "publish")
      .map((page) => ({ label: pageLabel(page), url: page.link || "" }))
      .filter((item) => item.label && /^https:\/\//i.test(item.url))
      .map((item) => [normalized(item.label), item]),
  );
  const orderedLabels = (preferredLabels.length
    ? preferredLabels
    : [
        ...existingItems.map((item) => item.label),
        ...publishedPages.map((page) => pageLabel(page)),
      ])
    .filter((label, index, labels) => labels.findIndex((other) => normalized(other) === normalized(label)) === index);
  const opening = list.html.match(/^<ul\b[^>]*>/i)?.[0] || "<ul>";
  const rebuiltItems = orderedLabels.map((label) => {
    const key = normalized(label);
    const attributes = existingByLabel.get(key)?.attributes || "";
    const linked = linkedByLabel.get(key);
    const body = linked
      ? `<a href="${escapeHtml(linked.url)}">${escapeHtml(linked.label)}</a>`
      : escapeHtml(label);
    return `<li${attributes}>${body}</li>`;
  });
  const rebuilt = `${opening}\n${rebuiltItems.join("\n")}\n</ul>`;
  return `${content.slice(0, list.start)}${rebuilt}${content.slice(list.end)}`;
}

export async function publishedWordPressGeoPages(siteUrl: string, authorization: string) {
  const pages: WordPressGeoPage[] = [];
  let pageNumber = 1;
  let totalPages = 1;
  do {
    const params = new URLSearchParams({
      status: "publish",
      context: "edit",
      per_page: "100",
      page: String(pageNumber),
      _fields: "id,link,slug,status,title,content",
    });
    const response = await fetch(`${siteUrl}/wp-json/wp/v2/pages?${params}`, {
      headers: { Authorization: authorization },
      cache: "no-store",
    });
    const data = await response.json().catch(() => []) as WordPressGeoPage[] | { message?: string };
    if (!response.ok || !Array.isArray(data)) {
      throw new Error(Array.isArray(data) ? "WordPress could not list published GEO pages." : data.message || "WordPress could not list published GEO pages.");
    }
    pages.push(...data);
    totalPages = Math.max(1, Number(response.headers.get("x-wp-totalpages") || "1"));
    pageNumber += 1;
  } while (pageNumber <= totalPages);
  return pages;
}

export async function linkDraftToPublishedGeoPages(
  siteUrl: string,
  authorization: string,
  content: string,
  slug: string,
  title: string,
) {
  const published = await publishedWordPressGeoPages(siteUrl, authorization);
  const current: WordPressGeoPage = {
    id: 0,
    slug,
    status: "draft",
    title: { raw: title },
    content: { raw: content },
  };
  return prepareTopicCommunityDirectory(current, published);
}

export async function syncPublishedGeoDirectory(
  siteUrl: string,
  authorization: string,
  pageId: number,
) {
  const published = await publishedWordPressGeoPages(siteUrl, authorization);
  const current = published.find((page) => page.id === pageId);
  if (!current) throw new Error("The newly published GEO page was not found while linking its community directory.");
  const preparedCurrent = prepareTopicCommunityDirectory(current, published);
  const network = campaignPages({ ...current, content: { raw: preparedCurrent } }, published);
  if (!network.length) return 0;
  const preferredLabels = communityDirectoryLabels(preparedCurrent);

  const results = await Promise.all(network.map(async (page) => {
    const raw = page.content?.raw || "";
    const prepared = prepareTopicCommunityDirectory(page, published);
    const linked = topicCommunityHeading(linkCommunityDirectory(prepared, network, page.id, preferredLabels), page);
    if (!raw || linked === raw) return false;
    const response = await fetch(`${siteUrl}/wp-json/wp/v2/pages/${page.id}`, {
      method: "POST",
      headers: { Authorization: authorization, "Content-Type": "application/json" },
      body: JSON.stringify({ content: linked }),
      cache: "no-store",
    });
    const saved = await response.json().catch(() => ({})) as { message?: string };
    if (!response.ok) throw new Error(saved.message || `WordPress could not update GEO directory links on page ${page.id}.`);
    return true;
  }));
  return results.filter(Boolean).length;
}

// A location directory on a child topic page must resolve to that same topic,
// never the location's general personal-injury landing page.
function topicCommunityHeading(content: string, page: WordPressGeoPage) {
  const topic = plainText(page.title?.raw || page.title?.rendered || "")
    .match(/\s+NY\s+(.+?)\s+(?:Lawyer|Attorney)s?$/i)?.[1];
  if (!topic) return content;
  return content.replace(/(<h2\b[^>]*>)([^<]*?)\s+Communities We Serve(<\/h2>)/i,
    (_all, open, county, close) => `${open}${escapeHtml(topic)} Lawyers Serving ${county}${close}`);
}

export function prepareTopicCommunityDirectory(current: WordPressGeoPage, published: WordPressGeoPage[]) {
  let content = current.content?.raw || current.content?.rendered || "";
  if (!topicKey(current.slug, current.title?.raw || current.title?.rendered)) return content;
  const location = normalized(pageLabel(current));
  // Resolve the comprehensive county roster even when the approved Doc has no
  // directory, or contains only a smaller nearby-neighborhood list.
  const counties = published.filter(page => page.status === "publish"
    && /\bCounty\b/i.test(plainText(page.title?.raw || page.title?.rendered || ""))
    && /personal injury/i.test(plainText(page.title?.raw || page.title?.rendered || "")))
    .map(page => ({ page, labels: communityDirectoryLabels(page.content?.raw || page.content?.rendered || "") }))
    .filter(({ labels }) => labels.some(label => normalized(label) === location));
  if (counties.length > 1) throw new Error("The location matches more than one county roster. Resolve its county before preparing the draft.");
  const canonical = counties[0];
  if (canonical) {
    const topic = plainText(current.title?.raw || current.title?.rendered || "")
      .match(/\s+NY\s+(.+?)\s+(?:Lawyer|Attorney)s?$/i)?.[1];
    const countyLabel = canonical.labels.find(label => /\bCounty\b/i.test(label)) || pageLabel(canonical.page);
    const heading = `${topic || "Personal Injury"} Lawyers Serving ${countyLabel}`;
    if (!communityList(content)) {
      const section = `<!-- wp:heading -->\n<h2 class="wp-block-heading">${escapeHtml(heading)}</h2>\n<!-- /wp:heading -->\n<!-- wp:list -->\n<ul class="wp-block-list">${canonical.labels.map(label => `<li>${escapeHtml(label)}</li>`).join("\n")}</ul>\n<!-- /wp:list -->\n`;
      // Insert before a complete heading block, never inside a paragraph or CTA.
      const boundary = content.match(/(?:<!-- wp:heading[^>]*-->\s*)?<h2\b/);
      if (!boundary || boundary.index === undefined) throw new Error("A complete section boundary is required for the county directory.");
      content = content.slice(0, boundary.index) + section + content.slice(boundary.index);
    }
    content = linkCommunityDirectory(content, [], current.id, canonical.labels);
    const withRoster = { ...current, content: { raw: content } };
    content = linkCommunityDirectory(content, campaignPages(withRoster, published), current.id, canonical.labels);
    // An existing generic or nearby directory gets the county/topic heading too.
    const list = communityList(content);
    if (list) {
      const before = content.slice(0, list.start);
      const headings = [...before.matchAll(/<h2\b[^>]*>[\s\S]*?<\/h2>/g)];
      const last = headings.at(-1);
      if (last?.index !== undefined) content = content.slice(0, last.index) + `<h2 class="wp-block-heading">${escapeHtml(heading)}</h2>` + content.slice(last.index + last[0].length);
    }
    return content;
  }
  return topicCommunityHeading(linkCommunityDirectory(content, campaignPages(current, published), current.id), current);
}
