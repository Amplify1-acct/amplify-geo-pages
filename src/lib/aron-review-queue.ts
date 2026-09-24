import { restoreEpsteinApprovedDocument } from "./epstein-approved-documents";
import { restoredArchiveDocIds } from "./aron-archive-restoration";
import { Redis } from "@upstash/redis";
import { isObsoleteDrazenPage } from "@/lib/obsolete-content";

const REVIEW_QUEUE_KEY = "amplify:aron-review-queue:v1";
const REVIEW_DELETED_KEY = "amplify:aron-review-deleted:v1";
const REVIEW_PRIORITY_KEY = "amplify:aron-review-priority:v1";

export type AronReviewItem = {
  id: string;
  clientId?: string;
  clientName?: string;
  workflow?: "create" | "enhance" | "blog" | "aop" | "subaop";
  website: string;
  pageUrl?: string;
  primaryKeyword?: string;
  practiceArea: string;
  city: string;
  state: string;
  jurisdiction?: string;
  parentPracticeArea?: string;
  blogPracticeArea?: string;
  authorityAttorney?: string;
  parentId?: number;
  createdAt: string;
  updatedAt?: string;
  docUrl: string;
  docName?: string;
  wordCount?: number;
  status: string;
  aronDone: boolean;
  reviewArchivedAt?: string;
  reviewArchiveReason?: "manual" | "wordpress-upload" | "published" | "wordpress-trash" | "archive-restored" | "preparation-required";
  reviewDeletedAt?: string;
  approvalStatus?: string;
  approvedAt?: string;
  finalApprovedAt?: string;
  reviewPriority?: number;
  pendingImageReviewId?: string;
  featuredImageApproved?: boolean;
  wordpressPageId?: number;
  wordpressUrl?: string;
  wordpressEditUrl?: string;
  wordpressPreviewUrl?: string;
  wordpressStatus?: string;
  wordpressDraftAt?: string;
  wordpressPublishedAt?: string;
  wordpressScheduledAt?: string;
  wordpressCheckedAt?: string;
  wordpressStatusError?: string;
  wordpressIntakeOnly?: boolean;
  featuredMediaId?: number;
  featuredImageUrl?: string;
  pendingImageUrl?: string;
  featuredImageReviewRequired?: boolean;
  error?: string;
  preparationRequired?: boolean;
  draftWarnings?: string[];
  upload?: {state:string;attempts:number;updatedAt:string;error?:string;nextAttemptAt?:string};
};

type TrackerRecord = Record<string, unknown> & {
  id?: unknown;
  clientId?: unknown;
  clientName?: unknown;
  workflow?: unknown;
  website?: unknown;
  pageUrl?: unknown;
  primaryKeyword?: unknown;
  practiceArea?: unknown;
  city?: unknown;
  state?: unknown;
  jurisdiction?: unknown;
  parentPracticeArea?: unknown;
  blogPracticeArea?: unknown;
  parentId?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  docUrl?: unknown;
  docName?: unknown;
  wordCount?: unknown;
  status?: unknown;
  aronDone?: unknown;
  approvalStatus?: unknown;
  pendingImageReviewId?: unknown;
  featuredImageApproved?: unknown;
  wordpressPageId?: unknown;
  wordpressUrl?: unknown;
  wordpressEditUrl?: unknown;
  wordpressPreviewUrl?: unknown;
  wordpressStatus?: unknown;
  wordpressDraftAt?: unknown;
  featuredMediaId?: unknown;
  featuredImageUrl?: unknown;
  pendingImageUrl?: unknown;
  featuredImageReviewRequired?: unknown;
  error?: unknown;
};

function redisCredentials() {
  return {
    url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "",
    token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "",
  };
}

export function aronReviewStoreConfigured() {
  const credentials = redisCredentials();
  return Boolean(credentials.url && credentials.token);
}

function reviewRedis() {
  const credentials = redisCredentials();
  if (!credentials.url || !credentials.token) {
    throw new Error("Aron’s shared review storage is not connected.");
  }
  return new Redis({ url: credentials.url, token: credentials.token });
}

function decode(value: unknown): AronReviewItem | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return restoreEpsteinApprovedDocument(JSON.parse(value) as AronReviewItem);
    } catch {
      return null;
    }
  }
  return typeof value === "object" ? restoreEpsteinApprovedDocument(value as AronReviewItem) : null;
}

function stringValue(value: unknown, maximum = 500) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function workflowValue(value: unknown): AronReviewItem["workflow"] {
  return ["create", "enhance", "blog", "aop", "subaop"].includes(String(value))
    ? value as AronReviewItem["workflow"]
    : undefined;
}

function projectRecord(record: TrackerRecord): AronReviewItem | null {
  if (isObsoleteDrazenPage(record)) return null;
  const id = stringValue(record.id, 200);
  const website = stringValue(record.website, 1000);
  const docUrl = stringValue(record.docUrl, 1200);
  const createdAt = stringValue(record.createdAt, 100);
  if (!id || !website || !docUrl || !createdAt) return null;

  return {
    id,
    clientId: stringValue(record.clientId, 200) || undefined,
    clientName: stringValue(record.clientName, 200) || undefined,
    workflow: workflowValue(record.workflow),
    website,
    pageUrl: stringValue(record.pageUrl, 1200) || undefined,
    primaryKeyword: stringValue(record.primaryKeyword, 400) || undefined,
    practiceArea: stringValue(record.practiceArea, 300),
    city: stringValue(record.city, 200),
    state: stringValue(record.state, 100),
    jurisdiction: stringValue(record.jurisdiction, 300) || undefined,
    parentPracticeArea: stringValue(record.parentPracticeArea, 300) || undefined,
    blogPracticeArea: stringValue(record.blogPracticeArea, 300) || undefined,
    authorityAttorney: stringValue(record.authorityAttorney, 120) || undefined,
    parentId: typeof record.parentId === "number" && Number.isInteger(record.parentId) && record.parentId > 0
      ? record.parentId
      : undefined,
    createdAt,
    updatedAt: stringValue(record.updatedAt, 100) || undefined,
    docUrl,
    docName: stringValue(record.docName, 400) || undefined,
    wordCount: typeof record.wordCount === "number" && Number.isFinite(record.wordCount)
      ? record.wordCount
      : undefined,
    status: stringValue(record.status, 100) || "review",
    aronDone: record.aronDone === true,
    approvalStatus: stringValue(record.approvalStatus, 100) || undefined,
    pendingImageReviewId: stringValue(record.pendingImageReviewId, 300) || undefined,
    featuredImageApproved: record.featuredImageApproved === true,
    wordpressPageId: typeof record.wordpressPageId === "number" && Number.isInteger(record.wordpressPageId) && record.wordpressPageId > 0
      ? record.wordpressPageId
      : undefined,
    wordpressUrl: stringValue(record.wordpressUrl, 1200) || undefined,
    wordpressEditUrl: stringValue(record.wordpressEditUrl, 1200) || undefined,
    wordpressPreviewUrl: stringValue(record.wordpressPreviewUrl, 1200) || undefined,
    wordpressStatus: stringValue(record.wordpressStatus, 100) || undefined,
    wordpressDraftAt: stringValue(record.wordpressDraftAt, 100) || undefined,
    wordpressPublishedAt: stringValue(record.wordpressPublishedAt, 100) || undefined,
    featuredMediaId: typeof record.featuredMediaId === "number" && Number.isInteger(record.featuredMediaId) && record.featuredMediaId > 0
      ? record.featuredMediaId
      : undefined,
    featuredImageUrl: stringValue(record.featuredImageUrl, 1200) || undefined,
    pendingImageUrl: stringValue(record.pendingImageUrl, 1200) || undefined,
    featuredImageReviewRequired: record.featuredImageReviewRequired === true,
    preparationRequired: typeof record.preparationRequired === "boolean" ? record.preparationRequired : undefined,
    draftWarnings: Array.isArray(record.draftWarnings) ? record.draftWarnings.filter((value): value is string => typeof value === "string") : undefined,
    error: stringValue(record.error, 2000) || undefined,
  };
}

export function aronReviewerEmails() {
  return [
    process.env.ARON_REVIEWER_EMAIL
      || process.env.CLIENT_REVIEWER_EMAIL
      || "aron@amplifylaw.ai",
    "accounts@amplifylaw.ai",
  ]
    .map((email) => email.trim().toLowerCase())
    .filter((email, index, emails) => Boolean(email) && emails.indexOf(email) === index);
}

export function isAronReviewer(email: string | null) {
  return Boolean(email && aronReviewerEmails().includes(email.trim().toLowerCase()));
}

export async function listAronReviewItems(includeDeleted = false) {
  const redis = reviewRedis();
  // Keep manual queue positions separate from per-account tracker snapshots so
  // a later sync cannot overwrite a pin or alter the document's creation date.
  const [stored, priorities, deleted] = await Promise.all([
    redis.hgetall<Record<string, unknown>>(REVIEW_QUEUE_KEY),
    redis.hgetall<Record<string, number>>(REVIEW_PRIORITY_KEY),
    redis.hgetall<Record<string, string>>(REVIEW_DELETED_KEY),
  ]);
  return Object.values(stored || {})
    .map(decode)
    .filter((item): item is AronReviewItem => Boolean(item))
    .filter((item) => !isObsoleteDrazenPage(item))
    .map(archiveUploadedReviewItem)
    .map((item) => ({ ...item, reviewDeletedAt: deleted?.[item.id], reviewPriority: Number(priorities?.[item.id]) || undefined }))
    .filter((item) => includeDeleted || !item.reviewDeletedAt)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

export async function deleteAronReviewItems(ids: string[]) {
  const redis = reviewRedis();
  const records = await listAronReviewItems();
  const selected = new Set(ids);
  const targets = records.filter(record => selected.has(record.id)).map(record => record.id);
  if (!targets.length) return [];
  // Separate deletion markers survive concurrent uploads and old tracker syncs.
  // Keep approved metadata for duplicate suppression; never touch Drive or WP.
  const now = new Date().toISOString();
  await redis.hset(REVIEW_DELETED_KEY, Object.fromEntries(targets.map(id => [id, now])));
  return targets;
}

export async function pruneObsoleteAronReviewItems() {
  const redis = reviewRedis();
  const stored = await redis.hgetall<Record<string, unknown>>(REVIEW_QUEUE_KEY);
  const obsoleteIds = Object.entries(stored || {})
    .filter(([, value]) => {
      const item = decode(value);
      return Boolean(item && isObsoleteDrazenPage(item));
    })
    .map(([id]) => id);
  if (obsoleteIds.length) await redis.hdel(REVIEW_QUEUE_KEY, ...obsoleteIds);
  return obsoleteIds.length;
}

export async function getAronReviewItem(id:string) {
  const redis = reviewRedis();
  if (await redis.hget(REVIEW_DELETED_KEY, id)) return null;
  const record=decode(await redis.hget(REVIEW_QUEUE_KEY,id));
  return record&&!isObsoleteDrazenPage(record)?record:null;
}

export function archiveUploadedReviewItem(item: AronReviewItem): AronReviewItem {
  const docId = item.docUrl.match(/\/document\/d\/([A-Za-z0-9_-]+)/)?.[1];
  if (!item.reviewArchivedAt && item.reviewArchiveReason !== "preparation-required" && docId && restoredArchiveDocIds.has(docId)) {
    return { ...item, reviewArchivedAt: "2026-09-09T20:40:00.000Z", reviewArchiveReason: "archive-restored" };
  }
  const approved = item.aronDone || item.approvalStatus === "APPROVED";
  if (!approved || !Number.isInteger(item.wordpressPageId) || (item.wordpressPageId || 0) <= 0) return item;
  if (item.wordpressStatus === "publish") {
    return { ...item, reviewArchivedAt: item.reviewArchivedAt || item.updatedAt || new Date().toISOString(),
      reviewArchiveReason: item.reviewArchiveReason === "manual" ? "manual" : "published" };
  }
  // Older intake uploads used the very same timestamp for draft and archive.
  // Restore those automatically archived drafts, but preserve manual archives.
  if (item.wordpressStatus === "draft" && (item.reviewArchiveReason === "wordpress-upload"
    || (!item.reviewArchiveReason && item.wordpressDraftAt && item.reviewArchivedAt === item.wordpressDraftAt))) {
    return { ...item, reviewArchivedAt: undefined, reviewArchiveReason: undefined };
  }
  return item;
}

export function reconcileReviewItem(item:AronReviewItem,current?:AronReviewItem):AronReviewItem {
  item = restoreEpsteinApprovedDocument(item);
  const docId=(url:string)=>url.match(/\/document\/d\/([A-Za-z0-9_-]+)/)?.[1];
  if(!current?.aronDone||!docId(item.docUrl)||docId(item.docUrl)!==docId(current.docUrl))return archiveUploadedReviewItem(item);
  // Accept a newer positive dashboard upload result, but never let an old
  // tracker erase a server upload, switch its target, or demote a live page.
  const incomingResult=Boolean(item.wordpressPageId)
    &&(!current.wordpressPageId||item.wordpressPageId===current.wordpressPageId)
    &&Date.parse(item.updatedAt||item.wordpressDraftAt||"")>Date.parse(current.updatedAt||current.approvedAt||"")
    &&(current.wordpressStatus!=="publish"||item.wordpressStatus==="publish")
    &&(current.wordpressStatus!=="future"||["future","publish"].includes(item.wordpressStatus||""));
  const result=incomingResult?item:current;
  return archiveUploadedReviewItem({...item,aronDone:true,approvalStatus:"APPROVED",approvedAt:current.approvedAt,
    clientId:current.clientId || item.clientId,
    authorityAttorney:current.authorityAttorney ?? item.authorityAttorney,
    status:result.status,wordpressPageId:result.wordpressPageId,wordpressUrl:result.wordpressUrl,
    wordpressEditUrl:result.wordpressEditUrl,wordpressPreviewUrl:result.wordpressPreviewUrl,
    wordpressStatus:result.wordpressStatus,wordpressDraftAt:result.wordpressDraftAt,
    wordpressPublishedAt:current.wordpressPublishedAt || item.wordpressPublishedAt,
    wordpressScheduledAt:current.wordpressScheduledAt,wordpressCheckedAt:current.wordpressCheckedAt,wordpressIntakeOnly:current.wordpressIntakeOnly,
    featuredMediaId:result.featuredMediaId,featuredImageUrl:result.featuredImageUrl,
    pendingImageUrl:result.pendingImageUrl,featuredImageReviewRequired:result.featuredImageReviewRequired,featuredImageApproved:result.featuredImageApproved,
    reviewArchivedAt:current.reviewArchivedAt,reviewArchiveReason:current.reviewArchiveReason,
    finalApprovedAt:current.finalApprovedAt,
    preparationRequired:result.preparationRequired,draftWarnings:result.draftWarnings,
    error:result.error,updatedAt:result.updatedAt||item.updatedAt});
}

export async function syncAronReviewQueue(trackerRecords: TrackerRecord[]) {
  const redis = reviewRedis();
  const existing = await listAronReviewItems(true);
  const existingById = new Map(existing.map((item) => [item.id, item]));
  const projected = trackerRecords
    .map(projectRecord)
    .filter((item): item is AronReviewItem => Boolean(item))
    .filter(item => !existingById.get(item.id)?.reviewDeletedAt)
    .map((item) => reconcileReviewItem(item,existingById.get(item.id)));

  if (projected.length) {
    const entries = Object.fromEntries(
      projected.map((item) => [item.id, JSON.stringify(item)]),
    );
    await redis.hset(REVIEW_QUEUE_KEY, entries);
  }

  // The main tracker is stored in each Google account's private appData folder.
  // An empty tracker from another allowed account must never be interpreted as a
  // request to erase the shared approval queue. Items are removed only through
  // an explicit deletion workflow, not as a side effect of synchronization.
  return projected;
}

export async function mergeAronApprovals(trackerRecords: TrackerRecord[]) {
  const allItems = await listAronReviewItems(true);
  const deleted = new Set(allItems.filter(item => item.reviewDeletedAt).map(item => item.id));
  const activeRecords = trackerRecords.filter(record => !isObsoleteDrazenPage(record) && !deleted.has(stringValue(record.id, 200)));
  const queue = allItems.filter(item => !item.reviewDeletedAt);
  if (!queue.length) return activeRecords;
  const approvedById = new Map(queue.filter((item) => item.aronDone).map((item) => [item.id, item]));
  return activeRecords.map((record) => {
    const id = stringValue(record.id, 200);
    const current = approvedById.get(id);
    const projected=projectRecord(record);
    if (!current||!projected) return record;
    const approved=reconcileReviewItem(projected,current);
    if(!approved.aronDone)return record;
    return {
      ...record,
      docUrl: approved.docUrl,
      authorityAttorney: approved.authorityAttorney,
      aronDone: true,
      approvalStatus: "APPROVED",
      status: approved.status,
      wordpressPageId: approved.wordpressPageId || record.wordpressPageId,
      wordpressUrl: approved.wordpressUrl || record.wordpressUrl,
      wordpressEditUrl: approved.wordpressEditUrl || record.wordpressEditUrl,
      wordpressPreviewUrl: approved.wordpressPreviewUrl || record.wordpressPreviewUrl,
      wordpressStatus: approved.wordpressStatus || record.wordpressStatus,
      wordpressDraftAt: approved.wordpressDraftAt || record.wordpressDraftAt,
      wordpressPublishedAt: approved.wordpressPublishedAt || record.wordpressPublishedAt,
      featuredMediaId: approved.featuredMediaId || record.featuredMediaId,
      featuredImageUrl: approved.featuredImageUrl || record.featuredImageUrl,
      pendingImageUrl: approved.pendingImageUrl || record.pendingImageUrl,
      preparationRequired: approved.preparationRequired,
      draftWarnings: approved.draftWarnings,
      wordpressIntakeOnly: approved.wordpressIntakeOnly,
      approvedAt: approved.approvedAt,
      finalApprovedAt: approved.finalApprovedAt,
      wordpressCheckedAt: approved.wordpressCheckedAt,
      reviewArchivedAt: approved.reviewArchivedAt,
      reviewArchiveReason: approved.reviewArchiveReason,
      featuredImageApproved: approved.featuredImageApproved,
      featuredImageReviewRequired: approved.featuredImageReviewRequired === true,
      error: approved.error,
      updatedAt: approved.updatedAt || approved.approvedAt || new Date().toISOString(),
    };
  });
}

export async function approveAronReviewItem(recordId: string) {
  const redis = reviewRedis();
  const current = decode(await redis.hget(REVIEW_QUEUE_KEY, recordId));
  if (!current) throw new Error("That content item is no longer in Aron’s review queue.");
  if (isObsoleteDrazenPage(current)) throw new Error("That obsolete page is no longer available in Aron’s review queue.");
  if (current.aronDone) return current;
  if (!current.docUrl || current.status !== "review") {
    throw new Error("That content item is not currently waiting for Aron’s approval.");
  }

  const now = new Date().toISOString();
  const approved: AronReviewItem = {
    ...current,
    aronDone: true,
    approvalStatus: "APPROVED",
    status: "ready",
    approvedAt: now,
    updatedAt: now,
  };
  await redis.hset(REVIEW_QUEUE_KEY, { [recordId]: JSON.stringify(approved) });
  return approved;
}

export async function saveAronWordPressDraft(
  recordId: string,
  result: {
    pageId: number;
    pageUrl?: string;
    editUrl?: string;
    previewUrl?: string;
    featuredMediaId?: number;
    featuredImageUrl?: string;
    imageReviewRequired?: boolean;
    status?: string;
    preparationRequired?: boolean;
    warnings?: string[];
  },
) {
  const redis = reviewRedis();
  const current = decode(await redis.hget(REVIEW_QUEUE_KEY, recordId));
  if (current && isObsoleteDrazenPage(current)) throw new Error("That obsolete page is no longer available in Aron’s review queue.");
  if (!current?.aronDone) throw new Error("Approve this content item before saving its WordPress draft.");
  if (!Number.isInteger(result.pageId) || result.pageId <= 0) {
    throw new Error("WordPress did not return a valid draft ID.");
  }
  const now = new Date().toISOString();
  const archive = archiveUploadedReviewItem(current);
  const saved: AronReviewItem = {
    ...current,
    status: result.status === "publish" ? "published" : "ready",
    wordpressPageId: result.pageId,
    wordpressUrl: stringValue(result.pageUrl, 1200) || undefined,
    wordpressEditUrl: stringValue(result.editUrl, 1200) || undefined,
    wordpressPreviewUrl: stringValue(result.previewUrl, 1200) || undefined,
    wordpressStatus: result.status || "draft",
    wordpressDraftAt: now,
    reviewArchivedAt: result.status === "publish" ? current.reviewArchivedAt || now
      : archive.reviewArchivedAt,
    reviewArchiveReason: current.reviewArchiveReason === "manual" ? "manual"
      : result.status === "publish" ? "published" : archive.reviewArchiveReason,
    featuredMediaId: Number.isInteger(result.featuredMediaId) && Number(result.featuredMediaId) > 0
      ? Number(result.featuredMediaId)
      : undefined,
    featuredImageUrl: stringValue(result.featuredImageUrl, 1200) || undefined,
    pendingImageUrl: stringValue(result.featuredImageUrl, 1200) || current.pendingImageUrl,
    featuredImageReviewRequired: result.imageReviewRequired === true,
    featuredImageApproved: result.imageReviewRequired !== true,
    error: undefined,
    preparationRequired: result.preparationRequired ?? current.preparationRequired ?? true,
    wordpressIntakeOnly: result.preparationRequired === false ? false : current.wordpressIntakeOnly,
    draftWarnings: result.warnings?.map(value => stringValue(value, 6000)).filter(Boolean) ?? current.draftWarnings,
    updatedAt: now,
  };
  await redis.hset(REVIEW_QUEUE_KEY, { [recordId]: JSON.stringify(saved) });
  return saved;
}

export async function saveAronWordPressError(recordId: string, message: string) {
  const redis = reviewRedis();
  const current = decode(await redis.hget(REVIEW_QUEUE_KEY, recordId));
  if (current && isObsoleteDrazenPage(current)) throw new Error("That obsolete page is no longer available in Aron’s review queue.");
  if (!current?.aronDone) throw new Error("Approve this content item before recording a WordPress error.");
  const saved: AronReviewItem = {
    ...current,
    status: "error",
    error: stringValue(message, 2000) || "The WordPress draft could not be created.",
    preparationRequired: true,
    ...(/image.*(?:reject|safety)|safety.*image/i.test(message) ? {featuredImageApproved:false,featuredImageReviewRequired:true} : {}),
    updatedAt: new Date().toISOString(),
  };
  await redis.hset(REVIEW_QUEUE_KEY, { [recordId]: JSON.stringify(saved) });
  return saved;
}

// Save only a verified lifecycle transition; never overwrite preparation data.
export async function saveAronWordPressStatus(id: string, pageId: number, status: string, pageUrl?: string, dateGmt?: string, content?: string) {
  const redis = reviewRedis();
  const current = decode(await redis.hget(REVIEW_QUEUE_KEY, id));
  if (!current || current.wordpressPageId !== pageId || !["publish", "future", "draft", "pending", "private", "trash"].includes(status)) return;
  const now = new Date().toISOString();
  const terminal = status === "publish" || status === "trash";
  const manual = current.reviewArchiveReason === "manual";
  await redis.hset(REVIEW_QUEUE_KEY, { [id]: JSON.stringify({ ...current,
    wordpressStatus: status,
    status: status === "publish" ? "published" : status === "future" ? "scheduled" : "ready",
    wordpressUrl: pageUrl || current.wordpressUrl,
    wordpressPublishedAt: status === "publish" && dateGmt ? `${dateGmt.replace(/Z$/, "")}Z` : current.wordpressPublishedAt,
    wordpressScheduledAt: status === "future" && dateGmt ? `${dateGmt.replace(/Z$/, "")}Z` : undefined,
    wordpressCheckedAt: now,
    wordpressIntakeOnly: typeof content === "string" ? content.includes("amplify-approval-intake:") : undefined,
    reviewArchivedAt: terminal ? current.reviewArchivedAt || now : current.reviewArchivedAt,
    reviewArchiveReason: manual ? "manual" : status === "publish" ? "published" : status === "trash" ? "wordpress-trash" : current.reviewArchiveReason,
    updatedAt: current.wordpressStatus === status ? current.updatedAt : now,
  }) });
}

// Explicit recovery keeps an incomplete draft visible despite historical archive restoration.
export async function saveFinalPublication(docId: string, clientId: string, result: {pageId:number;pageUrl?:string;status:string}, recordId?:string) {
  if (!["publish", "future"].includes(result.status)) return;
  for (const item of await listAronReviewItems()) {
    if ((item.clientId !== clientId && item.id !== recordId) || item.docUrl.match(/\/document\/d\/([A-Za-z0-9_-]+)/)?.[1] !== docId || !item.aronDone) continue;
    const saved = await saveAronWordPressDraft(item.id, {...result, preparationRequired:false, warnings:[]});
    await reviewRedis().hset(REVIEW_QUEUE_KEY, {[item.id]:JSON.stringify({...saved, clientId, finalApprovedAt:new Date().toISOString()})});
  }
}

export async function returnAronDraftToPreparation(id: string, pageId: number, warnings: string[]) {
  const redis = reviewRedis();
  const current = decode(await redis.hget(REVIEW_QUEUE_KEY, id));
  if (!current || current.wordpressPageId !== pageId || current.wordpressStatus !== "draft") throw new Error("Verify the WordPress draft before returning it to preparation.");
  const saved: AronReviewItem = { ...current, status: "ready", preparationRequired: true,
    draftWarnings: warnings, reviewArchivedAt: undefined, reviewArchiveReason: "preparation-required",
    updatedAt: new Date().toISOString() };
  await redis.hset(REVIEW_QUEUE_KEY, { [id]: JSON.stringify(saved) });
  return saved;
}

// Owner requested clearing the existing Fulginiti queue on September 10.
// Preserve actual WordPress status; archiving is not publication or approval.
export async function archiveHistoricalFulginitiQueue() {
  let archived = 0;
  for (const item of await listAronReviewItems()) {
    let host = "";
    try { host = new URL(item.website || item.pageUrl || "").hostname.replace(/^www\./, ""); } catch { continue; }
    if (host !== "fulginiti-law.com" || item.reviewArchivedAt || !(Date.parse(item.createdAt) < Date.parse("2026-09-10T18:30:00-04:00"))) continue;
    const now = new Date().toISOString();
    await reviewRedis().hset(REVIEW_QUEUE_KEY, { [item.id]: JSON.stringify({ ...item, reviewArchivedAt: now, reviewArchiveReason: "manual", updatedAt: now }) });
    archived++;
  }
  return archived;
}
