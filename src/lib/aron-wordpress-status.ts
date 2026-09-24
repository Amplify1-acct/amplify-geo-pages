import { listEditorialSlots, saveEditorialSlot, editorialStoreConfigured } from "@/lib/editorial-store";
import { getWordPressConfigAsync, wordPressAuthorization } from "@/lib/wordpress";
import { saveAronWordPressStatus, type AronReviewItem } from "@/lib/aron-review-queue";

export async function refreshAronWordPressStatuses(records: AronReviewItem[], accessToken: string, force = false) {
  const errors = new Map<string, string>();
  const groups = new Map<string, AronReviewItem[]>();
  for (const record of records) {
    const checkedAt = Date.parse(record.wordpressCheckedAt || "");
    if (!force && Number.isFinite(checkedAt) && Date.now() - checkedAt < 300_000 && checkedAt <= Date.now()) continue;
    if (record.reviewDeletedAt || !record.wordpressPageId || !(record.aronDone || record.approvalStatus === "APPROVED")
      || ["publish", "trash"].includes(record.wordpressStatus || "")) continue;
    const key = `${record.clientId || record.website}|${record.workflow === "blog" ? "posts" : "pages"}`;
    groups.set(key, [...(groups.get(key) || []), record]);
  }
  if (!groups.size) return errors;
  const slots = editorialStoreConfigured() ? await listEditorialSlots() : [];
  await Promise.allSettled([...groups.values()].map(async items => {
    try {
      const first = items[0];
      const config = await getWordPressConfigAsync(first.clientId, first.website, accessToken);
      const endpoint = first.workflow === "blog" ? "posts" : "pages";
      for (let start = 0; start < items.length; start += 100) {
        const batch = items.slice(start, start + 100);
        const ids = [...new Set(batch.map(item => item.wordpressPageId))].join(",");
        const response = await fetch(`${config.siteUrl}/wp-json/wp/v2/${endpoint}?context=edit&status=publish,draft,pending,future,private,trash&include=${ids}&per_page=100&_fields=id,status,link,date_gmt,content`, {
          headers: { Authorization: wordPressAuthorization(config) }, cache: "no-store", signal: AbortSignal.timeout(10000),
        });
        if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
          throw new Error(response.headers.get("cf-mitigated") === "challenge"
            ? "Cloudflare blocked the status check. Saved status may be out of date."
            : `WordPress status could not be verified (HTTP ${response.status}). Saved status may be out of date.`);
        }
        const pages = await response.json() as { id: number; status: string; link?: string; date_gmt?: string; content?: { raw?: string } }[];
        if (!Array.isArray(pages)) throw new Error("WordPress returned an invalid status response.");
        for (const item of batch) {
          const page = pages.find(page => page.id === item.wordpressPageId);
          if (!page) errors.set(item.id, "The linked WordPress item was not returned. Its status needs verification.");
          if (page && ["publish", "future", "draft", "pending", "private", "trash"].includes(page.status)) {
            await saveAronWordPressStatus(item.id, page.id, page.status, page.link, page.date_gmt, page.content?.raw);
            const slotStatus = page.status === "publish" ? "published" : page.status === "future" ? "scheduled" : page.status === "draft" ? "wordpress_draft" : null;
            if (slotStatus) for (const slot of slots.filter(s => s.contentRecordId === item.id && s.clientId === item.clientId && s.status !== "skipped" && s.status !== slotStatus)) {
              await saveEditorialSlot({ ...slot, status: slotStatus, updatedAt: new Date().toISOString() });
            }
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "WordPress status could not be verified.";
      for (const item of items) errors.set(item.id, message);
    }
  }));
  return errors;
}
