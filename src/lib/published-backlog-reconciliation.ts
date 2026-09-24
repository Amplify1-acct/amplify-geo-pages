import { restoredArchiveDocIds } from "@/lib/aron-archive-restoration";
import { listAronReviewItems, saveAronWordPressDraft } from "@/lib/aron-review-queue";
import { getWordPressConfigAsync, wordPressAuthorization } from "@/lib/wordpress";
import { getUploadJob, putUploadJob, uploadLease, uploadRedis } from "@/lib/wordpress-upload-store";

// On September 10 the owner confirmed this historical PI batch was published.
// This is a bounded data reconciliation, not a rule for future enhancements.
export async function reconcileConfirmedPublishedBacklog(accessToken: string) {
  let reconciled = 0;
  const errors: string[] = [];
  for (const item of await listAronReviewItems()) {
    if (item.workflow !== "enhance" || !item.aronDone || item.wordpressStatus === "publish"
      || Date.parse(item.createdAt) >= Date.parse("2026-09-11T00:00:00-04:00")) continue;
    let source: URL;
    try { source = new URL(item.pageUrl || item.website); } catch { continue; }
    const docId = item.docUrl.match(/\/document\/d\/([A-Za-z0-9_-]+)/)?.[1];
    const historicalConstruction = source.hostname.replace(/^www\./, "") === "fulginiti-law.com" && source.pathname.includes("construction-accident") && !!docId && restoredArchiveDocIds.has(docId);
    const ownerConfirmed = source.hostname.replace(/^www\./, "") === "fulginiti-law.com" && source.pathname.includes("personal-injury");
    const release = await uploadLease(`job:${item.id}`);
    if (!release) { errors.push(`${item.id}: preparation is finishing; retry reconciliation shortly.`); continue; }
    try {
      const job = await getUploadJob(item.id);
      // Stop further draft work even if the live-page check needs attention.
      if (job && ownerConfirmed) await putUploadJob({ ...job, credential: undefined, state: "blocked", error: "Owner confirmed this page is already published; verifying the original URL.", updatedAt: new Date().toISOString() });
      const config = await getWordPressConfigAsync(item.clientId, item.website, accessToken);
      if (new URL(config.siteUrl).hostname.replace(/^www\./, "") !== source.hostname.replace(/^www\./, "")) throw new Error("The original page does not match the configured WordPress site.");
      const slug = source.pathname.split("/").filter(Boolean).at(-1)!;
      const response = await fetch(`${config.siteUrl}/wp-json/wp/v2/pages?context=edit&status=publish&slug=${encodeURIComponent(slug)}&_fields=id,status,link,featured_media,content`, {
        headers: { Authorization: wordPressAuthorization(config) }, cache: "no-store", signal: AbortSignal.timeout(15000),
      });
      if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) throw new Error(`Published-page verification returned HTTP ${response.status}; no WordPress content was changed.`);
      const pages = await response.json() as { id: number; status: string; link: string; featured_media?: number; content?:{raw?:string} }[];
      const page = response.ok && Array.isArray(pages) ? pages.find(page => page.status === "publish" && new URL(page.link).pathname.replace(/\/$/, "") === source.pathname.replace(/\/$/, "")) : undefined;
      if (!page) throw new Error("The original published URL could not be verified; no WordPress content was changed.");
      let matchingHistoricalCopy = false;
      if (historicalConstruction && item.wordpressPageId) {
        const draftResponse = await fetch(`${config.siteUrl}/wp-json/wp/v2/pages/${item.wordpressPageId}?context=edit&_fields=content`, {
          headers: { Authorization: wordPressAuthorization(config) }, cache: "no-store", signal: AbortSignal.timeout(15000),
        });
        if (!draftResponse.ok) throw new Error("Could not compare the historical draft with the live page.");
        const draft = await draftResponse.json() as { content?: { raw?: string } };
        const normalize = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&(?:nbsp|#160);/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
        const paragraphs = [...(draft.content?.raw || "").matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(match => normalize(match[1])).filter(text => text.length > 150).slice(0, 5);
        const liveText = normalize(page.content?.raw || "");
        matchingHistoricalCopy = paragraphs.length >= 3 && paragraphs.filter(text => liveText.includes(text)).length >= 3;
        if (!matchingHistoricalCopy) throw new Error("Historical construction page is live, but its approved main copy needs manual comparison; left unchanged.");
      }
      if (!ownerConfirmed && !matchingHistoricalCopy && (!docId || !page.content?.raw?.includes(`amplify-geo-source:${docId}`))) continue;
      await uploadRedis().set(`amplify:published-reconciliation-backup:v1:${item.id}`, item, { nx: true });
      await saveAronWordPressDraft(item.id, { pageId: page.id, pageUrl: page.link, editUrl: `${config.siteUrl}/wp-admin/post.php?post=${page.id}&action=edit`, status: "publish", preparationRequired: false, warnings: [], featuredMediaId: page.featured_media });
      if (job) await putUploadJob({ ...job, credential: undefined, state: "complete", error: undefined, updatedAt: new Date().toISOString() });
      reconciled++;
    } catch (error) {
      errors.push(`${item.id}: ${error instanceof Error ? error.message : "Published-page reconciliation failed."}`);
    } finally { await release(); }
  }
  return { reconciled, errors };
}
