import { createHash } from "node:crypto";
import { decryptToken, encryptToken } from "@/lib/google";
import { uploadRedis, uploadLease } from "@/lib/wordpress-upload-store";
import { wordPressAuthorization, type WordPressConfig } from "@/lib/wordpress";
import { planPublicationLinks, publicLink, text, type LinkPage } from "@/lib/post-publication-links";

const PREFIX = "amplify:post-publication:v1:";
const DUE = PREFIX + "due";
export type PublicationJob = {
  id: string; clientId: string; pageId: number; endpoint: "pages" | "posts";
  state: "waiting_publication" | "queued" | "running" | "complete" | "needs_attention";
  updatedAt: string; credential?: string; workflow?: string; practiceAreaUrls: Record<string,string>;
  changedUrls: string[]; pending: string[]; attempts: number; indexing: "pending";
  plan?: ReturnType<typeof planPublicationLinks>; cursor?: number;
};
export const publicationJobId = (clientId: string, pageId: number, endpoint = "pages") => `${clientId}:${endpoint}:${pageId}`;
function publicJob(job: PublicationJob) {
  const { id, clientId, pageId, endpoint, state, updatedAt, changedUrls, pending, attempts, indexing } = job;
  return { id, clientId, pageId, endpoint, state, updatedAt, changedUrls, pending, attempts, indexing };
}
async function save(job: PublicationJob, due?: number) {
  const tx = uploadRedis().multi();
  tx.set(PREFIX + job.id, JSON.stringify(job));
  if (due !== undefined) tx.zadd(DUE, { member: job.id, score: due }); else tx.zrem(DUE, job.id);
  await tx.exec();
}
export async function getPublicationJob(clientId: string, pageId: number, endpoint = "pages") {
  const job = await uploadRedis().get<PublicationJob>(PREFIX + publicationJobId(clientId,pageId,endpoint));
  return job ? publicJob(job) : null;
}
export async function queuePublicationLinks(config: WordPressConfig, options: { workflow?: string; practiceAreaUrls?: Record<string,string>; pageId: number; status?: string; publishAt?: string; reset?: boolean }) {
  const endpoint = options.workflow === "blog" ? "posts" : "pages";
  const id = publicationJobId(config.clientId, options.pageId, endpoint);
  const existing = await uploadRedis().get<PublicationJob>(PREFIX + id);
  if (existing && ["queued", "running", "waiting_publication"].includes(existing.state)) return publicJob(existing);
  if (existing && !options.reset) return publicJob(existing);
  const job: PublicationJob = { id, clientId: config.clientId, pageId: options.pageId, endpoint,
    state: options.status === "future" ? "waiting_publication" : "queued", updatedAt: new Date().toISOString(),
    credential: encryptToken(JSON.stringify(config)), workflow: options.workflow,
    practiceAreaUrls: options.practiceAreaUrls || {}, changedUrls: [], pending: [], attempts: 0, indexing: "pending" };
  const scheduled = Date.parse(options.publishAt || "");
  await save(job, options.status === "future" && Number.isFinite(scheduled) ? Math.max(Date.now(), scheduled) : Date.now());
  return publicJob(job);
}
async function wp<T>(url: string, authorization: string, body?: unknown): Promise<{ data: T; response: Response }> {
  const response = await fetch(url, { method: body ? "POST" : "GET", headers: { Authorization: authorization, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined, cache: "no-store", signal: AbortSignal.timeout(20000) });
  if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) throw new Error(`WordPress link reconciliation failed (HTTP ${response.status}${response.headers.get("cf-mitigated") === "challenge" ? "; Cloudflare challenge" : ""}).`);
  return { data: await response.json() as T, response };
}
async function liveHtml(url: string) {
  const response = await fetch(url, { cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(20000), headers: { "User-Agent": "AMPLIFY-Link-Verifier/1.0" } });
  if (response.status !== 200) throw new Error(`${url}: public verification returned HTTP ${response.status}; redirects are not canonical destinations.`);
  const html = await response.text();
  if (/noindex/i.test(response.headers.get("x-robots-tag") || "") || /<meta\b[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html)) throw new Error(`${url}: page is not indexable.`);
  const canonical = [...html.matchAll(/<link\b[^>]*>/gi)].find(m => /rel=["']canonical["']/i.test(m[0]))?.[0].match(/href=["']([^"']+)/i)?.[1];
  if (!canonical || new URL(canonical, url).pathname.replace(/\/$/, "") !== new URL(url).pathname.replace(/\/$/, "")) throw new Error(`${url}: canonical URL could not be verified.`);
  return html;
}
function listSignatures(content: string) {
  const navigation = [...content.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2\b|$)/gi)]
    .filter(section => /(?:cities|towns|communities|areas|neighborhoods|locations).*(?:serve|cover)|(?:lawyers?|attorneys?) serving|related.*(?:resources|topics|practices)|county resources|types of accidents|practice areas/i.test(text(section[1])))
    .map(section => section[2]).join("\n");
  return [...navigation.matchAll(/<ul\b[^>]*>[\s\S]*?<\/ul>/gi)].map(m => ({
    labels: [...m[0].matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map(i => text(i[1])),
    links: [...m[0].matchAll(/href=["']([^"']+)["']/gi)].map(a => a[1].replace(/&amp;/g, "&")),
  }));
}
function verifyLists(expected: string, actual: string) {
  const actualLists = listSignatures(actual);
  for (const list of listSignatures(expected)) {
    if (!actualLists.some(candidate => JSON.stringify(candidate) === JSON.stringify(list))) throw new Error("Saved/public body list does not match the expected labels, order and links.");
  }
}
async function pendingIndexing(job: PublicationJob, url: string) {
  const key = PREFIX + "indexing:" + createHash("sha256").update(url).digest("hex");
  await uploadRedis().set(key, JSON.stringify({ clientId: job.clientId, url, changedAt: new Date().toISOString(), state: "pending", reason: "Individual Google Search Console Request indexing is required; it has not been submitted by this worker." }));
}
export async function runPublicationLinks(id: string) {
  let job = await uploadRedis().get<PublicationJob>(PREFIX + id);
  if (!job || !job.credential || job.state === "complete") return;
  const release = await uploadLease(`post-publication:${job.clientId}`);
  if (!release) return;
  try {
    const config = JSON.parse(decryptToken(job.credential)) as WordPressConfig;
    const authorization = wordPressAuthorization(config);
    const base = `${config.siteUrl}/wp-json/wp/v2`;
    const { data: current } = await wp<LinkPage>(`${base}/${job.endpoint}/${job.pageId}?context=edit`, authorization);
    if (current.status !== "publish") {
      job.state = "waiting_publication";
      job.pending = [`WordPress status is ${current.status}; linking waits for actual publication.`];
      await save(job, Date.now() + 15 * 60000); return;
    }
    if (!current.link) throw new Error("Published page has no canonical URL.");
    await liveHtml(publicLink(current.link, config.siteUrl));
    job.state = "running"; job.attempts++; job.updatedAt = new Date().toISOString();
    if (!job.plan) {
      const pages: LinkPage[] = [];
      if (job.endpoint === "pages") {
        let number = 1, total = 1;
        do {
          const result = await wp<LinkPage[]>(`${base}/pages?context=edit&status=publish&per_page=100&page=${number}&_fields=id,parent,link,slug,status,title,content`, authorization);
          if (!Array.isArray(result.data)) throw new Error("WordPress returned no published-page inventory.");
          pages.push(...result.data); total = Number(result.response.headers.get("x-wp-totalpages") || 1); number++;
        } while (number <= total);
      } else pages.push(current);
      job.plan = planPublicationLinks(pages, current.id, { siteUrl: config.siteUrl, practiceAreaUrls: job.practiceAreaUrls, workflow: job.workflow });
      job.cursor = 0; job.pending = job.plan.pending;
      await pendingIndexing(job, current.link);
      await save(job, Date.now() + 60000);
    }
    // Each invocation handles a bounded number of pages. Persist progress before
    // each write so a timeout can retry safely without losing changed URLs.
    let processed = 0;
    while ((job.cursor || 0) < job.plan.updates.length && processed < 3) {
      const update = job.plan.updates[job.cursor || 0];
      const endpoint = job.endpoint === "posts" && update.page.id === job.pageId ? "posts" : "pages";
      const { data: latest } = await wp<LinkPage>(`${base}/${endpoint}/${update.page.id}?context=edit`, authorization);
      if (latest.status !== "publish" || latest.link !== update.page.link) throw new Error(`Page ${latest.id} changed status or canonical URL; reconciliation needs review.`);
      const before = latest.content?.raw;
      if (!before) throw new Error(`Page ${latest.id}: editable content unavailable.`);
      if (before !== update.content && before !== update.page.content?.raw) throw new Error(`Page ${latest.id} was edited after planning. Re-plan before applying links.`);
      const url = publicLink(latest.link!, config.siteUrl);
      if (before !== update.content) {
        // Verify all internal destinations in the changed lists, using a small
        // cache within this write. Never turn draft/redirect URLs into links.
        for (const destination of new Set(listSignatures(update.content).flatMap(l => l.links).filter(h => { try { return new URL(h,config.siteUrl).hostname.replace(/^www\./,"") === new URL(config.siteUrl).hostname.replace(/^www\./,""); } catch { return false; } }))) {
          if (destination.startsWith("#")) continue;
          await liveHtml(publicLink(destination, config.siteUrl));
        }
        const backupKey = PREFIX + "backup:" + id + ":" + latest.id + ":" + createHash("sha256").update(before).digest("hex").slice(0,16);
        await uploadRedis().set(backupKey, JSON.stringify({ backedUpAt: new Date().toISOString(), page: latest }), { nx: true });
        if (!job.changedUrls.includes(url)) job.changedUrls.push(url);
        await pendingIndexing(job, url);
        await save(job, Date.now() + 60000);
        await wp<LinkPage>(`${base}/${endpoint}/${latest.id}`, authorization, { content: update.content });
      }
      const { data: saved } = await wp<LinkPage>(`${base}/${endpoint}/${latest.id}?context=edit`, authorization);
      if (saved.status !== "publish" || saved.link !== latest.link) throw new Error(`Page ${latest.id}: saved publication identity changed.`);
      verifyLists(update.content, saved.content?.rendered || "");
      try { verifyLists(update.content, await liveHtml(url)); }
      catch (error) {
        // A stale public cache must not hide incomplete verification, but it
        // need not prevent the rest of the backed-up body-list batch saving.
        job.pending.push(`${url}: public verification pending; ${error instanceof Error ? error.message : "refresh the page cache."}`);
      }
      job.cursor = (job.cursor || 0) + 1; processed++;
      await save(job, Date.now() + 60000);
    }
    const done = (job.cursor || 0) >= job.plan.updates.length;
    job.state = done ? job.pending.length ? "needs_attention" : "complete" : "queued";
    job.updatedAt = new Date().toISOString();
    if (job.state === "complete") { job.credential = undefined; job.plan = undefined; }
    await save(job, done ? undefined : Date.now());
    return publicJob(job);
  } catch (error) {
    job.state = "needs_attention"; job.updatedAt = new Date().toISOString();
    job.pending = [...new Set([...job.pending, error instanceof Error ? error.message : "Link verification failed."])];
    await save(job); return publicJob(job);
  } finally { await release(); }
}
export async function drainPublicationLinks() {
  const ids = await uploadRedis().zrange<string[]>(DUE, 0, Date.now(), { byScore: true, offset: 0, count: 1 });
  return await Promise.all(ids.map(runPublicationLinks));
}
