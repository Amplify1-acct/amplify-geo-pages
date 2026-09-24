"use client";

import { reconcileTrackerSnapshot } from "@/lib/tracker-sync";

import { contentWorkflow, finalApprovalReady, isPublishedContent } from "@/lib/content-workflow";
import { WorkflowChecklist } from "@/components/workflow-checklist";
import { wordPressPreviewUrl } from "@/lib/wordpress-preview";

import {
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock3,
  FileCheck2,
  FileText,
  FileUp,
  Globe2,
  ImageIcon,
  LoaderCircle,
  LogOut,
  MessageSquareText,
  Newspaper,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRoundCheck,
  X,
} from "lucide-react";
import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { formatLocation, stateAbbreviation } from "@/lib/location";
import { blogPublicationPlan } from "@/lib/blog-publication";
import { BILLY_CTA_VERSION } from "@/lib/cta";
import {
  BILLY_GEO_CHILD_PARENTS,
  BILLY_GEO_CHILD_SERVICE_TEMPLATES,
  billyGeoChildCampaignItems,
} from "@/lib/billy-geo-child-campaign";

type PageRecord = {
  id: string;
  clientId?: string;
  clientName?: string;
  workflow?: "create" | "enhance" | "blog" | "aop" | "subaop";
  website: string;
  pageUrl?: string;
  primaryKeyword?: string;
  jurisdiction?: string;
  parentPracticeArea?: string;
  blogPracticeArea?: string;
  authorityAttorney?: string;
  relatedQuestions?: string[];
  practiceArea: string;
  city: string;
  state: string;
  notes?: string;
  status: "queued" | "generating" | "review" | "ready" | "published" | "error";
  createdAt: string;
  docId?: string;
  docUrl?: string;
  docName?: string;
  wordCount?: number;
  jobId?: string;
  aronDone: boolean;
  approvalEnabled?: boolean;
  approvalId?: string;
  approvalStatus?: string;
  published: boolean;
  updatedAt?: string;
  error?: string;
  bulkBatchId?: string;
  bulkPosition?: number;
  campaignKind?: "billy-geo-child";
  campaignCounty?: string;
  parentId?: number;
  parentPageTitle?: string;
  parentPageUrl?: string;
  wordpressPageId?: number;
  wordpressUrl?: string;
  wordpressEditUrl?: string;
  wordpressPreviewUrl?: string;
  wordpressStatus?: string;
  wordpressDraftAt?: string;
  ownerApprovedAt?: string;
  featuredMediaId?: number;
  featuredImageUrl?: string;
  featuredImageReviewRequired?: boolean;
  featuredImageApproved?: boolean;
  pendingImageReviewId?: string;
  pendingImageUrl?: string;
  wordpressBackupId?: string;
  wordpressPublishedAt?: string;
  editorialSlotId?: string;
  scheduledPublishAt?: string;
  reviewFeedback?: string;
  revisionNumber?: number;
};

type GoogleStatus = {
  loading: boolean;
  configured: boolean;
  openaiConfigured: boolean;
  connected: boolean;
  email?: string | null;
};

type WordPressStatus = {
  loading: boolean;
  configured: boolean;
  connected?: boolean;
  bridgeConnected?: boolean;
  clientId?: string | null;
  siteUrl?: string | null;
  message?: string;
};

type PagePreview = {
  open: boolean;
  loading: boolean;
  title: string;
  html: string;
  recordId?: string;
  error?: string;
};

type ReviewFeedbackDialog = {
  recordId: string;
  feedback: string;
  submitting: boolean;
  error?: string;
};

type ClientSummary = {
  id: string;
  name: string;
  website: string;
  reviewerEmail: string;
  phoneDisplay: string;
  phoneHref: string;
  locale?: "en" | "es";
  jurisdictions?: string[];
  contactUrl?: string;
  practiceAreaUrls?: Record<string, string>;
  practiceAreas?: string[];
  lawyers?: Array<{ name: string; imageUrl: string }>;
  blogDefaults?: { authorId?: number; categoryId?: number; defaultJurisdiction?: string };
  cta?: { consultationText?: string; linkLabel?: string };
  brand?: {
    primary: string;
    secondary: string;
    accent: string;
    surface: string;
    logoUrl?: string;
  };
  wordpressReady: boolean;
  assetsReady: boolean;
};

type DraftInput = {
  clientId: string;
  website: string;
  practiceArea: string;
  city: string;
  state: string;
  notes: string;
};

type EnhanceInput = {
  clientId: string;
  pageUrl: string;
  notes: string;
};

type BlogInput = {
  authorityAttorney: string;
  clientId: string;
  website: string;
  practiceArea: string;
  topic: string;
  primaryKeyword: string;
  jurisdiction: string;
  notes: string;
  editorialSlotId: string;
  scheduledPublishAt: string;
};

type AopInput = {
  clientId: string;
  website: string;
  practiceArea: string;
  primaryKeyword: string;
  jurisdiction: string;
  notes: string;
};

type SubAopInput = {
  clientId: string;
  website: string;
  parentPracticeArea: string;
  practiceArea: string;
  primaryKeyword: string;
  jurisdiction: string;
  notes: string;
};

type BlogTopicQuestion = {
  question: string;
  practiceArea?: string;
  cluster: string;
  sourceTerm: string;
  depth: number;
  answerExcerpt?: string;
  answerUrl?: string;
};

type Workflow = "create" | "enhance" | "blog" | "aop" | "subaop";
type ContentFilter = "all" | "geo" | "enhance" | "blog" | "aop" | "subaop";
type TrackerStatusFilter = "all" | "pending" | "with-aron" | "ready" | "wordpress-draft" | "scheduled" | "live" | "attention";

type BulkImport = {
  fileName: string;
  urls: string[];
  totalFound: number;
};

const STORAGE_KEY = "amplify-geo-pages-v1";
const FORM_KEY = "amplify-geo-form-v1";
const ENHANCE_FORM_KEY = "amplify-enhance-form-v1";
const BLOG_FORM_KEY = "amplify-blog-form-v1";
const AOP_FORM_KEY = "amplify-aop-form-v1";
const SUB_AOP_FORM_KEY = "amplify-sub-aop-form-v1";
const STALLED_RESET_KEY = "amplify-stalled-reset-2026-08-18-v1";
const STALLED_RESET_CUTOFF = Date.parse("2026-08-18T10:15:00-04:00");
const GENERATION_TIMEOUT_MS = 30 * 60_000;
const GENERATION_JOB_ID_GRACE_MS = 2 * 60_000;
const GENERATION_TIMEOUT_ERROR =
  "Research did not finish within 30 minutes. Select Try again to start a fresh job.";
const GENERATION_START_ERROR =
  "Research could not start because no job was created. Select Try again to start a fresh job.";
const BULK_ENHANCE_LIMIT = 50;
const BILLY_GEO_CHILD_CAMPAIGN = billyGeoChildCampaignItems();
const BILLY_GEO_CHILD_MISSING_COUNT = BILLY_GEO_CHILD_CAMPAIGN.filter((item) => !item.existingPageId).length;
const CONTENT_FILTER_OPTIONS: Array<{ value: ContentFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "geo", label: "GEO" },
  { value: "enhance", label: "Enhancements" },
  { value: "blog", label: "Blogs" },
  { value: "aop", label: "AOPs" },
  { value: "subaop", label: "Sub-AOPs" },
];
const emptyForm: DraftInput = {
  clientId: "",
  website: "",
  practiceArea: "",
  city: "",
  state: "",
  notes: "",
};
const emptyEnhanceForm: EnhanceInput = {
  clientId: "",
  pageUrl: "",
  notes: "",
};
const emptyBlogForm: BlogInput = {
  authorityAttorney: "",
  clientId: "",
  website: "",
  practiceArea: "",
  topic: "",
  primaryKeyword: "",
  jurisdiction: "",
  notes: "",
  editorialSlotId: "",
  scheduledPublishAt: "",
};
const emptyAopForm: AopInput = {
  clientId: "",
  website: "",
  practiceArea: "",
  primaryKeyword: "",
  jurisdiction: "",
  notes: "",
};
const emptySubAopForm: SubAopInput = {
  clientId: "",
  website: "",
  parentPracticeArea: "",
  practiceArea: "",
  primaryKeyword: "",
  jurisdiction: "",
  notes: "",
};
const emptyBulkImport: BulkImport = {
  fileName: "",
  urls: [],
  totalFound: 0,
};
const emptyPagePreview: PagePreview = {
  open: false,
  loading: false,
  title: "Page preview",
  html: "",
};

function parseBulkUrls(content: string) {
  const matches = content.match(/https?:\/\/[^\s,"'<>]+/gi) || [];
  const seen = new Set<string>();
  const urls: string[] = [];

  for (const match of matches) {
    try {
      const cleaned = match.replace(/[)\]}.;]+$/g, "");
      const url = new URL(cleaned);
      if (url.protocol !== "http:" && url.protocol !== "https:") continue;
      url.hash = "";
      const normalized = url.toString();
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      urls.push(normalized);
    } catch {
      // Ignore labels, headers, and malformed cells in CSV or TXT files.
    }
  }

  return urls;
}

function formatDate(value: string) {
  const date = new Date(value);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay
    ? `Today, ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
    : date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function compareTrackerOrder(left: PageRecord, right: PageRecord) {
  const leftCreated = Date.parse(left.createdAt);
  const rightCreated = Date.parse(right.createdAt);
  const createdDifference = (Number.isFinite(rightCreated) ? rightCreated : 0)
    - (Number.isFinite(leftCreated) ? leftCreated : 0);
  if (createdDifference) return createdDifference;

  if (left.bulkBatchId && left.bulkBatchId === right.bulkBatchId) {
    const positionDifference = (left.bulkPosition ?? Number.MAX_SAFE_INTEGER)
      - (right.bulkPosition ?? Number.MAX_SAFE_INTEGER);
    if (positionDifference) return positionDifference;
  }

  return left.id.localeCompare(right.id);
}

function isFuturePublishingDate(value: string | undefined, bufferMs = 0) {
  if (!value) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp > Date.now() + bufferMs;
}

function dateTimeLocalValue(value: string | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function statusLabel(record: PageRecord) { return contentWorkflow(record).label; }

function isEnhancement(record: PageRecord) {
  return record.workflow === "enhance";
}

function isBlog(record: PageRecord) {
  return record.workflow === "blog";
}

function isAop(record: PageRecord) {
  return record.workflow === "aop";
}

function isSubAop(record: PageRecord) {
  return record.workflow === "subaop";
}

function contentFilterKey(record: PageRecord): Exclude<ContentFilter, "all"> {
  if (isEnhancement(record)) return "enhance";
  if (isBlog(record)) return "blog";
  if (isAop(record)) return "aop";
  if (isSubAop(record)) return "subaop";
  return "geo";
}

function matchesTrackerStatus(record: PageRecord, filter: TrackerStatusFilter) {
  if (filter === "all") return true;
  if (filter === "attention") return record.status === "error";
  if (filter === "live") return record.published || record.wordpressStatus === "publish";
  if (filter === "scheduled") return record.wordpressStatus === "future";
  if (filter === "wordpress-draft") return record.wordpressStatus === "draft" || Boolean(record.wordpressDraftAt);
  if (filter === "with-aron") return record.status === "review" && !record.aronDone;
  if (filter === "ready") {
    return record.aronDone
      && !record.wordpressPageId
      && !record.published
      && record.wordpressStatus !== "future"
      && record.status !== "error";
  }
  return !record.published
    && record.wordpressStatus !== "publish"
    && record.wordpressStatus !== "future"
    && record.wordpressStatus !== "draft"
    && !record.wordpressDraftAt
    && record.status !== "error";
}

function requiresPreWordPressImageApproval(_record: PageRecord) {
  // Aron approval now triggers the complete WordPress review draft. Images are
  // generated and safety-checked in that build, so there is no separate gate.
  return false;
}

function recordTitle(record: PageRecord) {
  if (isEnhancement(record)) return enhancementTitle(record);
  if (isBlog(record)) return record.practiceArea || "Blog article";
  if (isAop(record)) return record.practiceArea || "Area of Practice page";
  if (isSubAop(record)) return record.practiceArea || "Sub-AOP page";
  return `${formatLocation(record.city, record.state)} · ${record.practiceArea}`;
}

function isStalledRecord(record: PageRecord) {
  if (record.docUrl) return false;
  return record.status === "error" || record.status === "queued" || record.status === "generating";
}

function generationStartedAt(record: PageRecord) {
  const updatedAt = Date.parse(record.updatedAt || "");
  if (Number.isFinite(updatedAt)) return updatedAt;
  const createdAt = Date.parse(record.createdAt);
  return Number.isFinite(createdAt) ? createdAt : Date.now();
}

function generationHasExpired(record: PageRecord, now = Date.now()) {
  return record.status === "generating"
    && !record.docUrl
    && now - generationStartedAt(record) >= GENERATION_TIMEOUT_MS;
}

function generationNeverStarted(record: PageRecord, now = Date.now()) {
  return record.status === "generating"
    && !record.docUrl
    && !record.jobId
    && now - generationStartedAt(record) >= GENERATION_JOB_ID_GRACE_MS;
}

function isInitialResetTarget(record: PageRecord) {
  return isStalledRecord(record) && new Date(record.createdAt).getTime() <= STALLED_RESET_CUTOFF;
}

function recordHost(record: PageRecord) {
  try {
    return new URL(record.pageUrl || record.website).hostname.replace(/^www\./, "");
  } catch {
    return record.pageUrl || record.website;
  }
}

function hasConfiguredWordPressClient(record: PageRecord, clients: ClientSummary[]) {
  const host = recordHost(record).toLowerCase();
  return clients.some((client) => {
    try {
      return client.wordpressReady && new URL(client.website).hostname.replace(/^www\./, "").toLowerCase() === host;
    } catch {
      return false;
    }
  });
}

function enhancementTitle(record: PageRecord) {
  try {
    const url = new URL(record.pageUrl || record.website);
    const page = decodeURIComponent(url.pathname)
      .split("/")
      .filter(Boolean)
      .at(-1)
      ?.replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
    return page || url.hostname.replace(/^www\./, "");
  } catch {
    return "Existing page";
  }
}

function googleDocId(record: PageRecord) {
  if (record.docId) return record.docId;
  return record.docUrl?.match(/\/document\/d\/([A-Za-z0-9_-]+)/)?.[1] || null;
}

function previewEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function previewUrl(value: string | undefined, fallback: string) {
  try {
    const url = new URL(value || fallback);
    return url.protocol === "https:" ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}

function injectPreviewCtas(
  html: string,
  record: PageRecord,
  client: ClientSummary,
) {
  if (isEnhancement(record) || isBlog(record) || typeof window === "undefined") return html;
  const location = formatLocation(record.city, record.state);
  const ctaHeight = client.id === "billy-cooper-law" ? 800 : 420;
  const slots = ["opening", "middle", "closing"] as const;
  const ctas = slots.map((slot) => {
    const query = new URLSearchParams({
      clientId: client.id,
      clientName: client.name,
      website: client.website,
      phoneDisplay: client.phoneDisplay,
      phoneHref: client.phoneHref,
      primary: client.brand?.primary || "#151515",
      secondary: client.brand?.secondary || "#353535",
      accent: client.brand?.accent || "#d2b052",
      surface: client.brand?.surface || "#f7f7f7",
      location,
      practiceArea: record.practiceArea,
      slot,
    });
    if (client.brand?.logoUrl) query.set("logoUrl", client.brand.logoUrl);
    if (client.lawyers?.[0]) {
      query.set("lawyerName", client.lawyers[0].name);
      query.set("lawyerImageUrl", client.lawyers[0].imageUrl);
    }
    if (client.cta?.consultationText) query.set("consultationText", client.cta.consultationText);
    if (client.cta?.linkLabel) query.set("linkLabel", client.cta.linkLabel);
    if (client.id === "billy-cooper-law") query.set("v", BILLY_CTA_VERSION);
    const src = `${window.location.origin}/api/cta?${query}`;
    const alt = `${client.name} ${record.practiceArea} help in ${location}. Call ${client.phoneDisplay}.`;
    const loading = slot === "opening" ? "eager" : "lazy";
    const fetchPriority = slot === "opening" ? "high" : "low";
    return `<figure class="amplify-preview-cta"><img src="${previewEscape(src)}" alt="${previewEscape(alt)}" width="1200" height="${ctaHeight}" loading="${loading}" fetchpriority="${fetchPriority}" decoding="async"></figure>`;
  });
  const closings = [...html.matchAll(/<\/(p|ul|ol|blockquote)>/gi)];
  const paragraphs = [...html.matchAll(/<\/p>/gi)];
  if (!closings.length) return `${ctas[0]}${html}${ctas[2]}`;
  const opening = paragraphs[Math.min(1, paragraphs.length - 1)];
  const positions = [
    opening ? (opening.index || 0) + opening[0].length : (closings[0].index || 0) + closings[0][0].length,
    (closings[Math.floor(closings.length / 2)].index || 0) + closings[Math.floor(closings.length / 2)][0].length,
    html.length,
  ];
  let result = html;
  positions
    .map((position, index) => ({ position, content: ctas[index] }))
    .sort((a, b) => b.position - a.position)
    .forEach(({ position, content }) => {
      result = `${result.slice(0, position)}${content}${result.slice(position)}`;
    });
  return result;
}

function previewDocument(
  title: string,
  html: string,
  record?: PageRecord,
  client?: ClientSummary,
) {
  const safeTitle = previewEscape(title);
  const siteUrl = previewUrl(client?.website || record?.website, "https://example.com/");
  const clientName = previewEscape(client?.name || (record ? recordHost(record) : "Website"));
  const phoneDisplay = previewEscape(client?.phoneDisplay || "Contact the firm");
  const phoneHref = previewEscape(client?.phoneHref ? `tel:${client.phoneHref}` : siteUrl);
  const primary = client?.brand?.primary || "#17312d";
  const secondary = client?.brand?.secondary || "#244e45";
  const accent = client?.brand?.accent || "#d5f443";
  const surface = client?.brand?.surface || "#f2f6f3";
  const logoUrl = previewUrl(client?.brand?.logoUrl, "");
  const articleContent = record && client && !isBlog(record)
    ? injectPreviewCtas(html.replace(/<h1\b[^>]*>[\s\S]*?<\/h1>/i, ""), record, client)
    : html.replace(/<h1\b[^>]*>[\s\S]*?<\/h1>/i, "");
  const isFulginiti = (() => {
    try {
      return new URL(siteUrl).hostname.replace(/^www\./, "") === "fulginiti-law.com";
    } catch {
      return false;
    }
  })();
  const location = record && !isEnhancement(record) && !isBlog(record) && !isAop(record) && !isSubAop(record)
    ? formatLocation(record.city, record.state)
    : "";
  const appOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const featureUrl = record && client && !isEnhancement(record) && !isBlog(record) && !isAop(record) && !isSubAop(record) && appOrigin
    ? `${appOrigin}/api/featured-image?${new URLSearchParams({
        clientId: client.id,
        clientName: client.name,
        website: client.website,
        phoneDisplay: client.phoneDisplay,
        phoneHref: client.phoneHref,
        primary: client.brand?.primary || "#17312d",
        secondary: client.brand?.secondary || "#244e45",
        accent: client.brand?.accent || "#d5f443",
        surface: client.brand?.surface || "#f2f6f3",
        location,
        practiceArea: record.practiceArea,
      })}`
    : "";

  if (isFulginiti) {
    const headerLogo = logoUrl || "https://www.fulginiti-law.com/wp-content/uploads/2025/07/small-logo.svg";
    return `<!doctype html>
<html lang="en-US">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <base href="${previewEscape(siteUrl)}">
  <title>${safeTitle}</title>
  <link rel="stylesheet" href="https://www.fulginiti-law.com/wp-content/themes/fulginiti-new/dist/styles/ext.css">
  <link rel="stylesheet" href="https://www.fulginiti-law.com/wp-content/themes/fulginiti-new/dist/styles/main.css?ver=1.32">
  <style>
    *{box-sizing:border-box}.amplify-site-header{min-height:104px;padding:22px 4vw;display:flex;align-items:center;justify-content:space-between;gap:28px;background:#fff;border-bottom:1px solid #e5e5e5;position:relative;z-index:5}.amplify-site-header img{width:180px;max-height:55px;object-fit:contain;object-position:left center}.amplify-site-nav{display:flex;align-items:center;justify-content:flex-end;gap:26px;flex-wrap:wrap}.amplify-site-nav a{color:#000;text-decoration:none;font-size:14px;font-weight:500}.amplify-site-nav .contact{padding:13px 18px;background:#000;color:#fff}.amplify-site-nav .phone{font-weight:700}.default-hero.amplify-hero{min-height:430px;position:relative;background:#111;overflow:hidden}.amplify-hero .default-hero__image{position:absolute;inset:0;background-image:linear-gradient(90deg,rgba(0,0,0,.68),rgba(0,0,0,.08)),url('${previewEscape(featureUrl)}');background-size:cover;background-position:center}.amplify-hero .grid-container-fluid{position:relative;z-index:2;min-height:430px;display:flex;align-items:flex-end}.amplify-hero .default-hero__title-wrap{max-width:950px;padding:60px 6vw}.amplify-hero .default-hero__title{color:#fff;font-size:clamp(40px,6vw,78px);line-height:.98;letter-spacing:-.035em}.main-content{padding-top:82px}.default-content{font-size:18px;line-height:1.72}.default-content h2{font-size:clamp(29px,3vw,43px);line-height:1.05;margin-top:48px}.default-content h3{font-size:26px;margin-top:34px}.default-content p,.default-content li{font-size:18px;line-height:1.72}.amplify-preview-cta{margin:40px 0}.amplify-preview-cta img{display:block;width:100%;height:auto}.amplify-preview-sidebar{position:sticky;top:24px;padding:34px;background:#f1eee8}.amplify-preview-sidebar h4{font-size:24px;margin:0 0 18px}.amplify-preview-sidebar ul{list-style:none;margin:0;padding:0}.amplify-preview-sidebar li{padding:11px 0;border-bottom:1px solid rgba(0,0,0,.15)}.amplify-preview-sidebar .button{display:block;margin-top:24px;padding:16px;background:#000;color:#fff;text-align:center;text-decoration:none}.amplify-site-footer{margin-top:80px;padding:68px 6vw 30px;background:#0b0b0b;color:#fff}.amplify-site-footer img{width:220px;max-height:70px;object-fit:contain;object-position:left center;filter:none}.amplify-site-footer-grid{display:grid;grid-template-columns:1.3fr 1fr 1fr;gap:45px}.amplify-site-footer a{color:#fff}.amplify-site-footer small{display:block;margin-top:50px;padding-top:22px;border-top:1px solid rgba(255,255,255,.2);color:#bbb}@media(max-width:900px){.amplify-site-header{min-height:78px}.amplify-site-nav a:not(.phone):not(.contact){display:none}.default-hero.amplify-hero,.amplify-hero .grid-container-fluid{min-height:330px}.main-content{padding-top:50px}.main-content .grid-x{display:block}.main-content .cell{width:100%;margin-left:0}.sidebar{margin-top:40px}.amplify-site-footer-grid{grid-template-columns:1fr}.amplify-site-footer-grid>div:not(:first-child){display:none}}@media(max-width:600px){.amplify-site-header img{width:130px}.amplify-site-nav .phone{display:none}.amplify-hero .default-hero__title-wrap{padding:40px 24px}.default-content p,.default-content li{font-size:16px}}
  </style>
</head>
<body class="page-template-default wp-theme-fulginiti-new">
  <header class="amplify-site-header">
    <a href="${previewEscape(siteUrl)}"><img src="${previewEscape(headerLogo)}" alt="${clientName}"></a>
    <nav class="amplify-site-nav" aria-label="Website navigation">
      <a href="${previewEscape(siteUrl)}about/">About Us</a><a href="${previewEscape(siteUrl)}areas-of-practice/">Areas of Practice</a><a href="${previewEscape(siteUrl)}case-results/">Case Results</a><a href="${previewEscape(siteUrl)}testimonials/">Testimonials</a><a class="phone" href="${phoneHref}">${phoneDisplay}</a><a class="contact" href="${previewEscape(siteUrl)}contact/">Contact Us</a>
    </nav>
  </header>
  <section class="default-hero amplify-hero"><div class="default-hero__image"></div><div class="grid-container-fluid"><div class="grid-x"><div class="cell large-12"><div class="default-hero__title-wrap"><h1 class="default-hero__title">${safeTitle}</h1></div></div></div></div></section>
  <main class="main-content"><div class="grid-container-fluid"><div class="grid-x"><div class="large-6 medium-12 small-12 large-offset-1 cell columns"><div class="default-content">${articleContent}</div></div><aside class="large-3 medium-12 small-12 large-offset-2 cell columns sidebar"><div class="amplify-preview-sidebar"><h4>Areas of Practice</h4><ul><li>Catastrophic Injury</li><li>Construction Accident</li><li>Medical Malpractice</li><li>Personal Injury</li><li>Premises Liability</li><li>Product Liability</li><li>Motor Vehicle Accidents</li></ul><a class="button" href="${phoneHref}">Call ${phoneDisplay}</a></div></aside></div></div></main>
  <footer class="amplify-site-footer"><div class="amplify-site-footer-grid"><div><img src="https://www.fulginiti-law.com/wp-content/uploads/2024/04/footer-logo.svg" alt="Fulginiti Law"><p>One Commerce Square<br>2005 Market Street, Suite 3710<br>Philadelphia, PA 19103</p></div><div><strong>Explore</strong><p><a href="${previewEscape(siteUrl)}about/">About</a><br><a href="${previewEscape(siteUrl)}areas-of-practice/">Areas of Practice</a><br><a href="${previewEscape(siteUrl)}case-results/">Case Results</a></p></div><div><a class="button" href="${phoneHref}">${phoneDisplay}</a><p><a href="${previewEscape(siteUrl)}contact/">Contact Us</a></p></div></div><small>Fulginiti Law. A commitment to justice. A commitment to you.</small></footer>
</body>
</html>`;
  }

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <base href="${previewEscape(siteUrl)}">
  <title>${safeTitle}</title>
  <style>
    :root{color-scheme:light;--primary:${primary};--secondary:${secondary};--accent:${accent};--surface:${surface}}*{box-sizing:border-box}body{margin:0;background:#fff;color:#192a28;font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:1.7}.site-header{min-height:88px;padding:18px max(28px,5vw);display:flex;align-items:center;justify-content:space-between;gap:30px;border-bottom:1px solid #e1e5e2;background:#fff}.site-brand{display:flex;align-items:center;gap:14px;color:var(--primary);font-weight:800;font-size:20px}.site-brand img{max-width:210px;max-height:54px}.site-nav{display:flex;align-items:center;gap:23px}.site-nav a{color:#253b37;text-decoration:none;font-size:13px;font-weight:700}.site-nav .contact{padding:12px 17px;background:var(--primary);color:#fff;border-radius:4px}.site-hero{min-height:440px;padding:70px max(28px,7vw);display:flex;align-items:flex-end;position:relative;overflow:hidden;background:linear-gradient(120deg,rgba(0,0,0,.64),rgba(0,0,0,.12)),url('${previewEscape(featureUrl)}') center/cover,var(--primary);color:#fff}.site-hero:after{content:"";position:absolute;inset:0;background:linear-gradient(135deg,transparent 55%,var(--accent) 180%)}.site-hero>div{position:relative;z-index:1;max-width:1000px}.site-hero small{text-transform:uppercase;letter-spacing:.16em;color:var(--accent);font-weight:800}.site-hero h1{margin:18px 0 0;color:#fff;font-family:Georgia,'Times New Roman',serif;font-size:clamp(44px,7vw,82px);line-height:1.02;letter-spacing:-.04em}.site-content{width:min(1180px,calc(100% - 48px));margin:0 auto;padding:78px 0 110px;display:grid;grid-template-columns:minmax(0,1fr) 310px;gap:80px}.site-content article h2,.site-content article h3{color:var(--primary);font-family:Georgia,'Times New Roman',serif;line-height:1.12;letter-spacing:-.025em}.site-content article h2{margin:54px 0 18px;font-size:clamp(30px,4vw,45px)}.site-content article h3{margin:38px 0 14px;font-size:28px}.site-content article p{margin:0 0 22px}.site-content article ul,.site-content article ol{margin:0 0 28px;padding-left:30px}.site-content article li{margin:7px 0}.site-content article a{color:var(--secondary)}.site-content article blockquote{margin:34px 0;padding:4px 0 4px 24px;border-left:4px solid var(--accent);color:#465955}.site-content article table{width:100%;border-collapse:collapse;margin:30px 0}.site-content article th,.site-content article td{padding:12px;border:1px solid #dfe4df;text-align:left}.amplify-preview-cta{margin:40px 0}.amplify-preview-cta img{display:block;width:100%;height:auto}.contact-card{position:sticky;top:24px;padding:30px;background:var(--surface);border-top:5px solid var(--accent)}.contact-card h2{margin:0 0 12px;color:var(--primary);font-family:Georgia,'Times New Roman',serif;font-size:29px;line-height:1.1}.contact-card p{font-size:15px;line-height:1.55}.contact-card a{display:block;margin-top:22px;padding:14px;background:var(--primary);color:#fff;text-align:center;text-decoration:none;font-weight:800}.site-footer{padding:55px max(28px,6vw);display:flex;align-items:center;justify-content:space-between;gap:35px;background:var(--primary);color:#fff}.site-footer strong{font-size:22px}.site-footer a{color:#fff}.site-footer p{margin:7px 0 0;color:rgba(255,255,255,.72);font-size:13px}@media(max-width:850px){.site-nav a:not(.phone):not(.contact){display:none}.site-content{grid-template-columns:1fr;gap:40px}.contact-card{position:static}.site-footer{align-items:flex-start;flex-direction:column}}@media(max-width:600px){body{font-size:16px}.site-header{min-height:70px;padding:12px 18px}.site-brand img{max-width:145px}.site-nav .phone{display:none}.site-hero{min-height:330px;padding:45px 22px}.site-content{width:min(100% - 30px,1180px);padding-top:45px}.site-hero h1{font-size:40px}}
  </style>
</head>
<body><header class="site-header"><a class="site-brand" href="${previewEscape(siteUrl)}">${logoUrl ? `<img src="${previewEscape(logoUrl)}" alt="${clientName}">` : clientName}</a><nav class="site-nav"><a href="${previewEscape(siteUrl)}">About</a><a href="${previewEscape(siteUrl)}">Services</a><a href="${previewEscape(siteUrl)}">Results</a><a class="phone" href="${phoneHref}">${phoneDisplay}</a><a class="contact" href="${previewEscape(siteUrl)}">Contact</a></nav></header><section class="site-hero"><div><small>${clientName}${location ? ` · ${previewEscape(location)}` : ""}</small><h1>${safeTitle}</h1></div></section><main class="site-content"><article>${articleContent}</article><aside><div class="contact-card"><h2>Talk with the team</h2><p>Questions about this page or your legal options? Contact ${clientName} directly.</p><a href="${phoneHref}">Call ${phoneDisplay}</a></div></aside></main><footer class="site-footer"><div><strong>${clientName}</strong><p>Website preview generated from the approved page content.</p></div><a href="${previewEscape(siteUrl)}">Visit current website</a></footer></body>
</html>`;
}

function recentRecordValues(records: PageRecord[], key: keyof PageRecord) {
  const seen = new Set<string>();
  const values: string[] = [];

  for (const record of records) {
    const value = record[key];
    if (typeof value !== "string") continue;
    const cleaned = value.trim();
    const normalized = cleaned.toLowerCase();
    if (!cleaned || seen.has(normalized)) continue;
    seen.add(normalized);
    values.push(cleaned);
    if (values.length === 12) break;
  }

  return values;
}

async function readApiResponse(response: Response) {
  const text = await response.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    const fallback =
      response.status === 504
        ? "The request took too long. It is safe to try again."
        : "The service returned an unexpected response. Please try again.";
    throw new Error(fallback);
  }

  if (!response.ok) {
    throw new Error(
      typeof data.error === "string" ? data.error : "The page could not be created.",
    );
  }
  return data;
}

async function syncEditorialStatus(
  slotId: string | undefined,
  status: "drafting" | "review" | "wordpress_draft" | "scheduled" | "published" | "error",
  extras: Record<string, unknown> = {},
) {
  if (!slotId) return;
  await fetch("/api/editorial", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "sync_status", slotId, status, ...extras }),
  }).catch(() => undefined);
}

export default function Home() {
  const router = useRouter();
  const [records, setRecords] = useState<PageRecord[]>([]);
  const [form, setForm] = useState<DraftInput>(emptyForm);
  const [enhanceForm, setEnhanceForm] = useState<EnhanceInput>(emptyEnhanceForm);
  const [blogForm, setBlogForm] = useState<BlogInput>(emptyBlogForm);
  const [aopForm, setAopForm] = useState<AopInput>(emptyAopForm);
  const [subAopForm, setSubAopForm] = useState<SubAopInput>(emptySubAopForm);
  const [topicQuestionsLoading, setTopicQuestionsLoading] = useState(false);
  const [topicQuestions, setTopicQuestions] = useState<BlogTopicQuestion[]>([]);
  const [enhanceInputMode, setEnhanceInputMode] = useState<"single" | "bulk">("single");
  const [authorizedBulkBatches, setAuthorizedBulkBatches] = useState<string[]>([]);
  const [bulkUrlText, setBulkUrlText] = useState("");
  const [bulkImport, setBulkImport] = useState<BulkImport>(emptyBulkImport);
  const [activeWorkflow, setActiveWorkflow] = useState<Workflow>("create");
  const [hydrated, setHydrated] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(true);
  const [cloudReady, setCloudReady] = useState(false);
  const [stalledResetComplete, setStalledResetComplete] = useState(false);
  const [search, setSearch] = useState("");
  const [contentFilter, setContentFilter] = useState<ContentFilter>("all");
  const [trackerStatusFilter, setTrackerStatusFilter] = useState<TrackerStatusFilter>("all");
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [publishingToWordPress, setPublishingToWordPress] = useState<string | null>(null);
  const [generatingImage, setGeneratingImage] = useState<string | null>(null);
  const [approvingImage, setApprovingImage] = useState<string | null>(null);
  const [publishingLive, setPublishingLive] = useState<string | null>(null);
  const [schedulingBlog, setSchedulingBlog] = useState<string | null>(null);
  const [syncingDirectory, setSyncingDirectory] = useState<string | null>(null);
  const [pagePreview, setPagePreview] = useState<PagePreview>(emptyPagePreview);
  const [reviewFeedbackDialog, setReviewFeedbackDialog] = useState<ReviewFeedbackDialog | null>(null);
  const pollingJobs = useRef(new Set<string>());
  const activeDraftBuilds = useRef(new Set<string>());
  const previewRequests = useRef(0);
  const topicQuestionRequest = useRef<AbortController | null>(null);
  const selectAllRecordsRef = useRef<HTMLInputElement>(null);
  const startingBulkJob = useRef<string | null>(null);
  const resettingStalledRecords = useRef(false);
  const memoryInitialized = useRef(false);
  const [google, setGoogle] = useState<GoogleStatus>({
    loading: true,
    configured: false,
    openaiConfigured: false,
    connected: false,
  });
  const [wordpress, setWordpress] = useState<WordPressStatus>({
    loading: true,
    configured: false,
    bridgeConnected: false,
  });

  const buildWordPressDraft = useCallback(async (
    record: PageRecord,
    refresh = false,
    askForConfirmation = true,
  ) => {
    if (
      !record.docUrl ||
      !googleDocId(record) ||
      (!refresh && record.wordpressPageId) ||
      activeDraftBuilds.current.has(record.id)
    ) return;

    const pageTitle = recordTitle(record);
    if (askForConfirmation) {
      const confirmed = window.confirm(
        `${refresh ? "Refresh" : "Send"} "${pageTitle}" ${refresh ? "in" : "to"} WordPress as a ${isBlog(record) ? "post " : ""}draft?\n\n${requiresPreWordPressImageApproval(record) ? "Your approved featured image and its alt text will be attached. " : ""}It will not go live.`,
      );
      if (!confirmed) return;
    }

    activeDraftBuilds.current.add(record.id);
    setPublishingToWordPress(record.id);
    setNotice(null);
    try {
      if(!refresh && record.aronDone) {
        const queued=await fetch("/api/aron/review-queue",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:record.id,action:"approve"})});
        const result=await readApiResponse(queued);
        if(!queued.ok||result.ok!==true)throw new Error(typeof result.error==="string"?result.error:"The approved upload could not be queued.");
        const preparation=await fetch("/api/aron/review-queue",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:record.id,action:"prepare"})});
        const prepared=await readApiResponse(preparation);
        if(!preparation.ok||prepared.ok!==true)throw new Error(typeof prepared.error==="string"?prepared.error:"Draft preparation could not be queued.");
        setNotice("The approved WordPress draft is queued on the server. Uploading and temporary retries continue even if you close this tab.");
        return;
      }
      const response = await fetch("/api/wordpress/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: record.clientId,
          docId: googleDocId(record),
          website: record.website,
          workflow: record.workflow,
          pageUrl: record.pageUrl,
          aronApproved: record.aronDone,
          practiceArea: record.practiceArea,
          city: record.city,
          state: record.state,
          primaryKeyword: record.primaryKeyword,
          jurisdiction: record.jurisdiction,
          parentPracticeArea: record.parentPracticeArea,
          blogPracticeArea: record.blogPracticeArea,
          authorityAttorney: record.authorityAttorney,
          parentId: record.parentId,
          approvedImageReviewId: record.pendingImageReviewId,
        }),
      });
      const data = await readApiResponse(response);
      if (data.ok !== true || typeof data.pageId !== "number") {
        throw new Error("WordPress did not confirm that the formatted draft was created.");
      }
      const pageId = data.pageId;
      setRecords((current) => current.map((item) => item.id === record.id ? {
        ...item,
        aronDone: true,
        approvalStatus: "APPROVED",
        status: data.status === "publish" ? "published" : "ready",
        published: data.status === "publish",
        wordpressPageId: pageId,
        wordpressUrl: typeof data.pageUrl === "string" ? data.pageUrl : undefined,
        wordpressEditUrl: typeof data.editUrl === "string" ? data.editUrl : undefined,
        wordpressPreviewUrl: typeof data.previewUrl === "string" ? data.previewUrl : undefined,
        wordpressStatus: data.status === "publish" ? "publish" : "draft",
        wordpressDraftAt: new Date().toISOString(),
        featuredMediaId: typeof data.featuredMediaId === "number" ? data.featuredMediaId : undefined,
        featuredImageUrl: typeof data.featuredImageUrl === "string" ? data.featuredImageUrl : undefined,
        pendingImageUrl: typeof data.featuredImageUrl === "string"
          ? data.featuredImageUrl
          : item.pendingImageUrl,
        featuredImageReviewRequired: data.imageReviewRequired === true,
        featuredImageApproved: typeof data.featuredImageUrl === "string"
          ? data.imageReviewRequired !== true
          : item.featuredImageApproved,
        error: undefined,
        updatedAt: new Date().toISOString(),
      } : item));
      void syncEditorialStatus(record.editorialSlotId, data.status === "publish" ? "published" : "wordpress_draft");
      setNotice(
        typeof data.warning === "string"
          ? data.warning
          : `The WordPress ${isBlog(record) ? "post draft" : "page draft"}${requiresPreWordPressImageApproval(record) ? " and your approved featured image are" : " is"} ready. Open it in WordPress to review it with the website’s real theme.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "The WordPress draft could not be created.";
      setRecords((current) => current.map((item) => item.id === record.id ? {
        ...item,
        aronDone: true,
        approvalStatus: "APPROVED",
        status: "ready",
        error: message,
        updatedAt: new Date().toISOString(),
      } : item));
      setNotice(message);
    } finally {
      activeDraftBuilds.current.delete(record.id);
      setPublishingToWordPress((current) => current === record.id ? null : current);
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const storedForm = localStorage.getItem(FORM_KEY);
        const storedEnhanceForm = localStorage.getItem(ENHANCE_FORM_KEY);
        const storedBlogForm = localStorage.getItem(BLOG_FORM_KEY);
        const storedAopForm = localStorage.getItem(AOP_FORM_KEY);
        const storedSubAopForm = localStorage.getItem(SUB_AOP_FORM_KEY);
        if (stored) setRecords(JSON.parse(stored));
        if (storedForm) setForm(JSON.parse(storedForm));
        if (storedEnhanceForm) setEnhanceForm(JSON.parse(storedEnhanceForm));
        if (storedBlogForm && !new URLSearchParams(window.location.search).has("editorialSlotId")) setBlogForm({ ...emptyBlogForm, ...JSON.parse(storedBlogForm) });
        if (storedAopForm) setAopForm(JSON.parse(storedAopForm));
        if (storedSubAopForm) setSubAopForm(JSON.parse(storedSubAopForm));
      } catch {
        // Ignore malformed browser storage and start fresh.
      }
      setHydrated(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!hydrated || !google.connected || cloudReady) return;
    let cancelled = false;
    fetch("/api/tracker", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (cancelled || !Array.isArray(data.records)) return;
        setRecords((localRecords) => {
          const merged = new Map<string, PageRecord>();
          for (const record of data.records as PageRecord[]) merged.set(record.id, record);
          const deletedIds = new Set(Array.isArray(data.deletedIds) ? data.deletedIds : []);
          for (const record of localRecords) {
            if (deletedIds.has(record.id)) continue;
            const cloudRecord = merged.get(record.id);
            const localTime = new Date(record.updatedAt || record.createdAt).getTime();
            const cloudTime = cloudRecord
              ? new Date(cloudRecord.updatedAt || cloudRecord.createdAt).getTime()
              : 0;
            if (!cloudRecord || localTime >= cloudTime) merged.set(record.id, record);
          }
          return [...merged.values()].sort(compareTrackerOrder);
        });
        setCloudReady(true);
      })
      .catch(() => setCloudReady(true));
    return () => {
      cancelled = true;
    };
  }, [cloudReady, google.connected, hydrated]);

  useEffect(() => {
    if (!hydrated || !google.connected || !cloudReady) return;
    let cancelled = false;
    let syncing = false;
    const refreshTracker = async () => {
      if (syncing || document.visibilityState === "hidden") return;
      syncing = true;
      try {
        const response = await fetch("/api/tracker", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (cancelled || !Array.isArray(data.records)) return;
        setRecords(current => {
          const merged = reconcileTrackerSnapshot(current, data.records as PageRecord[], Array.isArray(data.deletedIds) ? data.deletedIds : []);
          return merged === current ? current : merged.sort(compareTrackerOrder);
        });
      } catch {
        // Preserve local work during a temporary connection failure.
      } finally {
        syncing = false;
      }
    };
    const interval = window.setInterval(() => void refreshTracker(), 30_000);
    window.addEventListener("focus", refreshTracker);
    document.addEventListener("visibilitychange", refreshTracker);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshTracker);
      document.removeEventListener("visibilitychange", refreshTracker);
    };
  }, [cloudReady, google.connected, hydrated]);

  useEffect(() => {
    if (
      !hydrated ||
      !google.connected ||
      !cloudReady ||
      stalledResetComplete ||
      resettingStalledRecords.current
    ) {
      return;
    }

    if (localStorage.getItem(STALLED_RESET_KEY)) {
      window.queueMicrotask(() => setStalledResetComplete(true));
      return;
    }

    const cleanedRecords = records.filter((record) => !isInitialResetTarget(record));
    const removed = records.length - cleanedRecords.length;
    if (!removed) {
      localStorage.setItem(STALLED_RESET_KEY, "complete");
      window.queueMicrotask(() => setStalledResetComplete(true));
      return;
    }

    resettingStalledRecords.current = true;
    window.queueMicrotask(() => {
      pollingJobs.current.clear();
      startingBulkJob.current = null;
      setCreating(false);
      setBulkUrlText("");
      setBulkImport(emptyBulkImport);
      setRecords(cleanedRecords);
      setNotice(`${removed} stalled page${removed === 1 ? " was" : "s were"} cleared. The enhancement queue is reset.`);

      void fetch("/api/tracker", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanedRecords),
      })
        .then((response) => {
          if (response.ok) localStorage.setItem(STALLED_RESET_KEY, "complete");
        })
        .finally(() => {
          resettingStalledRecords.current = false;
          setStalledResetComplete(true);
        });
    });
  }, [cloudReady, google.connected, hydrated, records, stalledResetComplete]);

  useEffect(() => {
    if (!hydrated || !google.connected || !cloudReady) return;
    const timeout = window.setTimeout(() => {
      fetch("/api/tracker", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(records),
      }).catch(() => undefined);
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [cloudReady, google.connected, hydrated, records]);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }, [records, hydrated]);

  useEffect(() => {
    if (hydrated) localStorage.setItem(FORM_KEY, JSON.stringify(form));
  }, [form, hydrated]);

  useEffect(() => {
    if (hydrated) localStorage.setItem(ENHANCE_FORM_KEY, JSON.stringify(enhanceForm));
  }, [enhanceForm, hydrated]);

  useEffect(() => {
    if (hydrated) localStorage.setItem(BLOG_FORM_KEY, JSON.stringify(blogForm));
  }, [blogForm, hydrated]);

  useEffect(() => {
    if (hydrated) localStorage.setItem(AOP_FORM_KEY, JSON.stringify(aopForm));
  }, [aopForm, hydrated]);

  useEffect(() => {
    if (hydrated) localStorage.setItem(SUB_AOP_FORM_KEY, JSON.stringify(subAopForm));
  }, [subAopForm, hydrated]);

  useEffect(() => {
    if (!pagePreview.open) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        previewRequests.current += 1;
        setPagePreview(emptyPagePreview);
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [pagePreview.open]);

  useEffect(() => {
    if (!hydrated || memoryInitialized.current || !records.length) return;
    memoryInitialized.current = true;
    setForm((current) => {
      const hasDraft = Object.values(current).some((value) => value.trim());
      if (hasDraft) return current;
      const previous = records.find((record) => !isEnhancement(record) && !isBlog(record) && !isAop(record) && !isSubAop(record));
      if (!previous) return current;
      return {
        clientId: previous.clientId || current.clientId,
        website: previous.website,
        practiceArea: previous.practiceArea,
        city: "",
        state: previous.state,
        notes: "",
      };
    });
  }, [hydrated, records]);

  useEffect(() => {
    if (!hydrated || !google.connected || !cloudReady) return;

    const reconcileGeneratingRecords = () => {
      const now = Date.now();
      setRecords((current) => {
        let changed = false;
        const next = current.map((record) => {
          const error = generationNeverStarted(record, now)
            ? GENERATION_START_ERROR
            : undefined;
          if (!error) return record;
          changed = true;
          if (record.jobId) pollingJobs.current.delete(record.jobId);
          return {
            ...record,
            status: "error" as const,
            error,
            updatedAt: new Date(now).toISOString(),
          };
        });
        return changed ? next : current;
      });
    };

    reconcileGeneratingRecords();
    const interval = window.setInterval(reconcileGeneratingRecords, 30_000);
    return () => window.clearInterval(interval);
  }, [cloudReady, google.connected, hydrated]);

  useEffect(() => {
    if (!hydrated || !google.connected) return;
    const pending = records.filter(
      (record) =>
        record.status === "generating" &&
        Boolean(record.jobId) &&
        !pollingJobs.current.has(record.jobId!),
    );

    for (const record of pending) {
      const jobId = record.jobId!;
      pollingJobs.current.add(jobId);
      void (async () => {
        let consecutiveFailures = 0;
        const deadline = generationStartedAt(record) + GENERATION_TIMEOUT_MS;
        try {
          for (let attempt = 0; attempt < 360; attempt += 1) {
            try {
              const response = await fetch(
                `/api/generate?jobId=${encodeURIComponent(jobId)}`,
                { cache: "no-store" },
              );
              const data = await readApiResponse(response);
              consecutiveFailures = 0;

              if (data.status === "queued" || data.status === "in_progress") {
                if (Date.now() >= deadline) throw new Error(GENERATION_TIMEOUT_ERROR);
                await new Promise((resolve) => window.setTimeout(resolve, 5000));
                continue;
              }

              if (data.status === "completed" && data.doc && typeof data.doc === "object") {
                const doc = data.doc as {
                  id?: string;
                  url?: string;
                  name?: string;
                  approval?: { enabled?: boolean; id?: string; status?: string };
                };
                setRecords((current) =>
                  current.map((item) =>
                    item.id === record.id
                      ? {
                          ...item,
                          status: "review",
                          docId: doc.id,
                          docUrl: doc.url,
                          docName: doc.name,
                          approvalEnabled: doc.approval?.enabled === true,
                          approvalId: doc.approval?.id,
                          approvalStatus: doc.approval?.status,
                          aronDone: doc.approval?.status === "APPROVED",
                          wordCount:
                            typeof data.wordCount === "number" ? data.wordCount : undefined,
                          error: undefined,
                          updatedAt: new Date().toISOString(),
                        }
                      : item,
                  ),
                );
                void syncEditorialStatus(record.editorialSlotId, "review");
                setNotice(
                  doc.approval?.enabled
                    ? "Draft shared with Aron, and his Google approval request was started."
                    : "Draft created in Google Docs and shared with Aron.",
                );
                return;
              }

              throw new Error("The research finished without a usable draft. Please try again.");
            } catch (error) {
              consecutiveFailures += 1;
              if (consecutiveFailures < 3) {
                await new Promise((resolve) => window.setTimeout(resolve, 5000));
                continue;
              }
              throw error;
            }
          }
          throw new Error("The research is taking unusually long. Please try again.");
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "The page could not be created.";
          setRecords((current) =>
            current.map((item) =>
              item.id === record.id
                ? {
                    ...item,
                    status: "error",
                    error: message,
                    updatedAt: new Date().toISOString(),
                  }
                : item,
            ),
          );
          void syncEditorialStatus(record.editorialSlotId, "error", { error: message });
          setNotice(message);
        } finally {
          pollingJobs.current.delete(jobId);
        }
      })();
    }
  }, [google.connected, hydrated, records]);

  useEffect(() => {
    if (!hydrated || !google.connected) return;
    const candidates = records.filter(
      (record) =>
        record.approvalEnabled !== false &&
        Boolean(record.docUrl) &&
        record.approvalStatus !== "APPROVED" &&
        record.status !== "generating" &&
        record.status !== "error" &&
        !record.error,
    );
    if (!candidates.length) return;

    let cancelled = false;
    const checkApprovals = async () => {
      if (document.visibilityState !== "visible") return;
      for (const record of candidates) {
        if (cancelled || document.visibilityState !== "visible") return;
        const docId = googleDocId(record);
        if (!docId) continue;

        try {
          const response =
            record.approvalEnabled === true
              ? await fetch(`/api/google/approval?docId=${encodeURIComponent(docId)}`, {
                  cache: "no-store",
                })
              : await fetch("/api/google/approval", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ docId }),
                });
          const data = await readApiResponse(response);
          if (cancelled) return;

          if (data.supported !== true) {
            setRecords((current) =>
              current.map((item) =>
                item.id === record.id
                  ? {
                      ...item,
                      approvalEnabled: false,
                      updatedAt: new Date().toISOString(),
                    }
                  : item,
              ),
            );
            continue;
          }

          const status = typeof data.status === "string" ? data.status : "IN_PROGRESS";
          if (status === "APPROVED") {
            const approvedRecord: PageRecord = {
              ...record,
              approvalEnabled: true,
              approvalId: typeof data.approvalId === "string" ? data.approvalId : record.approvalId,
              approvalStatus: status,
              aronDone: true,
              status: "ready",
              updatedAt: new Date().toISOString(),
            };
            setRecords((current) => current.map((item) => item.id === record.id ? {
              ...item,
              ...approvedRecord,
            } : item));
            setNotice("Aron approved the Google Doc. Choose Send to WordPress to prepare its draft.");
            continue;
          }

          if (status !== record.approvalStatus) {
            setRecords((current) =>
              current.map((item) =>
                item.id === record.id
                  ? {
                      ...item,
                      approvalEnabled: true,
                      approvalId:
                        typeof data.approvalId === "string" ? data.approvalId : item.approvalId,
                      approvalStatus: status,
                      aronDone: status === "APPROVED",
                      updatedAt: new Date().toISOString(),
                    }
                  : item,
              ),
            );
          }
        } catch {
          // Keep the approval pending and check again. Manual fallback remains available
          // whenever Google reports that formal approvals are unsupported.
        }
      }
    };

    void checkApprovals();
    const interval = window.setInterval(() => void checkApprovals(), 60000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [buildWordPressDraft, google.connected, hydrated, records]);

  useEffect(() => {
    fetch("/api/google/status", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setGoogle({ loading: false, ...data }))
      .catch(() =>
        setGoogle((current) => ({ ...current, loading: false, connected: false })),
      );

    const frame = window.requestAnimationFrame(() => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("record")) { setSearch(params.get("record") || ""); setShowForm(false); setContentFilter("all"); setTrackerStatusFilter("all"); }
      if (params.get("google") === "connected") setNotice("Google Drive connected.");
      if (params.get("google") === "failed") setNotice("Google could not be connected. Try again.");
      if (params.get("setup") === "google") {
        setNotice("Google OAuth needs to be configured in Vercel before you can connect.");
      }
      if (params.get("workflow") === "blog" && params.get("editorialSlotId")) {
        setActiveWorkflow("blog");
        setShowForm(true);
        setBlogForm((current) => ({
          ...current,
          clientId: params.get("clientId") || current.clientId,
          website: "",
          practiceArea: params.get("practiceArea") || current.practiceArea,
          topic: params.get("topic") || current.topic,
          primaryKeyword: params.get("primaryKeyword") || current.primaryKeyword,
          jurisdiction: params.get("jurisdiction") || current.jurisdiction,
          editorialSlotId: params.get("editorialSlotId") || "",
          scheduledPublishAt: params.get("publishAt") || "",
        }));
        setNotice("The selected calendar topic is ready. Review the brief, then create the blog for Aron.");
      }
      if (params.size) window.history.replaceState({}, "", "/");
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  // Resolve calendar links after either the URL or asynchronous client list arrives.
  useEffect(() => {
    const selected = clients.find(client => client.id === blogForm.clientId);
    if (selected && blogForm.website !== selected.website) {
      setBlogForm(current => ({ ...current, website: selected.website }));
    }
  }, [clients, blogForm.clientId, blogForm.website]);

  useEffect(() => {
    fetch("/api/clients", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        const available = Array.isArray(data.clients) ? data.clients as ClientSummary[] : [];
        setClients(available);
        const first = available[0];
        if (!first) return;
        setForm((current) => current.clientId ? current : {
          ...current,
          clientId: first.id,
          website: current.website || first.website,
          practiceArea: current.practiceArea || first.practiceAreas?.[0] || "",
        });
        setEnhanceForm((current) => current.clientId ? current : { ...current, clientId: first.id });
        setBlogForm((current) => {
          const selected = available.find((client) => client.id === current.clientId) || first;
          return {
            ...current,
            clientId: selected.id,
            website: selected.website,
            practiceArea: current.practiceArea || selected.practiceAreas?.[0] || "",
            jurisdiction: current.jurisdiction
              || selected.blogDefaults?.defaultJurisdiction
              || selected.jurisdictions?.[0]
              || "",
          };
        });
        setAopForm((current) => {
          const selected = available.find((client) => client.id === current.clientId) || first;
          return {
            ...current,
            clientId: selected.id,
            website: selected.website,
            practiceArea: current.practiceArea || selected.practiceAreas?.[0] || "",
            jurisdiction: current.jurisdiction
              || selected.blogDefaults?.defaultJurisdiction
              || selected.jurisdictions?.[0]
              || "",
          };
        });
        setSubAopForm((current) => {
          const selected = available.find((client) => client.id === current.clientId) || first;
          return {
            ...current,
            clientId: selected.id,
            website: selected.website,
            parentPracticeArea: current.parentPracticeArea || selected.practiceAreas?.[0] || "",
            jurisdiction: current.jurisdiction
              || selected.blogDefaults?.defaultJurisdiction
              || selected.jurisdictions?.[0]
              || "",
          };
        });
      })
      .catch(() => {
        setClients([]);
      });
  }, []);

  const activeClientId = activeWorkflow === "create"
    ? form.clientId
    : activeWorkflow === "blog"
      ? blogForm.clientId
      : activeWorkflow === "aop"
        ? aopForm.clientId
        : activeWorkflow === "subaop"
          ? subAopForm.clientId
      : enhanceForm.clientId;
  const activeClient = clients.find((client) => client.id === activeClientId);

  useEffect(() => {
    if (!activeClientId) {
      window.queueMicrotask(() =>
        setWordpress({ loading: false, configured: false, bridgeConnected: false }),
      );
      return;
    }
    let cancelled = false;
    window.queueMicrotask(() => {
      if (!cancelled) setWordpress((current) => ({ ...current, loading: true }));
    });
    fetch(`/api/wordpress/status?clientId=${encodeURIComponent(activeClientId)}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setWordpress({ loading: false, ...data });
      })
      .catch(() => {
        if (!cancelled) setWordpress({ loading: false, configured: false, bridgeConnected: false });
      });
    return () => {
      cancelled = true;
    };
  }, [activeClientId]);

  const activeRecords = useMemo(() => records.filter(record => !isPublishedContent(record)), [records]);

  const metrics = useMemo(
    () => ({
      total: activeRecords.length,
      withAron: activeRecords.filter(
        (record) => !record.aronDone && record.status === "review",
      ).length,
      approved: activeRecords.filter((record) => record.aronDone).length,
      wordpressDrafts: activeRecords.filter(
        (record) => record.wordpressStatus === "draft" && !record.published,
      ).length,
    }),
    [activeRecords],
  );

  const unfinishedCount = useMemo(
    () => records.filter((record) => isStalledRecord(record)).length,
    [records],
  );

  const formMemory = useMemo(
    () => {
      const createdPages = records.filter((record) => !isEnhancement(record) && !isBlog(record) && !isAop(record) && !isSubAop(record));
      return {
        websites: recentRecordValues(createdPages, "website"),
        practiceAreas: recentRecordValues(createdPages, "practiceArea"),
        cities: recentRecordValues(createdPages, "city"),
        states: recentRecordValues(createdPages, "state"),
      };
    },
    [records],
  );

  const trackerTypeCounts = useMemo(() => {
    const counts: Record<ContentFilter, number> = {
      all: activeRecords.length,
      geo: 0,
      enhance: 0,
      blog: 0,
      aop: 0,
      subaop: 0,
    };
    for (const record of activeRecords) counts[contentFilterKey(record)] += 1;
    return counts;
  }, [activeRecords]);

  const visibleRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    return activeRecords.filter((record) => {
      if (contentFilter !== "all" && contentFilterKey(record) !== contentFilter) return false;
      if (!matchesTrackerStatus(record, trackerStatusFilter)) return false;
      if (!query) return true;
      return [record.id, record.clientName, record.pageUrl, record.website, record.parentPracticeArea, record.practiceArea, record.city, record.state, record.primaryKeyword, record.jurisdiction]
        .join(" ")
        .toLowerCase()
        .includes(query);
    }).sort(compareTrackerOrder);
  }, [contentFilter, activeRecords, search, trackerStatusFilter]);

  const selectedRecords = useMemo(
    () => records.filter((record) => selectedRecordIds.has(record.id)),
    [records, selectedRecordIds],
  );
  const selectedVisibleCount = useMemo(
    () => visibleRecords.filter((record) => selectedRecordIds.has(record.id)).length,
    [selectedRecordIds, visibleRecords],
  );
  const allVisibleSelected =
    visibleRecords.length > 0 && selectedVisibleCount === visibleRecords.length;

  useEffect(() => {
    if (!selectAllRecordsRef.current) return;
    selectAllRecordsRef.current.indeterminate =
      selectedVisibleCount > 0 && !allVisibleSelected;
  }, [allVisibleSelected, selectedVisibleCount]);

  const previewRecord = pagePreview.recordId
    ? records.find((record) => record.id === pagePreview.recordId)
    : undefined;
  const previewClient = previewRecord
    ? clients.find((client) => client.id === previewRecord.clientId)
    : undefined;

  function updateForm<K extends keyof DraftInput>(key: K, value: DraftInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateEnhanceForm<K extends keyof EnhanceInput>(key: K, value: EnhanceInput[K]) {
    setEnhanceForm((current) => ({ ...current, [key]: value }));
  }

  function updateBlogForm<K extends keyof BlogInput>(key: K, value: BlogInput[K]) {
    setBlogForm((current) => ({ ...current, [key]: value }));
  }

  function updateAopForm<K extends keyof AopInput>(key: K, value: AopInput[K]) {
    setAopForm((current) => ({ ...current, [key]: value }));
  }

  function updateSubAopForm<K extends keyof SubAopInput>(key: K, value: SubAopInput[K]) {
    setSubAopForm((current) => ({ ...current, [key]: value }));
  }

  function selectCreateClient(clientId: string) {
    const client = clients.find((item) => item.id === clientId);
    setForm((current) => ({
      ...current,
      clientId,
      website: client?.website || current.website,
    }));
  }

  function selectEnhanceClient(clientId: string) {
    setEnhanceForm((current) => ({ ...current, clientId }));
  }

  function selectBlogClient(clientId: string) {
    const client = clients.find((item) => item.id === clientId);
    topicQuestionRequest.current?.abort();
    topicQuestionRequest.current = null;
    setTopicQuestionsLoading(false);
    setTopicQuestions([]);
    setBlogForm((current) => ({
      ...current,
      clientId,
      website: client?.website || current.website,
      authorityAttorney: "",
      practiceArea: client?.practiceAreas?.[0] || "",
      topic: "",
      jurisdiction: client?.blogDefaults?.defaultJurisdiction || client?.jurisdictions?.[0] || "",
    }));
  }

  function selectAopClient(clientId: string) {
    const client = clients.find((item) => item.id === clientId);
    setAopForm((current) => ({
      ...current,
      clientId,
      website: client?.website || current.website,
      practiceArea: client?.practiceAreas?.[0] || "",
      jurisdiction: client?.blogDefaults?.defaultJurisdiction || client?.jurisdictions?.[0] || "",
    }));
  }

  function selectSubAopClient(clientId: string) {
    const client = clients.find((item) => item.id === clientId);
    setSubAopForm((current) => ({
      ...current,
      clientId,
      website: client?.website || current.website,
      parentPracticeArea: client?.practiceAreas?.[0] || "",
      practiceArea: "",
      jurisdiction: client?.blogDefaults?.defaultJurisdiction || client?.jurisdictions?.[0] || "",
    }));
  }

  async function findBlogTopicQuestions() {
    if (!blogForm.clientId || !blogForm.practiceArea.trim()) {
      setNotice("Choose a client and practice area before generating questions.");
      return;
    }
    topicQuestionRequest.current?.abort();
    const controller = new AbortController();
    topicQuestionRequest.current = controller;
    setTopicQuestionsLoading(true);
    setTopicQuestions([]);
    setNotice("ChatGPT is generating client-relevant blog questions.");
    const slowMessage = window.setTimeout(() => {
      if (topicQuestionRequest.current === controller) {
        setNotice("ChatGPT is still reviewing the client's practice area and audience. This can take a little longer on the first request.");
      }
    }, 15_000);
    const timeout = window.setTimeout(() => controller.abort(), 110_000);
    try {
      const response = await fetch("/api/blog-topics/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: blogForm.clientId,
          practiceArea: blogForm.practiceArea,
          jurisdiction: blogForm.jurisdiction,
          previousTopics: records
            .filter((record) => record.workflow === "blog" && record.clientId === blogForm.clientId)
            .map((record) => record.practiceArea)
            .filter(Boolean),
        }),
        signal: controller.signal,
      });
      const data = await readApiResponse(response);
      const questions = Array.isArray(data.questions)
        ? data.questions.filter((item): item is BlogTopicQuestion => Boolean(
            item && typeof item === "object" && typeof (item as BlogTopicQuestion).question === "string",
          ))
        : [];
      setTopicQuestions(questions);
      setNotice(
        questions.length
          ? `${questions.length} client-relevant blog question${questions.length === 1 ? "" : "s"} generated for ${blogForm.practiceArea}.`
          : `ChatGPT returned no usable questions for ${blogForm.practiceArea}. Try a broader practice-area phrase.`,
      );
    } catch (error) {
      setNotice(
        error instanceof Error && error.name === "AbortError"
          ? "Question generation took too long and was stopped. Please try it again."
          : error instanceof Error ? error.message : "ChatGPT topic generation failed.",
      );
    } finally {
      window.clearTimeout(slowMessage);
      window.clearTimeout(timeout);
      if (topicQuestionRequest.current === controller) {
        topicQuestionRequest.current = null;
        setTopicQuestionsLoading(false);
      }
    }
  }

  function updateBulkUrlText(content: string) {
    const urls = parseBulkUrls(content);
    setBulkUrlText(content);
    setBulkImport({
      fileName: "",
      urls: urls.slice(0, BULK_ENHANCE_LIMIT),
      totalFound: urls.length,
    });
  }

  async function importBulkUrls(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    setNotice(null);
    try {
      const content = await file.text();
      const urls = parseBulkUrls(content);
      if (!urls.length) {
        setBulkUrlText("");
        setBulkImport(emptyBulkImport);
        setNotice("No valid page URLs were found. Upload a CSV or TXT file containing full http or https URLs.");
        return;
      }

      setBulkUrlText(content);
      setBulkImport({
        fileName: file.name,
        urls: urls.slice(0, BULK_ENHANCE_LIMIT),
        totalFound: urls.length,
      });
    } catch {
      setBulkUrlText("");
      setBulkImport(emptyBulkImport);
      setNotice("That URL file could not be read. Try a CSV or TXT file.");
    } finally {
      input.value = "";
    }
  }

  function openWorkflow(workflow: Workflow) {
    setActiveWorkflow(workflow);
    setShowForm(true);
    window.requestAnimationFrame(() =>
      document.getElementById("page-workflow")?.scrollIntoView({ behavior: "smooth" }),
    );
  }

  const updateRecord = useCallback((id: string, updates: Partial<PageRecord>) => {
    setRecords((current) =>
      current.map((record) =>
        record.id === id
          ? { ...record, ...updates, updatedAt: new Date().toISOString() }
          : record,
      ),
    );
  }, []);

  async function saveDashboardDeletion(ids: string[]) {
    if (!google.connected || !cloudReady) return true;
    try {
      await readApiResponse(await fetch("/api/tracker", {
        method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }),
      }));
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The dashboard deletion could not be saved.");
      return false;
    }
  }

  async function deleteRecord(record: PageRecord) {
    const title = recordTitle(record);
    const confirmed = window.confirm(
      `Delete "${title}" from the dashboard?${record.docUrl ? " The Google Doc will not be deleted." : ""}`,
    );
    if (!confirmed) return;

    if (!(await saveDashboardDeletion([record.id]))) return;
    if (record.jobId) pollingJobs.current.delete(record.jobId);
    if (startingBulkJob.current === record.id) startingBulkJob.current = null;
    setRecords((current) => current.filter((item) => item.id !== record.id));
    setSelectedRecordIds((current) => {
      const next = new Set(current);
      next.delete(record.id);
      return next;
    });
    setNotice("The page was removed from the dashboard.");
  }

  function toggleRecordSelection(recordId: string) {
    setSelectedRecordIds((current) => {
      const next = new Set(current);
      if (next.has(recordId)) next.delete(recordId);
      else next.add(recordId);
      return next;
    });
  }

  function toggleAllVisibleRecords() {
    setSelectedRecordIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        visibleRecords.forEach((record) => next.delete(record.id));
      } else {
        visibleRecords.forEach((record) => next.add(record.id));
      }
      return next;
    });
  }

  async function deleteSelectedRecords() {
    if (!selectedRecords.length) return;
    const docsRemain = selectedRecords.some((record) => record.docUrl);
    const confirmed = window.confirm(
      `Delete ${selectedRecords.length} selected page${selectedRecords.length === 1 ? "" : "s"} from the dashboard?${docsRemain ? " Existing Google Docs will not be deleted." : ""}`,
    );
    if (!confirmed) return;

    const idsToDelete = new Set(selectedRecords.map((record) => record.id));
    if (!(await saveDashboardDeletion([...idsToDelete]))) return;
    for (const record of selectedRecords) {
      if (record.jobId) pollingJobs.current.delete(record.jobId);
      if (startingBulkJob.current === record.id) startingBulkJob.current = null;
    }
    setRecords((current) => current.filter((record) => !idsToDelete.has(record.id)));
    setSelectedRecordIds(new Set());
    setNotice(
      `${selectedRecords.length} page${selectedRecords.length === 1 ? " was" : "s were"} removed from the dashboard.`,
    );
  }

  function markAronReviewComplete(record: PageRecord) {
    if (!record.docUrl) {
      setNotice("The Google Doc must be ready before Aron’s review can be completed.");
      return;
    }
    const confirmed = window.confirm(
      "Mark Aron’s review complete? Use this only after Aron has confirmed the Google Doc is approved.",
    );
    if (!confirmed) return;
    const approvedRecord: PageRecord = {
      ...record,
      aronDone: true,
      approvalStatus: "APPROVED",
      status: "ready",
      error: undefined,
      updatedAt: new Date().toISOString(),
    };
    updateRecord(record.id, approvedRecord);
    setNotice("Aron’s review is marked complete. Choose Send to WordPress to prepare its draft.");
  }

  function openReviewFeedback(record: PageRecord) {
    if (!record.docUrl || !googleDocId(record)) {
      setNotice("The Google Doc must be ready before feedback can be applied.");
      return;
    }
    setReviewFeedbackDialog({
      recordId: record.id,
      feedback: record.reviewFeedback || "",
      submitting: false,
    });
  }

  async function submitReviewFeedback(event: FormEvent) {
    event.preventDefault();
    if (!reviewFeedbackDialog || reviewFeedbackDialog.submitting) return;
    const record = records.find((item) => item.id === reviewFeedbackDialog.recordId);
    const feedback = reviewFeedbackDialog.feedback.trim();
    const revisionDocId = record ? googleDocId(record) : undefined;
    if (!record || !revisionDocId) {
      setReviewFeedbackDialog((current) => current ? { ...current, error: "The current Google Doc could not be found." } : current);
      return;
    }
    if (feedback.length < 5) {
      setReviewFeedbackDialog((current) => current ? { ...current, error: "Add Aron’s feedback before generating the revision." } : current);
      return;
    }

    const revisionNumber = Math.max(2, (record.revisionNumber || 1) + 1);
    setReviewFeedbackDialog((current) => current ? { ...current, submitting: true, error: undefined } : current);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Idempotency-Key": `${record.id}:revision:${revisionNumber}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          workflow: record.workflow || "create",
          clientId: record.clientId,
          website: record.website,
          pageUrl: record.pageUrl,
          practiceArea: isBlog(record) ? record.blogPracticeArea || "" : record.practiceArea,
          city: record.city,
          state: record.state,
          topic: isBlog(record) ? record.practiceArea : undefined,
          primaryKeyword: record.primaryKeyword,
          jurisdiction: record.jurisdiction,
          parentPracticeArea: record.parentPracticeArea,
          relatedQuestions: record.relatedQuestions,
          authorityAttorney: record.authorityAttorney,
          notes: record.notes,
          revisionDocId,
          revisionFeedback: feedback,
          revisionNumber,
        }),
      });
      const data = await readApiResponse(response);
      if (typeof data.jobId !== "string") {
        throw new Error("The revision job could not be started. Please try again.");
      }

      pollingJobs.current.delete(record.jobId || "");
      updateRecord(record.id, {
        status: "generating",
        jobId: data.jobId,
        aronDone: false,
        approvalEnabled: undefined,
        approvalId: undefined,
        approvalStatus: undefined,
        reviewFeedback: feedback,
        revisionNumber,
        error: undefined,
      });
      setReviewFeedbackDialog(null);
      setNotice(`Revision ${revisionNumber} is being written from Aron’s feedback. A new Google Doc will be shared with him automatically.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The revision could not be started.";
      setReviewFeedbackDialog((current) => current ? { ...current, submitting: false, error: message } : current);
    }
  }

  async function openPagePreview(record: PageRecord) {
    const savedPreview = wordPressPreviewUrl(record);
    if (savedPreview) {
      window.open(savedPreview, "_blank", "noopener,noreferrer");
      return;
    }
    if (!record.aronDone) {
      setNotice("This page can be previewed after Aron approves the Google Doc.");
      return;
    }
    const docId = googleDocId(record);
    if (!docId) {
      setNotice("The Google Doc is missing, so this page cannot be previewed yet.");
      return;
    }

    const fallbackTitle = recordTitle(record).replace(" · ", " ").trim();
    const requestId = previewRequests.current + 1;
    previewRequests.current = requestId;
    setPagePreview({
      open: true,
      loading: true,
      title: fallbackTitle || "Page preview",
      html: "",
      recordId: record.id,
    });

    try {
      const query = new URLSearchParams({ docId, fallbackTitle });
      const response = await fetch(`/api/google/preview?${query}`, { cache: "no-store" });
      const data = await readApiResponse(response);
      if (typeof data.html !== "string" || typeof data.title !== "string") {
        throw new Error("Google did not return a usable page preview.");
      }
      if (previewRequests.current !== requestId) return;
      setPagePreview({
        open: true,
        loading: false,
        title: data.title,
        html: data.html,
        recordId: record.id,
      });
    } catch (error) {
      if (previewRequests.current !== requestId) return;
      setPagePreview({
        open: true,
        loading: false,
        title: fallbackTitle || "Page preview",
        html: "",
        recordId: record.id,
        error: error instanceof Error ? error.message : "The page preview could not be loaded.",
      });
    }
  }

  function closePagePreview() {
    previewRequests.current += 1;
    setPagePreview(emptyPagePreview);
  }

  function continueFromPreview(record: PageRecord) {
    closePagePreview();
    void buildWordPressDraft(record);
  }

  async function generateImageForReview(record: PageRecord) {
    if (!googleDocId(record)) {
      setNotice("The approved Google Doc is missing.");
      return;
    }
    if (record.pendingImageUrl) {
      const confirmed = window.confirm(
        `Generate another featured image for “${recordTitle(record)}”?\n\nThe current preview will be replaced in AMPLIFY. Nothing will be sent to WordPress.`,
      );
      if (!confirmed) return;
    }
    setGeneratingImage(record.id);
    setNotice(null);
    updateRecord(record.id, { error: undefined });
    try {
      const response = await fetch("/api/image-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          clientId: record.clientId,
          website: record.website,
          docId: googleDocId(record),
          title: recordTitle(record),
          practiceArea: record.blogPracticeArea || record.practiceArea,
          primaryKeyword: record.primaryKeyword,
          jurisdiction: record.jurisdiction || formatLocation(record.city, record.state),
          workflow: record.workflow || "create",
        }),
      });
      const data = await readApiResponse(response);
      if (data.ok !== true || typeof data.reviewId !== "string" || typeof data.imageUrl !== "string") {
        throw new Error("AMPLIFY did not return an image preview.");
      }
      updateRecord(record.id, {
        pendingImageReviewId: data.reviewId,
        pendingImageUrl: data.imageUrl,
        featuredImageApproved: false,
        featuredImageReviewRequired: true,
        error: undefined,
      });
      setNotice(`The image for “${recordTitle(record)}” is ready for your review. Nothing has been sent to WordPress.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The featured image could not be generated.";
      updateRecord(record.id, { error: message });
      setNotice(message);
    } finally {
      setGeneratingImage((current) => current === record.id ? null : current);
    }
  }

  async function approveFeaturedImage(record: PageRecord) {
    const hasPendingReview = Boolean(record.pendingImageReviewId && record.pendingImageUrl);
    const hasWordPressDraftImage = Boolean(
      record.featuredImageUrl
      && record.wordpressPageId
      && (record.wordpressStatus === "draft" || record.wordpressStatus === "pending"),
    );
    if (!hasPendingReview && !hasWordPressDraftImage) {
      setNotice("Generate an image preview in AMPLIFY first.");
      return;
    }
    setApprovingImage(record.id);
    setNotice(null);
    try {
      if (hasPendingReview) {
        const response = await fetch("/api/image-review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "approve",
            reviewId: record.pendingImageReviewId,
            clientId: record.clientId,
            docId: googleDocId(record),
          }),
        });
        const data = await readApiResponse(response);
        if (data.ok !== true) throw new Error("AMPLIFY did not save the image approval.");
      }
      updateRecord(record.id, {
        featuredImageApproved: true,
        featuredImageReviewRequired: false,
        error: undefined,
      });
      setNotice(hasWordPressDraftImage
        ? `The featured image for “${recordTitle(record)}” is approved for final publishing.`
        : `The featured image for “${recordTitle(record)}” is approved. You can now send the content and image to WordPress as a draft.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The image approval could not be saved.";
      updateRecord(record.id, { error: message });
      setNotice(message);
    } finally {
      setApprovingImage((current) => current === record.id ? null : current);
    }
  }

  async function assignBlogToSchedule(record: PageRecord, returnPublishedPostToDraft = false) {
    if (!isBlog(record) || !record.clientId || !record.wordpressPageId) {
      setNotice("The approved WordPress blog draft must be ready before it can be added to a schedule.");
      return;
    }
    const confirmed = window.confirm(
      returnPublishedPostToDraft
        ? `Move this live blog into ${record.clientName || "the client"}’s publishing schedule?\n\n${recordTitle(record)}\n\nThis will take the post offline now, preserve it as a WordPress draft, and reserve the client’s next open publishing date. You will still give final approval before WordPress schedules it.`
        : `Add this approved blog draft to ${record.clientName || "the client"}’s next open publishing date?\n\n${recordTitle(record)}\n\nIt will remain a WordPress draft until you give final approval.`,
    );
    if (!confirmed) return;

    setSchedulingBlog(record.id);
    setNotice(null);
    let isDraft = record.wordpressStatus === "draft";
    try {
      if (returnPublishedPostToDraft || record.published || record.wordpressStatus === "publish" || record.wordpressStatus === "future") {
        const draftResponse = await fetch("/api/wordpress/revert-blog-to-draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId: record.clientId,
            postId: record.wordpressPageId,
            ownerConfirmed: true,
          }),
        });
        const draftData = await readApiResponse(draftResponse);
        if (draftData.ok !== true || draftData.status !== "draft") {
          throw new Error("WordPress did not confirm that the blog is back in draft status.");
        }
        isDraft = true;
        updateRecord(record.id, {
          published: false,
          status: "ready",
          wordpressStatus: "draft",
          wordpressUrl: typeof draftData.postUrl === "string" ? draftData.postUrl : record.wordpressUrl,
          wordpressEditUrl: typeof draftData.editUrl === "string" ? draftData.editUrl : record.wordpressEditUrl,
          wordpressPreviewUrl: typeof draftData.previewUrl === "string" ? draftData.previewUrl : record.wordpressPreviewUrl,
          wordpressPublishedAt: undefined,
          scheduledPublishAt: undefined,
          ownerApprovedAt: undefined,
          error: undefined,
        });
      }

      const scheduleResponse = await fetch("/api/editorial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign_existing_content",
          clientId: record.clientId,
          contentRecordId: record.id,
          selectedTopic: recordTitle(record),
          practiceArea: record.blogPracticeArea || record.practiceArea,
        }),
      });
      const scheduleData = await readApiResponse(scheduleResponse);
      const slot = scheduleData.slot as { id?: string; publishAt?: string } | undefined;
      if (scheduleData.ok !== true || !slot?.id || !slot.publishAt) {
        throw new Error("The editorial calendar did not confirm a publishing slot.");
      }
      updateRecord(record.id, {
        published: false,
        status: "ready",
        wordpressStatus: isDraft ? "draft" : record.wordpressStatus,
        editorialSlotId: slot.id,
        scheduledPublishAt: slot.publishAt,
        wordpressPublishedAt: undefined,
        ownerApprovedAt: undefined,
        error: undefined,
      });
      setNotice(
        `${recordTitle(record)} is a WordPress draft reserved for ${new Date(slot.publishAt).toLocaleString([], { dateStyle: "full", timeStyle: "short" })}. Review it, then use “Approve & schedule blog” for final approval.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "The blog could not be added to the schedule.";
      updateRecord(record.id, {
        ...(isDraft ? {
          published: false,
          status: "ready" as const,
          wordpressStatus: "draft",
          wordpressPublishedAt: undefined,
          ownerApprovedAt: undefined,
        } : {}),
        error: message,
      });
      setNotice(message);
    } finally {
      setSchedulingBlog((current) => current === record.id ? null : current);
    }
  }

  async function approveAndPublishLive(record: PageRecord) {
    if (!finalApprovalReady(record)) { setNotice("Finish WordPress preparation before final approval."); return; }
    if (record.featuredImageUrl && record.featuredImageApproved !== true) {
      setNotice("Review the featured image on this card and click “Approve image” before final publishing.");
      return;
    }
    const docId = googleDocId(record);
    if (!docId || !record.wordpressPageId || record.wordpressStatus !== "draft") {
      setNotice("The approved WordPress draft must be ready before it can go live.");
      return;
    }
    const scheduledDate = isBlog(record) && record.scheduledPublishAt
      ? new Date(record.scheduledPublishAt)
      : null;
    let blogPlan;
    try {
      blogPlan = isBlog(record) ? blogPublicationPlan(record.scheduledPublishAt) : null;
    } catch {
      setNotice("The assigned publishing date is invalid. Correct the calendar date before final approval.");
      return;
    }
    const willSchedule = blogPlan?.status === "future";
    const imageApprovalConfirmation = record.featuredImageUrl
      ? "\n\nBy continuing, you confirm that you reviewed and approved the featured image."
      : "";
    const confirmed = window.confirm(
      isEnhancement(record)
        ? `Final approval: replace the existing page with this approved review copy?\n\n${record.pageUrl || record.website}\n\nThe original URL will stay the same. AMPLIFY will save a backup, transfer the content, CTAs, featured image, title, metadata, alt text, and schema, then remove the private review copy.${imageApprovalConfirmation}`
        : willSchedule
          ? `Final approval: schedule this approved WordPress blog?\n\n${recordTitle(record)}\n\nPublishing date: ${scheduledDate!.toLocaleString([], { dateStyle: "full", timeStyle: "short" })}${imageApprovalConfirmation}`
          : blogPlan?.overdue
            ? `Final approval: publish this overdue blog now?\n\n${recordTitle(record)}\n\nIts assigned publishing date has passed. Your approval will publish it immediately with today's date.${imageApprovalConfirmation}`
          : `Final approval: publish this WordPress ${isBlog(record) ? "post " : ""}draft live now?\n\n${recordTitle(record)}${imageApprovalConfirmation}`,
    );
    if (!confirmed) return;

    setPublishingLive(record.id);
    setNotice(null);
    try {
      const response = await fetch("/api/wordpress/go-live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: record.clientId,
          pageId: record.wordpressPageId,
          docId,
          ownerApproved: true,
          workflow: record.workflow,
          publishAt: isBlog(record) ? record.scheduledPublishAt : undefined,
        }),
      });
      const data = await readApiResponse(response);
      const scheduled = data.status === "future";
      if (data.ok !== true || (!scheduled && data.status !== "publish")) {
        throw new Error(willSchedule
          ? "WordPress did not confirm that the blog is scheduled."
          : "WordPress did not confirm that the page is live.");
      }
      updateRecord(record.id, {
        published: !scheduled,
        status: scheduled ? "ready" : "published",
        wordpressStatus: scheduled ? "future" : "publish",
        wordpressPageId: typeof data.pageId === "number" ? data.pageId : record.wordpressPageId,
        wordpressUrl: typeof data.pageUrl === "string" ? data.pageUrl : record.wordpressUrl,
        wordpressEditUrl: typeof data.editUrl === "string" ? data.editUrl : record.wordpressEditUrl,
        wordpressPreviewUrl: undefined,
        wordpressBackupId: typeof data.backupId === "string" ? data.backupId : record.wordpressBackupId,
        wordpressPublishedAt: scheduled
          ? undefined
          : typeof data.publishedAt === "string" ? data.publishedAt : new Date().toISOString(),
        scheduledPublishAt: scheduled && typeof data.scheduledAt === "string"
          ? data.scheduledAt
          : scheduled ? record.scheduledPublishAt : undefined,
        ownerApprovedAt: new Date().toISOString(),
        featuredImageReviewRequired: false,
        error: undefined,
      });
      void syncEditorialStatus(record.editorialSlotId, scheduled ? "scheduled" : "published");
      const cleanupWarning = typeof data.cleanupWarning === "string" ? ` ${data.cleanupWarning}` : "";
      setNotice(scheduled
        ? `Your final approval was recorded. WordPress will publish the blog on ${new Date((data.scheduledAt as string) || record.scheduledPublishAt || "").toLocaleString([], { dateStyle: "full", timeStyle: "short" })}.`
        : isEnhancement(record)
          ? `The approved enhancement is live at the original URL. The original page was backed up first.${cleanupWarning}`
          : "Your final approval was recorded. The page is now live on WordPress.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "The WordPress draft could not be published.";
      updateRecord(record.id, { error: message });
      setNotice(message);
    } finally {
      setPublishingLive((current) => current === record.id ? null : current);
    }
  }

  async function syncGeoDirectory(record: PageRecord) {
    if (!record.wordpressPageId) {
      setNotice("The WordPress GEO page is missing.");
      return;
    }
    setSyncingDirectory(record.id);
    setNotice(null);
    try {
      const response = await fetch("/api/wordpress/sync-directory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: record.clientId, pageId: record.wordpressPageId }),
      });
      const data = await readApiResponse(response);
      if (data.ok !== true) throw new Error("WordPress did not confirm the GEO directory links.");
      const count = typeof data.directoryPagesLinked === "number" ? data.directoryPagesLinked : 0;
      setNotice(`City links synchronized across ${count || "the"} live campaign page${count === 1 ? "" : "s"}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The GEO directory links could not be synchronized.");
    } finally {
      setSyncingDirectory((current) => current === record.id ? null : current);
    }
  }

  function resetUnfinishedRecords() {
    if (!unfinishedCount) return;
    const confirmed = window.confirm(
      `Clear ${unfinishedCount} unfinished page${unfinishedCount === 1 ? "" : "s"} from the tracker?`,
    );
    if (!confirmed) return;

    pollingJobs.current.clear();
    startingBulkJob.current = null;
    setCreating(false);
    setRecords((current) => current.filter((record) => !isStalledRecord(record)));
    setNotice(`${unfinishedCount} unfinished page${unfinishedCount === 1 ? " was" : "s were"} cleared. The queue is reset.`);
  }

  async function createPage(event: FormEvent) {
    event.preventDefault();
    setNotice(null);

    if (!google.connected) {
      if (google.configured) router.push("/api/google/connect");
      else setNotice("Connect Google after its Vercel environment settings are added.");
      return;
    }

    const id = crypto.randomUUID();
    const submittedForm = {
      ...form,
      city: form.city.trim(),
      state: stateAbbreviation(form.state),
    };
    const selectedClient = clients.find((client) => client.id === submittedForm.clientId);
    if (!selectedClient) {
      setNotice("Choose a configured client before creating the page.");
      return;
    }
    const pending: PageRecord = {
      id,
      workflow: "create",
      ...submittedForm,
      clientId: selectedClient.id,
      clientName: selectedClient.name,
      status: "generating",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      aronDone: false,
      published: false,
    };
    setRecords((current) => [pending, ...current]);
    setCreating(true);
    setShowForm(false);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Idempotency-Key": id, "Content-Type": "application/json" },
        body: JSON.stringify(submittedForm),
      });
      const data = await readApiResponse(response);
      if (typeof data.jobId !== "string") {
        throw new Error("The research job could not be started. Please try again.");
      }

      updateRecord(id, {
        jobId: data.jobId,
        status: "generating",
        error: undefined,
      });
      setForm({
        clientId: submittedForm.clientId,
        website: submittedForm.website,
        practiceArea: submittedForm.practiceArea,
        city: "",
        state: submittedForm.state,
        notes: "",
      });
      setNotice("Research started. You can leave this page and come back later.");
    } catch (error) {
      updateRecord(id, {
        status: "error",
        error: error instanceof Error ? error.message : "The page could not be created.",
      });
      setNotice(error instanceof Error ? error.message : "The page could not be created.");
    } finally {
      setCreating(false);
    }
  }

  async function createBlog(event: FormEvent) {
    event.preventDefault();
    setNotice(null);

    if (!google.connected) {
      if (google.configured) router.push("/api/google/connect");
      else setNotice("Connect Google after its Vercel environment settings are added.");
      return;
    }

    const submittedForm = {
      ...blogForm,
      topic: blogForm.topic.trim(),
      primaryKeyword: blogForm.primaryKeyword.trim(),
      jurisdiction: blogForm.jurisdiction.trim(),
    };
    const selectedQuestion = topicQuestions.find((item) => item.question === submittedForm.topic);
    const relatedQuestions = selectedQuestion
      ? topicQuestions
          .filter((item) => item.cluster === selectedQuestion.cluster && item.question !== selectedQuestion.question)
          .map((item) => item.question)
          .slice(0, 12)
      : [];
    const selectedClient = clients.find((client) => client.id === submittedForm.clientId);
    if (!selectedClient) {
      setNotice("Choose a configured client before creating the blog.");
      return;
    }

    submittedForm.website = selectedClient.website;
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const pending: PageRecord = {
      id,
      workflow: "blog",
      clientId: selectedClient.id,
      clientName: selectedClient.name,
      website: submittedForm.website,
      practiceArea: submittedForm.topic,
      city: "",
      state: "",
      primaryKeyword: submittedForm.primaryKeyword,
      jurisdiction: submittedForm.jurisdiction,
      blogPracticeArea: submittedForm.practiceArea,
      authorityAttorney: submittedForm.authorityAttorney,
      relatedQuestions,
      notes: submittedForm.notes,
      editorialSlotId: submittedForm.editorialSlotId || undefined,
      scheduledPublishAt: submittedForm.scheduledPublishAt || undefined,
      status: "generating",
      createdAt: timestamp,
      updatedAt: timestamp,
      aronDone: false,
      published: false,
    };
    setRecords((current) => [pending, ...current]);
    setCreating(true);
    setShowForm(false);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Idempotency-Key": id, "Content-Type": "application/json" },
        body: JSON.stringify({ workflow: "blog", ...submittedForm, relatedQuestions }),
      });
      const data = await readApiResponse(response);
      if (typeof data.jobId !== "string") {
        throw new Error("The blog research job could not be started. Please try again.");
      }
      updateRecord(id, { jobId: data.jobId, status: "generating", error: undefined });
      if (submittedForm.editorialSlotId) {
        const linkResponse = await fetch("/api/editorial", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "link_content",
            slotId: submittedForm.editorialSlotId,
            contentRecordId: id,
            generationJobId: data.jobId,
          }),
        });
        await readApiResponse(linkResponse);
      }
      setBlogForm({
        ...emptyBlogForm,
        clientId: selectedClient.id,
        website: selectedClient.website,
        practiceArea: submittedForm.practiceArea,
        jurisdiction: submittedForm.jurisdiction,
      });
      setTopicQuestions([]);
      setNotice("Blog research started. You can leave this page and come back later.");
    } catch (error) {
      updateRecord(id, {
        status: "error",
        error: error instanceof Error ? error.message : "The blog could not be created.",
      });
      setNotice(error instanceof Error ? error.message : "The blog could not be created.");
    } finally {
      setCreating(false);
    }
  }

  async function createAopPage(event: FormEvent) {
    event.preventDefault();
    setNotice(null);

    if (!google.connected) {
      if (google.configured) router.push("/api/google/connect");
      else setNotice("Connect Google after its Vercel environment settings are added.");
      return;
    }

    const submittedForm = {
      ...aopForm,
      practiceArea: aopForm.practiceArea.trim(),
      primaryKeyword: aopForm.primaryKeyword.trim(),
      jurisdiction: aopForm.jurisdiction.trim(),
      notes: aopForm.notes.trim(),
    };
    const selectedClient = clients.find((client) => client.id === submittedForm.clientId);
    if (!selectedClient) {
      setNotice("Choose a configured client before creating the Area of Practice page.");
      return;
    }

    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const pending: PageRecord = {
      id,
      workflow: "aop",
      clientId: selectedClient.id,
      clientName: selectedClient.name,
      website: submittedForm.website,
      practiceArea: submittedForm.practiceArea,
      city: "",
      state: "",
      primaryKeyword: submittedForm.primaryKeyword,
      jurisdiction: submittedForm.jurisdiction,
      notes: submittedForm.notes,
      status: "generating",
      createdAt: timestamp,
      updatedAt: timestamp,
      aronDone: false,
      published: false,
    };
    setRecords((current) => [pending, ...current]);
    setCreating(true);
    setShowForm(false);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Idempotency-Key": id, "Content-Type": "application/json" },
        body: JSON.stringify({ workflow: "aop", ...submittedForm }),
      });
      const data = await readApiResponse(response);
      if (typeof data.jobId !== "string") {
        throw new Error("The Area of Practice research job could not be started. Please try again.");
      }
      updateRecord(id, { jobId: data.jobId, status: "generating", error: undefined });
      setAopForm({
        ...emptyAopForm,
        clientId: selectedClient.id,
        website: selectedClient.website,
        jurisdiction: submittedForm.jurisdiction,
      });
      setNotice("Area of Practice research started. You can leave this page and come back later.");
    } catch (error) {
      updateRecord(id, {
        status: "error",
        error: error instanceof Error ? error.message : "The Area of Practice page could not be created.",
      });
      setNotice(error instanceof Error ? error.message : "The Area of Practice page could not be created.");
    } finally {
      setCreating(false);
    }
  }

  async function createSubAopPage(event: FormEvent) {
    event.preventDefault();
    setNotice(null);

    if (!google.connected) {
      if (google.configured) router.push("/api/google/connect");
      else setNotice("Connect Google after its Vercel environment settings are added.");
      return;
    }

    const submittedForm = {
      ...subAopForm,
      parentPracticeArea: subAopForm.parentPracticeArea.trim(),
      practiceArea: subAopForm.practiceArea.trim(),
      primaryKeyword: subAopForm.primaryKeyword.trim(),
      jurisdiction: subAopForm.jurisdiction.trim(),
      notes: subAopForm.notes.trim(),
    };
    const selectedClient = clients.find((client) => client.id === submittedForm.clientId);
    if (!selectedClient) {
      setNotice("Choose a configured client before creating the Sub-AOP page.");
      return;
    }
    if (!submittedForm.parentPracticeArea || !submittedForm.practiceArea) {
      setNotice("Choose the published parent AOP and enter the narrower Sub-AOP service.");
      return;
    }
    if (submittedForm.parentPracticeArea.toLowerCase() === submittedForm.practiceArea.toLowerCase()) {
      setNotice("The Sub-AOP must be narrower than—and named differently from—the parent AOP.");
      return;
    }

    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const pending: PageRecord = {
      id,
      workflow: "subaop",
      clientId: selectedClient.id,
      clientName: selectedClient.name,
      website: submittedForm.website,
      parentPracticeArea: submittedForm.parentPracticeArea,
      practiceArea: submittedForm.practiceArea,
      city: "",
      state: "",
      primaryKeyword: submittedForm.primaryKeyword,
      jurisdiction: submittedForm.jurisdiction,
      notes: submittedForm.notes,
      status: "generating",
      createdAt: timestamp,
      updatedAt: timestamp,
      aronDone: false,
      published: false,
    };
    setRecords((current) => [pending, ...current]);
    setCreating(true);
    setShowForm(false);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Idempotency-Key": id, "Content-Type": "application/json" },
        body: JSON.stringify({ workflow: "subaop", ...submittedForm }),
      });
      const data = await readApiResponse(response);
      if (typeof data.jobId !== "string") {
        throw new Error("The Sub-AOP research job could not be started. Please try again.");
      }
      updateRecord(id, { jobId: data.jobId, status: "generating", error: undefined });
      setSubAopForm({
        ...emptySubAopForm,
        clientId: selectedClient.id,
        website: selectedClient.website,
        parentPracticeArea: submittedForm.parentPracticeArea,
        jurisdiction: submittedForm.jurisdiction,
      });
      setNotice("Sub-AOP research started. You can leave this page and come back later.");
    } catch (error) {
      updateRecord(id, {
        status: "error",
        error: error instanceof Error ? error.message : "The Sub-AOP page could not be created.",
      });
      setNotice(error instanceof Error ? error.message : "The Sub-AOP page could not be created.");
    } finally {
      setCreating(false);
    }
  }

  function pendingEnhancement(id: string, input: EnhanceInput): PageRecord {
    const timestamp = new Date().toISOString();
    return {
      id,
      workflow: "enhance",
      clientId: input.clientId,
      clientName: clients.find((client) => client.id === input.clientId)?.name,
      website: input.pageUrl,
      pageUrl: input.pageUrl,
      practiceArea: "Existing page enhancement",
      city: "",
      state: "",
      notes: input.notes,
      status: "generating",
      createdAt: timestamp,
      updatedAt: timestamp,
      aronDone: false,
      published: false,
    };
  }

  const queueEnhancement = useCallback(
    async (id: string, input: EnhanceInput) => {
      try {
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { "Idempotency-Key": id, "Content-Type": "application/json" },
          body: JSON.stringify({
            workflow: "enhance",
            clientId: input.clientId,
            pageUrl: input.pageUrl,
            notes: input.notes,
          }),
        });
        const data = await readApiResponse(response);
        if (typeof data.jobId !== "string") {
          throw new Error("The enhancement job could not be started. Please try again.");
        }

        updateRecord(id, {
          jobId: data.jobId,
          status: "generating",
          error: undefined,
        });
        return null;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "The page could not be enhanced.";
        updateRecord(id, {
          status: "error",
          error: message,
        });
        return message;
      }
    },
    [updateRecord],
  );

  const queueGeoPage = useCallback(
    async (id: string, record: PageRecord) => {
      try {
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { "Idempotency-Key": id, "Content-Type": "application/json" },
          body: JSON.stringify({
            workflow: "create",
            clientId: record.clientId,
            website: record.website,
            practiceArea: record.practiceArea,
            city: record.city,
            state: record.state,
            notes: record.notes,
          }),
        });
        const data = await readApiResponse(response);
        if (typeof data.jobId !== "string") {
          throw new Error("The GEO child-page research job could not be started. Please try again.");
        }
        updateRecord(id, { jobId: data.jobId, status: "generating", error: undefined });
        return null;
      } catch (error) {
        const message = error instanceof Error ? error.message : "The GEO child page could not be created.";
        updateRecord(id, { status: "error", error: message });
        return message;
      }
    },
    [updateRecord],
  );

  useEffect(() => {
    if (!hydrated || !google.connected || !cloudReady || !stalledResetComplete) return;
    if (startingBulkJob.current) return;

    const activeBulkJob = records.some(
      (record) => record.bulkBatchId && record.status === "generating",
    );
    if (activeBulkJob) return;

    const next = records
      .filter((record) => record.bulkBatchId && authorizedBulkBatches.includes(record.bulkBatchId) && record.status === "queued")
      .sort((a, b) => {
        const created = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        return created || (a.bulkPosition || 0) - (b.bulkPosition || 0);
      })[0];
    if (!next) return;

    startingBulkJob.current = next.id;
    let started = false;
    const timeout = window.setTimeout(() => {
      started = true;
      const start = isEnhancement(next)
        ? queueEnhancement(next.id, {
            clientId: next.clientId || clients[0]?.id || "",
            pageUrl: next.pageUrl || next.website,
            notes: next.notes || "",
          })
        : queueGeoPage(next.id, next);
      void start.finally(() => {
        if (startingBulkJob.current === next.id) startingBulkJob.current = null;
      });
    }, 0);
    return () => {
      window.clearTimeout(timeout);
      if (!started && startingBulkJob.current === next.id) startingBulkJob.current = null;
    };
  }, [authorizedBulkBatches, clients, cloudReady, google.connected, hydrated, queueEnhancement, queueGeoPage, records, stalledResetComplete]);

  async function enhancePage(event: FormEvent) {
    event.preventDefault();
    setNotice(null);

    if (!google.connected) {
      if (google.configured) router.push("/api/google/connect");
      else setNotice("Connect Google after its Vercel environment settings are added.");
      return;
    }

    const id = crypto.randomUUID();
    const submittedForm = { ...enhanceForm };
    setRecords((current) => [pendingEnhancement(id, submittedForm), ...current]);
    setCreating(true);
    setShowForm(false);

    const error = await queueEnhancement(id, submittedForm);
    if (error) {
      setNotice(error);
    } else {
      setEnhanceForm((current) => ({ ...emptyEnhanceForm, clientId: current.clientId }));
      setNotice("Page enhancement started. You can leave this page and come back later.");
    }
    setCreating(false);
  }

  function enhanceBulkPages(event: FormEvent) {
    event.preventDefault();
    setNotice(null);

    if (!google.connected) {
      if (google.configured) router.push("/api/google/connect");
      else setNotice("Connect Google after its Vercel environment settings are added.");
      return;
    }

    if (!bulkImport.urls.length) {
      setNotice("Paste a list of full page URLs or upload a CSV or TXT file.");
      return;
    }

    const bulkBatchId = crypto.randomUUID();
    setAuthorizedBulkBatches(current => [...current, bulkBatchId]);
    const submissions = bulkImport.urls.map((pageUrl) => ({
      id: crypto.randomUUID(),
      input: { clientId: enhanceForm.clientId, pageUrl, notes: enhanceForm.notes },
    }));
    setRecords((current) => [
      ...submissions.map(({ id, input }, index) => ({
        ...pendingEnhancement(id, input),
        status: "queued" as const,
        bulkBatchId,
        bulkPosition: index,
      })),
      ...current,
    ]);
    setShowForm(false);
    setEnhanceForm((current) => ({ ...emptyEnhanceForm, clientId: current.clientId }));
    setBulkUrlText("");
    setBulkImport(emptyBulkImport);
    setNotice(
      `${submissions.length} page${submissions.length === 1 ? "" : "s"} added. They will be enhanced one at a time in the order listed.`,
    );
  }

  function queueBillyGeoChildCampaign() {
    setNotice(null);
    if (!google.connected) {
      if (google.configured) router.push("/api/google/connect");
      else setNotice("Connect Google after its Vercel environment settings are added.");
      return;
    }

    const selectedClient = clients.find((client) => client.id === "billy-cooper-law");
    if (!selectedClient) {
      setNotice("Billy Cooper Law must be configured in Client Connections before this campaign can start.");
      return;
    }

    const existingKeys = new Set(records.map((record) =>
      `${record.clientId || ""}|${record.city.toLowerCase()}|${record.practiceArea.toLowerCase()}`,
    ));
    const missing = BILLY_GEO_CHILD_CAMPAIGN.filter((item) => {
      if (item.existingPageId) return false;
      return !existingKeys.has(`billy-cooper-law|${item.location.toLowerCase()}|${item.practiceArea.toLowerCase()}`);
    });
    if (!missing.length) {
      setNotice("Every missing Billy Cooper GEO child page is already in the tracker or live on WordPress.");
      return;
    }

    const confirmed = window.confirm(
      `Queue ${missing.length} missing Billy Cooper GEO child page${missing.length === 1 ? "" : "s"}?\n\nThe campaign uses the first five local markets inside each of the six county pages. Every location receives E-Bike Accident, Car Accident, and Slip and Fall pages. Existing live pages are skipped. AMPLIFY will research and create the Google Docs one at a time, then share each with Aron.`,
    );
    if (!confirmed) return;

    const bulkBatchId = crypto.randomUUID();
    setAuthorizedBulkBatches(current => [...current, bulkBatchId]);
    const createdAt = new Date().toISOString();
    const queued = missing.map((item, index): PageRecord => ({
      id: crypto.randomUUID(),
      workflow: "create",
      campaignKind: "billy-geo-child",
      campaignCounty: item.county,
      bulkBatchId,
      bulkPosition: index,
      clientId: selectedClient.id,
      clientName: selectedClient.name,
      website: selectedClient.website,
      practiceArea: item.practiceArea,
      primaryKeyword: item.primaryKeyword,
      city: item.location,
      state: "NY",
      notes: item.notes,
      parentId: item.pageId,
      parentPageTitle: `${item.location} Personal Injury`,
      parentPageUrl: item.pageUrl,
      status: "queued",
      createdAt,
      updatedAt: createdAt,
      aronDone: false,
      published: false,
    }));
    setRecords((current) => [...queued, ...current]);
    setShowForm(false);
    setNotice(
      `${queued.length} missing child page${queued.length === 1 ? "" : "s"} queued across ${BILLY_GEO_CHILD_PARENTS.length} local parent pages. AMPLIFY will build them one at a time and share each Google Doc with Aron.`,
    );
  }

  async function retryRecord(record: PageRecord) {
    if (record.campaignKind === "billy-geo-child") {
      updateRecord(record.id, {
        status: "queued",
        jobId: undefined,
        error: undefined,
        updatedAt: new Date().toISOString(),
      });
      setNotice(`${recordTitle(record)} returned to the one-at-a-time campaign queue.`);
      return;
    }
    if (isBlog(record)) {
      setBlogForm({
        clientId: record.clientId || clients[0]?.id || "",
        website: record.website,
        practiceArea: record.blogPracticeArea || "",
        authorityAttorney: record.authorityAttorney || "",
        topic: record.practiceArea,
        primaryKeyword: record.primaryKeyword || "",
        jurisdiction: record.jurisdiction || "",
        notes: record.notes || "",
        editorialSlotId: record.editorialSlotId || "",
        scheduledPublishAt: record.scheduledPublishAt || "",
      });
      setActiveWorkflow("blog");
      setRecords((current) => current.filter((item) => item.id !== record.id));
      setShowForm(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (isAop(record)) {
      setAopForm({
        clientId: record.clientId || clients[0]?.id || "",
        website: record.website,
        practiceArea: record.practiceArea,
        primaryKeyword: record.primaryKeyword || "",
        jurisdiction: record.jurisdiction || "",
        notes: record.notes || "",
      });
      setActiveWorkflow("aop");
      setRecords((current) => current.filter((item) => item.id !== record.id));
      setShowForm(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (isSubAop(record)) {
      setSubAopForm({
        clientId: record.clientId || clients[0]?.id || "",
        website: record.website,
        parentPracticeArea: record.parentPracticeArea || "",
        practiceArea: record.practiceArea,
        primaryKeyword: record.primaryKeyword || "",
        jurisdiction: record.jurisdiction || "",
        notes: record.notes || "",
      });
      setActiveWorkflow("subaop");
      setRecords((current) => current.filter((item) => item.id !== record.id));
      setShowForm(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (isEnhancement(record)) {
      setEnhanceForm({
        clientId: record.clientId || clients[0]?.id || "",
        pageUrl: record.pageUrl || record.website,
        notes: record.notes || "",
      });
      setActiveWorkflow("enhance");
      setRecords((current) => current.filter((item) => item.id !== record.id));
      setShowForm(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setForm({
      clientId: record.clientId || clients[0]?.id || "",
      website: record.website,
      practiceArea: record.practiceArea,
      city: record.city,
      state: record.state,
      notes: record.notes || "",
    });
    setRecords((current) => current.filter((item) => item.id !== record.id));
    setActiveWorkflow("create");
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function disconnectGoogle() {
    await fetch("/api/google/disconnect", { method: "POST" });
    setGoogle((current) => ({ ...current, connected: false, email: null }));
    setCloudReady(false);
    setNotice("Google Drive disconnected.");
  }

  function renderFeaturedImageReview(record: PageRecord) {
    const imageUrl = record.pendingImageUrl || record.featuredImageUrl;
    if (!imageUrl) return null;
    const generating = generatingImage === record.id;
    const approving = approvingImage === record.id;
    const imageIsInWordPress = Boolean(record.featuredImageUrl && record.wordpressPageId);
    const imageAutoVerified = imageIsInWordPress && record.featuredImageReviewRequired === false;
    const imageApproved = record.featuredImageApproved === true || imageAutoVerified;
    const canApprove = Boolean(
      (record.pendingImageReviewId && record.pendingImageUrl)
      || (
        imageIsInWordPress
        && (record.wordpressStatus === "draft" || record.wordpressStatus === "pending")
      ),
    );
    return (
      <div className="featured-image-review-card">
        <a href={imageUrl} target="_blank" rel="noreferrer" className="featured-image-preview-link">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt={`Generated featured image for ${recordTitle(record)}`} className="featured-image-preview" />
        </a>
        <div className="featured-image-review-copy">
          <strong>Featured image preview</strong>
          <span>{imageAutoVerified
            ? "Verified by AMPLIFY and attached to the WordPress draft."
            : record.featuredImageApproved
              ? "Approved by you. It is cleared for the next publishing step."
            : imageIsInWordPress
              ? "Review the image attached to this WordPress draft, then approve it for final publishing."
              : "Review this image here. Nothing is sent to WordPress until you approve it."}</span>
          <div className="featured-image-review-actions">
            <button
              type="button"
              className={imageApproved ? "secondary-button compact" : "primary-button compact"}
              onClick={() => void approveFeaturedImage(record)}
              disabled={!canApprove || imageApproved || generating || approving || publishingToWordPress === record.id}
            >
              {approving
                ? <><LoaderCircle className="spin" size={14} /> Saving approval…</>
                : <><Check size={14} /> {imageAutoVerified ? "Image verified" : record.featuredImageApproved ? "Image approved" : "Approve image"}</>}
            </button>
            <button
              type="button"
              className="secondary-button compact"
              onClick={() => void generateImageForReview(record)}
              disabled={generating || approving || publishingToWordPress === record.id}
            >
              {generating
                ? <><LoaderCircle className="spin" size={14} /> Generating…</>
                : <><RotateCcw size={14} /> Generate another image</>}
            </button>
            <a href={imageUrl} target="_blank" rel="noreferrer" className="check-item checked">
              Open full image <ArrowUpRight size={13} />
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="app-shell">
      <a href="/ai-controls">AI pause controls</a>
      {records.some(record => record.status === "queued" && record.bulkBatchId && !authorizedBulkBatches.includes(record.bulkBatchId)) &&
        <button type="button" onClick={() => setAuthorizedBulkBatches([...new Set(records.filter(record => record.status === "queued").map(record => record.bulkBatchId).filter((id): id is string => Boolean(id)))])}>Resume queued AI jobs</button>}

      <header className="topbar">
        <a className="brand" href="#top" aria-label="AMPLIFY Content home">
          <span className="brand-mark">A</span>
          <span className="brand-word">AMPLIFY</span>
          <span className="brand-product">Content</span>
        </a>
        <div className="topbar-actions"><a className="primary-button compact" href="/attention">Needs attention</a>
          <a className="secondary-button compact" href="/published"><Globe2 size={15} /> Published</a>
          <a className="secondary-button compact" href="/editorial-calendar">
            <CalendarDays size={15} /> Calendar
          </a>
          <a className="secondary-button compact" href="/aron">
            <UserRoundCheck size={15} /> Aron review
          </a>
          <a className="secondary-button compact" href="/clients">
            <Settings2 size={15} /> Clients
          </a>
          <span className={`connection-pill ${google.connected ? "is-connected" : ""}`}>
            <span className="connection-dot" />
            {google.loading
              ? "Checking Google"
              : google.connected
                ? google.email || "Google connected"
                : "Google not connected"}
          </span>
          {google.connected ? (
            <button className="icon-button" onClick={disconnectGoogle} title="Disconnect Google">
              <LogOut size={17} />
            </button>
          ) : (
            <a className="secondary-button compact" href="/api/google/connect">
              Connect Google
            </a>
          )}
        </div>
      </header>

      <div className="page" id="top">
        <section className="hero">
          <div>
            <p className="eyebrow"><Sparkles size={14} /> Legal content workflow</p>
            <h1>Legal content,<br />ready for review.</h1>
            <p className="hero-copy">
              Create GEO, AOP, and Sub-AOP pages, enhance existing content, or produce a researched blog. Every
              draft goes through Google Docs and Aron before WordPress.
            </p>
          </div>
          <div className="hero-actions">
            <button className="primary-button hero-button" onClick={() => openWorkflow("create")}>
              <Plus size={18} /> New geo page
            </button>
            <button className="secondary-button hero-button" onClick={() => openWorkflow("enhance")}>
              <Sparkles size={17} /> Enhance existing
            </button>
            <button className="secondary-button hero-button" onClick={() => openWorkflow("blog")}>
              <Newspaper size={17} /> New blog
            </button>
            <button className="secondary-button hero-button" onClick={() => openWorkflow("aop")}>
              <BriefcaseBusiness size={17} /> New AOP page
            </button>
            <button className="secondary-button hero-button" onClick={() => openWorkflow("subaop")}>
              <FileText size={17} /> New Sub-AOP page
            </button>
          </div>
        </section>

        {notice && (
          <div className="notice" role="status">
            <CheckCircle2 size={17} />
            <span>{notice}</span>
            <button onClick={() => setNotice(null)} aria-label="Dismiss message"><X size={16} /></button>
          </div>
        )}

        {activeClient && (
          !activeClient.wordpressReady ||
          (!wordpress.loading && !wordpress.connected)
        ) && (
          <div className="setup-notice" role="status">
            <ShieldCheck size={17} />
            <span>
              <strong>{activeClient.name} needs publishing setup.</strong>{" "}
              {!activeClient.wordpressReady
                ? "Add its WordPress credentials to the client profile."
                : wordpress.message || "WordPress could not be reached with the connected account."}
            </span>
          </div>
        )}

        {pagePreview.open && (
          <div className="page-preview-overlay" role="dialog" aria-modal="true" aria-label="Approved page preview">
            <header>
              <div className="page-preview-heading">
                <strong>{pagePreview.title}</strong>
                <span>Content and layout preview · WordPress is untouched · Use a private WordPress draft for the exact theme</span>
              </div>
              <div className="page-preview-actions">
                {previewRecord && !pagePreview.loading && !pagePreview.error && (
                  isEnhancement(previewRecord) ? (
                    previewRecord.published ? (
                      <a className="primary-button compact" href={previewRecord.wordpressUrl || previewRecord.pageUrl || previewRecord.website} target="_blank" rel="noreferrer">
                        Live at original URL <ArrowUpRight size={13} />
                      </a>
                    ) : previewRecord.wordpressPageId && previewRecord.wordpressStatus === "draft" ? (
                      <button
                        className="primary-button compact"
                        type="button"
                        onClick={() => void approveAndPublishLive(previewRecord)}
                        disabled={publishingLive === previewRecord.id}
                      >
                        <Globe2 size={14} /> Approve &amp; update existing page
                      </button>
                    ) : (
                      <button
                        className="primary-button compact"
                        type="button"
                        onClick={() => continueFromPreview(previewRecord)}
                        disabled={publishingToWordPress === previewRecord.id}
                      >
                        <Globe2 size={14} /> Create private WP draft
                      </button>
                    )
                  ) : previewRecord.wordpressPageId && previewRecord.wordpressStatus === "draft" ? (
                    <a className="primary-button compact" href={wordPressPreviewUrl(previewRecord)} target="_blank" rel="noreferrer">
                      Preview in WordPress <ArrowUpRight size={13} />
                    </a>
                  ) : !previewRecord.published && (
                    <button
                      className="primary-button compact"
                      type="button"
                      onClick={() => continueFromPreview(previewRecord)}
                      disabled={publishingToWordPress === previewRecord.id}
                    >
                      <Globe2 size={14} /> Create private WP {isBlog(previewRecord) ? "post " : ""}draft
                    </button>
                  )
                )}
                <button className="secondary-button compact" type="button" onClick={closePagePreview}>
                  Close <X size={16} />
                </button>
              </div>
            </header>
            <div className="page-preview-body">
              {pagePreview.loading ? (
                <div className="preview-loading">
                  <LoaderCircle className="spin" size={26} />
                  <strong>Preparing the latest approved Google Doc…</strong>
                </div>
              ) : pagePreview.error ? (
                <div className="preview-loading preview-error">
                  <X size={25} />
                  <strong>{pagePreview.error}</strong>
                </div>
              ) : (
                <iframe
                  title={`Approved preview of ${pagePreview.title}`}
                  sandbox="allow-popups allow-popups-to-escape-sandbox"
                  srcDoc={previewDocument(pagePreview.title, pagePreview.html, previewRecord, previewClient)}
                />
              )}
            </div>
          </div>
        )}

        {reviewFeedbackDialog && (() => {
          const record = records.find((item) => item.id === reviewFeedbackDialog.recordId);
          return (
            <div className="review-feedback-overlay" role="presentation" onMouseDown={(event) => {
              if (event.currentTarget === event.target && !reviewFeedbackDialog.submitting) setReviewFeedbackDialog(null);
            }}>
              <form className="review-feedback-dialog" role="dialog" aria-modal="true" aria-labelledby="review-feedback-title" onSubmit={submitReviewFeedback}>
                <div className="review-feedback-heading">
                  <span><MessageSquareText size={18} /></span>
                  <div>
                    <p>Optional review loop</p>
                    <h2 id="review-feedback-title">Revise from Aron’s feedback</h2>
                  </div>
                </div>
                <p className="review-feedback-copy">Paste Aron’s requested changes. AMPLIFY will apply them to the complete draft, create a new Google Doc, and restart his approval step. The current Doc remains in Drive.</p>
                <label className="field">
                  <span>Feedback for {record ? recordTitle(record) : "this draft"}</span>
                  <textarea
                    rows={7}
                    autoFocus
                    maxLength={10_000}
                    placeholder="Example: Shorten the insurance section, use plainer language, and make the ending more confident and client-focused."
                    value={reviewFeedbackDialog.feedback}
                    onChange={(event) => setReviewFeedbackDialog((current) => current ? { ...current, feedback: event.target.value, error: undefined } : current)}
                  />
                </label>
                {reviewFeedbackDialog.error && <p className="review-feedback-error">{reviewFeedbackDialog.error}</p>}
                <div className="review-feedback-actions">
                  <button className="secondary-button" type="button" disabled={reviewFeedbackDialog.submitting} onClick={() => setReviewFeedbackDialog(null)}>Cancel</button>
                  <button className="primary-button" type="submit" disabled={reviewFeedbackDialog.submitting || reviewFeedbackDialog.feedback.trim().length < 5}>
                    {reviewFeedbackDialog.submitting ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}
                    {reviewFeedbackDialog.submitting ? "Starting revision…" : "Generate revised Google Doc"}
                  </button>
                </div>
              </form>
            </div>
          );
        })()}

        {showForm && (
          <div id="page-workflow">
            <div className="workflow-switch" role="tablist" aria-label="Choose a content workflow">
              <button
                type="button"
                role="tab"
                aria-selected={activeWorkflow === "create"}
                className={activeWorkflow === "create" ? "active" : ""}
                onClick={() => setActiveWorkflow("create")}
              >
                <Plus size={16} /> Create a new page
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeWorkflow === "enhance"}
                className={activeWorkflow === "enhance" ? "active" : ""}
                onClick={() => setActiveWorkflow("enhance")}
              >
                <Sparkles size={16} /> Enhance an existing page
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeWorkflow === "blog"}
                className={activeWorkflow === "blog" ? "active" : ""}
                onClick={() => setActiveWorkflow("blog")}
              >
                <Newspaper size={16} /> Create a blog
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeWorkflow === "aop"}
                className={activeWorkflow === "aop" ? "active" : ""}
                onClick={() => setActiveWorkflow("aop")}
              >
                <BriefcaseBusiness size={16} /> Create an AOP page
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeWorkflow === "subaop"}
                className={activeWorkflow === "subaop" ? "active" : ""}
                onClick={() => setActiveWorkflow("subaop")}
              >
                <FileText size={16} /> Create a Sub-AOP page
              </button>
            </div>

            {activeWorkflow === "create" ? (
              <section className="creator-card" aria-labelledby="create-title">
            <div className="creator-heading">
              <div>
                <span className="step-number">01</span>
                <div>
                  <h2 id="create-title">Start a new page</h2>
                  <p>The master prompt is built in, and repeat details are remembered.</p>
                </div>
              </div>
              {records.length > 0 && (
                <button className="icon-button" onClick={() => setShowForm(false)} aria-label="Close form">
                  <X size={18} />
                </button>
              )}
            </div>

            <form onSubmit={createPage} className="creator-form">
              <label className="field field-full">
                <span>Client</span>
                <select required value={form.clientId} onChange={(event) => selectCreateClient(event.target.value)}>
                  <option value="" disabled>Choose an AMPLIFY client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>{client.name}</option>
                  ))}
                </select>
              </label>
              <label className="field field-wide">
                <span>Law firm website</span>
                <div className="input-wrap"><Globe2 size={17} /><input type="url" list="website-memory" autoComplete="url" required placeholder="https://lawfirm.com" value={form.website} onChange={(e) => updateForm("website", e.target.value)} /></div>
              </label>
              <label className="field field-wide">
                <span>Practice area</span>
                <div className="input-wrap"><FileText size={17} /><input list="practice-area-memory" autoComplete="off" required placeholder="e.g. Car accidents" value={form.practiceArea} onChange={(e) => updateForm("practiceArea", e.target.value)} /></div>
              </label>
              <label className="field">
                <span>City</span>
                <input list="city-memory" autoComplete="address-level2" required placeholder="Tampa" value={form.city} onChange={(e) => updateForm("city", e.target.value)} />
              </label>
              <label className="field">
                <span>State</span>
                <input list="state-memory" autoComplete="address-level1" required placeholder="PA" value={form.state} onChange={(e) => updateForm("state", e.target.value)} />
              </label>
              <label className="field field-full">
                <span>Notes for this page <em>optional</em></span>
                <textarea rows={3} placeholder="Anything unique to emphasize, avoid, or verify…" value={form.notes} onChange={(e) => updateForm("notes", e.target.value)} />
              </label>

              <datalist id="website-memory">{formMemory.websites.map((value) => <option key={value} value={value} />)}</datalist>
              <datalist id="practice-area-memory">{formMemory.practiceAreas.map((value) => <option key={value} value={value} />)}</datalist>
              <datalist id="city-memory">{formMemory.cities.map((value) => <option key={value} value={value} />)}</datalist>
              <datalist id="state-memory">{formMemory.states.map((value) => <option key={value} value={value} />)}</datalist>

              {form.clientId === "billy-cooper-law" && (
                <div className="campaign-launch field-full">
                  <div>
                    <span className="campaign-launch-kicker">Billy Cooper GEO child campaign</span>
                    <strong>Top five local pages inside every county</strong>
                    <p>
                      {BILLY_GEO_CHILD_PARENTS.length} parent pages × {BILLY_GEO_CHILD_SERVICE_TEMPLATES.length} focused services.
                      The {BILLY_GEO_CHILD_CAMPAIGN.length - BILLY_GEO_CHILD_MISSING_COUNT} matching pages already live on WordPress are reused; the remaining {BILLY_GEO_CHILD_MISSING_COUNT} are created one at a time.
                    </p>
                  </div>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={queueBillyGeoChildCampaign}
                    disabled={creating || google.loading}
                  >
                    <FileText size={16} /> Queue missing child pages
                  </button>
                </div>
              )}

              <div className="workflow-preview">
                <div><span><Sparkles size={15} /></span><p><b>Create</b><small>Research + writing</small></p></div>
                <i />
                <div><span><UserRoundCheck size={15} /></span><p><b>Share + approve</b><small>Aron reviews the Doc</small></p></div>
                <i />
                <div><span><Globe2 size={15} /></span><p><b>Upload draft</b><small>Review it in WordPress</small></p></div>
              </div>

              <div className="form-footer">
                <p><ShieldCheck size={16} /> Firm facts and legal claims are researched before drafting.</p>
                <button className="primary-button" type="submit" disabled={creating || google.loading}>
                  {creating ? <LoaderCircle className="spin" size={18} /> : <Sparkles size={18} />}
                  {creating ? "Creating page…" : google.connected ? "Create page" : "Connect Google to continue"}
                </button>
              </div>
            </form>
              </section>
            ) : activeWorkflow === "enhance" ? (
              <section className="creator-card enhancement-card" aria-labelledby="enhance-title">
                <div className="creator-heading">
                  <div>
                    <span className="step-number">01</span>
                    <div>
                      <h2 id="enhance-title">Enhance an existing page</h2>
                      <p>Paste one live page URL or upload a list. Every page is analyzed and tracked separately.</p>
                    </div>
                  </div>
                  {records.length > 0 && (
                    <button className="icon-button" onClick={() => setShowForm(false)} aria-label="Close form">
                      <X size={18} />
                    </button>
                  )}
                </div>

                <form
                  onSubmit={enhanceInputMode === "bulk" ? enhanceBulkPages : enhancePage}
                  className="creator-form"
                >
                  <label className="field field-full">
                    <span>Client</span>
                    <select required value={enhanceForm.clientId} onChange={(event) => selectEnhanceClient(event.target.value)}>
                      <option value="" disabled>Choose an AMPLIFY client</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>{client.name}</option>
                      ))}
                    </select>
                  </label>
                  <div className="enhance-input-switch field-full" role="tablist" aria-label="Choose how to add existing pages">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={enhanceInputMode === "single"}
                      className={enhanceInputMode === "single" ? "active" : ""}
                      onClick={() => setEnhanceInputMode("single")}
                    >
                      <Globe2 size={15} /> Single URL
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={enhanceInputMode === "bulk"}
                      className={enhanceInputMode === "bulk" ? "active" : ""}
                      onClick={() => setEnhanceInputMode("bulk")}
                    >
                      <FileUp size={15} /> Bulk upload
                    </button>
                  </div>

                  {enhanceInputMode === "single" ? (
                    <label className="field field-full">
                      <span>Existing page URL</span>
                      <div className="input-wrap">
                        <Globe2 size={17} />
                        <input
                          type="url"
                          autoComplete="url"
                          required
                          placeholder="https://lawfirm.com/existing-geo-page/"
                          value={enhanceForm.pageUrl}
                          onChange={(event) => updateEnhanceForm("pageUrl", event.target.value)}
                        />
                      </div>
                    </label>
                  ) : (
                    <div className="field field-full">
                      <span>URL list <em>paste or upload · up to {BULK_ENHANCE_LIMIT} pages</em></span>
                      <textarea
                        className="bulk-url-input"
                        rows={7}
                        spellCheck={false}
                        placeholder={"https://lawfirm.com/page-one/\nhttps://lawfirm.com/page-two/\nhttps://lawfirm.com/page-three/"}
                        value={bulkUrlText}
                        onChange={(event) => updateBulkUrlText(event.target.value)}
                        aria-label="Paste page URLs"
                      />
                      <div className="bulk-divider"><span>or upload a file</span></div>
                      <label className={`bulk-upload ${bulkImport.fileName ? "is-ready" : ""}`}>
                        <input
                          type="file"
                          accept=".csv,.txt,text/csv,text/plain"
                          onChange={importBulkUrls}
                        />
                        <span className="bulk-upload-icon">
                          {bulkImport.fileName ? <CheckCircle2 size={21} /> : <FileUp size={21} />}
                        </span>
                        <span className="bulk-upload-copy">
                          <strong>{bulkImport.fileName || "Upload a CSV or TXT file"}</strong>
                          <small>
                            {bulkImport.fileName
                              ? `${bulkImport.urls.length} unique page${bulkImport.urls.length === 1 ? "" : "s"} ready${bulkImport.totalFound > BULK_ENHANCE_LIMIT ? ` · first ${BULK_ENHANCE_LIMIT} of ${bulkImport.totalFound} selected` : ""}`
                              : "The URL column can be anywhere in the file."}
                          </small>
                        </span>
                        <span className="bulk-upload-action">
                          {bulkImport.fileName ? "Replace file" : "Choose file"}
                        </span>
                      </label>
                      {bulkImport.urls.length > 0 && (
                        <div className="bulk-url-preview" aria-live="polite">
                          <strong>
                            {bulkImport.urls.length} unique page{bulkImport.urls.length === 1 ? "" : "s"} ready
                            {bulkImport.totalFound > BULK_ENHANCE_LIMIT
                              ? ` · first ${BULK_ENHANCE_LIMIT} of ${bulkImport.totalFound} selected`
                              : ""}
                          </strong>
                          {bulkImport.urls.slice(0, 3).map((url) => <span key={url}>{url}</span>)}
                          {bulkImport.urls.length > 3 && <small>+ {bulkImport.urls.length - 3} more</small>}
                        </div>
                      )}
                    </div>
                  )}
                  <label className="field field-full">
                    <span>Notes for the rewrite <em>optional{enhanceInputMode === "bulk" ? " · applied to every URL" : ""}</em></span>
                    <textarea
                      rows={3}
                      placeholder="Anything specific to preserve, emphasize, avoid, or verify…"
                      value={enhanceForm.notes}
                      onChange={(event) => updateEnhanceForm("notes", event.target.value)}
                    />
                  </label>

                  <div className="workflow-preview">
                    <div><span><Search size={15} /></span><p><b>Analyze + enhance</b><small>Live page + links</small></p></div>
                    <i />
                    <div><span><UserRoundCheck size={15} /></span><p><b>Share + approve</b><small>Aron reviews the Doc</small></p></div>
                    <i />
                    <div><span><Globe2 size={15} /></span><p><b>Upload draft</b><small>Review it in WordPress</small></p></div>
                  </div>

                  <div className="form-footer">
                    <p><ShieldCheck size={16} /> The live site is never changed. The result is replacement copy in a new Google Doc.</p>
                    <button
                      className="primary-button"
                      type="submit"
                      disabled={
                        creating ||
                        google.loading ||
                        (google.connected && enhanceInputMode === "bulk" && !bulkImport.urls.length)
                      }
                    >
                      {creating ? <LoaderCircle className="spin" size={18} /> : <Sparkles size={18} />}
                      {creating
                        ? enhanceInputMode === "bulk" ? "Queueing pages…" : "Enhancing page…"
                        : google.connected
                          ? enhanceInputMode === "bulk"
                            ? `Enhance ${bulkImport.urls.length || "bulk"} pages`
                            : "Enhance page"
                          : "Connect Google to continue"}
                    </button>
                  </div>
                </form>
              </section>
            ) : activeWorkflow === "aop" ? (
              <section className="creator-card aop-card" aria-labelledby="aop-title">
                <div className="creator-heading">
                  <div>
                    <span className="step-number">01</span>
                    <div>
                      <h2 id="aop-title">Create an Area of Practice page</h2>
                      <p>Build a researched service page around the client’s verified practice, jurisdiction, and conversion path.</p>
                    </div>
                  </div>
                  {records.length > 0 && (
                    <button className="icon-button" onClick={() => setShowForm(false)} aria-label="Close form">
                      <X size={18} />
                    </button>
                  )}
                </div>

                <form onSubmit={createAopPage} className="creator-form">
                  <label className="field field-full">
                    <span>Client</span>
                    <select required value={aopForm.clientId} onChange={(event) => selectAopClient(event.target.value)}>
                      <option value="" disabled>Choose an AMPLIFY client</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>{client.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field field-full">
                    <span>Law firm website</span>
                    <div className="input-wrap">
                      <Globe2 size={17} />
                      <input type="url" autoComplete="url" required value={aopForm.website} onChange={(event) => updateAopForm("website", event.target.value)} />
                    </div>
                  </label>
                  <label className="field field-full">
                    <span>Area of Practice</span>
                    <div className="input-wrap">
                      <BriefcaseBusiness size={17} />
                      <input
                        list="aop-practice-areas"
                        required
                        autoComplete="off"
                        placeholder="e.g. Truck Accidents"
                        value={aopForm.practiceArea}
                        onChange={(event) => updateAopForm("practiceArea", event.target.value)}
                      />
                    </div>
                    <datalist id="aop-practice-areas">
                      {(clients.find((client) => client.id === aopForm.clientId)?.practiceAreas || []).map((value) => (
                        <option key={value} value={value} />
                      ))}
                    </datalist>
                  </label>
                  <label className="field field-wide">
                    <span>Primary service keyword <em>optional</em></span>
                    <input autoComplete="off" placeholder="e.g. truck accident lawyer" value={aopForm.primaryKeyword} onChange={(event) => updateAopForm("primaryKeyword", event.target.value)} />
                  </label>
                  <label className="field field-wide">
                    <span>Jurisdiction or audience <em>optional</em></span>
                    <input list="aop-jurisdictions" autoComplete="off" placeholder="e.g. Florida" value={aopForm.jurisdiction} onChange={(event) => updateAopForm("jurisdiction", event.target.value)} />
                    <datalist id="aop-jurisdictions">
                      {(clients.find((client) => client.id === aopForm.clientId)?.jurisdictions || []).map((value) => (
                        <option key={value} value={value} />
                      ))}
                    </datalist>
                  </label>
                  <label className="field field-full">
                    <span>Page notes <em>optional</em></span>
                    <textarea rows={4} placeholder="Service scope, differentiators to verify, related pages to link, topics to emphasize, or claims to avoid…" value={aopForm.notes} onChange={(event) => updateAopForm("notes", event.target.value)} />
                  </label>

                  <div className="workflow-preview">
                    <div><span><Search size={15} /></span><p><b>Research + write</b><small>Firm, service, and law</small></p></div>
                    <i />
                    <div><span><UserRoundCheck size={15} /></span><p><b>Share + approve</b><small>Aron reviews the Doc</small></p></div>
                    <i />
                    <div><span><ImageIcon size={15} /></span><p><b>Image + page draft</b><small>CTAs, schema, and SEO</small></p></div>
                  </div>

                  <div className="form-footer">
                    <p><ShieldCheck size={16} /> Firm claims, service scope, and legal rules must be verified before drafting.</p>
                    <button className="primary-button" type="submit" disabled={creating || google.loading}>
                      {creating ? <LoaderCircle className="spin" size={18} /> : <BriefcaseBusiness size={18} />}
                      {creating ? "Creating AOP page…" : google.connected ? "Create AOP page" : "Connect Google to continue"}
                    </button>
                  </div>
                </form>
              </section>
            ) : activeWorkflow === "subaop" ? (
              <section className="creator-card subaop-card" aria-labelledby="subaop-title">
                <div className="creator-heading">
                  <div>
                    <span className="step-number">01</span>
                    <div>
                      <h2 id="subaop-title">Create a Sub-AOP page</h2>
                      <p>Build a focused service page beneath a verified, published parent Area of Practice page.</p>
                    </div>
                  </div>
                  {records.length > 0 && (
                    <button className="icon-button" onClick={() => setShowForm(false)} aria-label="Close form">
                      <X size={18} />
                    </button>
                  )}
                </div>

                <form onSubmit={createSubAopPage} className="creator-form">
                  <label className="field field-full">
                    <span>Client</span>
                    <select required value={subAopForm.clientId} onChange={(event) => selectSubAopClient(event.target.value)}>
                      <option value="" disabled>Choose an AMPLIFY client</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>{client.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field field-full">
                    <span>Law firm website</span>
                    <div className="input-wrap">
                      <Globe2 size={17} />
                      <input type="url" autoComplete="url" required value={subAopForm.website} onChange={(event) => updateSubAopForm("website", event.target.value)} />
                    </div>
                  </label>
                  <label className="field field-wide">
                    <span>Published parent AOP</span>
                    <div className="input-wrap">
                      <BriefcaseBusiness size={17} />
                      <input
                        list="subaop-parent-areas"
                        required
                        autoComplete="off"
                        placeholder="e.g. Personal Injury"
                        value={subAopForm.parentPracticeArea}
                        onChange={(event) => updateSubAopForm("parentPracticeArea", event.target.value)}
                      />
                    </div>
                    <datalist id="subaop-parent-areas">
                      {(clients.find((client) => client.id === subAopForm.clientId)?.practiceAreas || []).map((value) => (
                        <option key={value} value={value} />
                      ))}
                    </datalist>
                    <small className="field-hint">This page must already be published in WordPress; the new page will become its child.</small>
                  </label>
                  <label className="field field-wide">
                    <span>Sub-AOP service</span>
                    <div className="input-wrap">
                      <FileText size={17} />
                      <input
                        required
                        autoComplete="off"
                        placeholder="e.g. Rear-End Collisions"
                        value={subAopForm.practiceArea}
                        onChange={(event) => updateSubAopForm("practiceArea", event.target.value)}
                      />
                    </div>
                  </label>
                  <label className="field field-wide">
                    <span>Primary service keyword <em>optional</em></span>
                    <input autoComplete="off" placeholder="e.g. rear-end accident lawyer" value={subAopForm.primaryKeyword} onChange={(event) => updateSubAopForm("primaryKeyword", event.target.value)} />
                  </label>
                  <label className="field field-wide">
                    <span>Jurisdiction or audience <em>optional</em></span>
                    <input list="subaop-jurisdictions" autoComplete="off" placeholder="e.g. New York" value={subAopForm.jurisdiction} onChange={(event) => updateSubAopForm("jurisdiction", event.target.value)} />
                    <datalist id="subaop-jurisdictions">
                      {(clients.find((client) => client.id === subAopForm.clientId)?.jurisdictions || []).map((value) => (
                        <option key={value} value={value} />
                      ))}
                    </datalist>
                  </label>
                  <label className="field field-full">
                    <span>Page notes <em>optional</em></span>
                    <textarea rows={4} placeholder="Narrow service scope, differentiators to verify, related child pages, topics to emphasize, or claims to avoid…" value={subAopForm.notes} onChange={(event) => updateSubAopForm("notes", event.target.value)} />
                  </label>

                  <div className="workflow-preview">
                    <div><span><Search size={15} /></span><p><b>Research + differentiate</b><small>Parent, service, and law</small></p></div>
                    <i />
                    <div><span><UserRoundCheck size={15} /></span><p><b>Share + approve</b><small>Aron reviews the Doc</small></p></div>
                    <i />
                    <div><span><ImageIcon size={15} /></span><p><b>Child page + image</b><small>CTAs, schema, and SEO</small></p></div>
                  </div>

                  <div className="form-footer">
                    <p><ShieldCheck size={16} /> WordPress verifies the published parent before creating the child-page draft.</p>
                    <button className="primary-button" type="submit" disabled={creating || google.loading}>
                      {creating ? <LoaderCircle className="spin" size={18} /> : <FileText size={18} />}
                      {creating ? "Creating Sub-AOP page…" : google.connected ? "Create Sub-AOP page" : "Connect Google to continue"}
                    </button>
                  </div>
                </form>
              </section>
            ) : (
              <section className="creator-card blog-card" aria-labelledby="blog-title">
                <div className="creator-heading">
                  <div>
                    <span className="step-number">01</span>
                    <div>
                      <h2 id="blog-title">Create a researched blog</h2>
                      <p>Build an authoritative article around a topic, search query, and jurisdiction.</p>
                    </div>
                  </div>
                  {records.length > 0 && (
                    <button className="icon-button" onClick={() => setShowForm(false)} aria-label="Close form">
                      <X size={18} />
                    </button>
                  )}
                </div>

                <form onSubmit={createBlog} className="creator-form">
                  <label className="field field-full">
                    <span>Client</span>
                    <select required value={blogForm.clientId} onChange={(event) => selectBlogClient(event.target.value)}>
                      <option value="" disabled>Choose an AMPLIFY client</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>{client.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field field-full">
                    <span>Law firm website</span>
                    <div className="input-wrap">
                      <Globe2 size={17} />
                      <input type="url" autoComplete="url" required value={blogForm.website} onChange={(event) => updateBlogForm("website", event.target.value)} />
                    </div>
                  </label>
                  <label className="field field-full">
                    <span>Client practice area</span>
                    <div className="blog-research-row">
                      <div className="input-wrap">
                        <FileText size={17} />
                        <input
                          list="blog-practice-areas"
                          required
                          autoComplete="off"
                          placeholder="e.g. Personal Injury"
                          value={blogForm.practiceArea}
                          onChange={(event) => {
                            topicQuestionRequest.current?.abort();
                            topicQuestionRequest.current = null;
                            setTopicQuestionsLoading(false);
                            updateBlogForm("practiceArea", event.target.value);
                            setTopicQuestions([]);
                          }}
                        />
                      </div>
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => void findBlogTopicQuestions()}
                        disabled={topicQuestionsLoading || !google.openaiConfigured || !blogForm.practiceArea.trim()}
                        title={google.openaiConfigured ? "Generate client-relevant questions with ChatGPT" : "Add OPENAI_API_KEY in Vercel to generate questions"}
                      >
                        {topicQuestionsLoading ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}
                        {topicQuestionsLoading ? "Generating questions…" : "Generate questions"}
                      </button>
                    </div>
                    <datalist id="blog-practice-areas">
                      {(clients.find((client) => client.id === blogForm.clientId)?.practiceAreas || []).map((value) => (
                        <option key={value} value={value} />
                      ))}
                    </datalist>
                    {!google.openaiConfigured && (
                      <small className="field-hint">OpenAI must be connected before ChatGPT can generate topic questions. Manual blog topics still work.</small>
                    )}
                    {google.openaiConfigured && topicQuestionsLoading && (
                      <small className="field-hint">Keep this page open while ChatGPT reviews the client, practice area, jurisdiction, and prior blog topics.</small>
                    )}
                  </label>

                  {topicQuestions.length > 0 && (
                    <div className="topic-question-results field-full" aria-live="polite">
                      <div className="topic-question-results-heading">
                        <div>
                          <strong>ChatGPT topic questions for this client</strong>
                          <small>Choose one to use as the article topic. The suggestions reflect the selected client, practice area, jurisdiction, and existing blog topics.</small>
                        </div>
                        <span>Client-specific</span>
                      </div>
                      <div className="topic-question-list">
                        {topicQuestions.slice(0, 24).map((item) => (
                          <button
                            key={`${item.cluster}-${item.question}`}
                            type="button"
                            className={blogForm.topic === item.question ? "selected" : ""}
                            onClick={() => {
                              updateBlogForm("topic", item.question);
                              if (!blogForm.primaryKeyword.trim()) updateBlogForm("primaryKeyword", item.sourceTerm);
                            }}
                          >
                            <span>{item.question}</span>
                            <small>{item.practiceArea || blogForm.practiceArea} · {item.cluster}</small>
                          </button>
                        ))}
                      </div>
                      {topicQuestions.length > 24 && <small className="topic-question-more">Showing the first 24 of {topicQuestions.length} distinct questions.</small>}
                    </div>
                  )}
                  <label className="field field-full">
                    <span>Blog topic</span>
                    <div className="input-wrap">
                      <Newspaper size={17} />
                      <input required autoComplete="off" placeholder="Choose a generated question or enter a topic" value={blogForm.topic} onChange={(event) => updateBlogForm("topic", event.target.value)} />
                    </div>
                  </label>
                  <label className="field field-wide">
                    <span>Primary keyword <em>optional</em></span>
                    <input autoComplete="off" placeholder="e.g. rideshare accident lawyer" value={blogForm.primaryKeyword} onChange={(event) => updateBlogForm("primaryKeyword", event.target.value)} />
                  </label>
                  <label className="field field-wide">
                    <span>Jurisdiction or audience <em>optional</em></span>
                    <input list="blog-jurisdictions" autoComplete="off" placeholder="e.g. New York" value={blogForm.jurisdiction} onChange={(event) => updateBlogForm("jurisdiction", event.target.value)} />
                    <datalist id="blog-jurisdictions">
                      {(clients.find((client) => client.id === blogForm.clientId)?.jurisdictions || []).map((value) => (
                        <option key={value} value={value} />
                      ))}
                    </datalist>
                  </label>
                  <label className="field field-wide">
                    <span>Planned publish date and time <em>optional</em></span>
                    <input
                      type="datetime-local"
                      value={dateTimeLocalValue(blogForm.scheduledPublishAt)}
                      onChange={(event) => updateBlogForm(
                        "scheduledPublishAt",
                        event.target.value ? new Date(event.target.value).toISOString() : "",
                      )}
                    />
                    <small className="field-hint">Your final approval schedules a future date. If the date has passed or is left blank, final approval publishes immediately with today’s date.</small>
                  </label>
                  <label className="field field-full">
                    <span>Lawyer to feature <em>optional</em></span>
                    <input maxLength={120} autoComplete="off" placeholder="e.g. Sean Domnick or Nicole Kruegel" value={blogForm.authorityAttorney || ""} onChange={(event) => updateBlogForm("authorityAttorney", event.target.value)} />
                    <small className="field-hint">Enter the lawyer’s name. We’ll focus the authority research and review on that lawyer for this topic. Leave blank for firm-wide coverage.</small>
                  </label>
                  <label className="field field-full">
                    <span>Editorial notes <em>optional</em></span>
                    <textarea rows={4} placeholder="Angle, questions to answer, sources to use, internal pages to link, facts to preserve, or claims to avoid…" value={blogForm.notes} onChange={(event) => updateBlogForm("notes", event.target.value)} />
                  </label>

                  <div className="workflow-preview">
                    <div><span><Search size={15} /></span><p><b>Research + write</b><small>Firm, law, and topic</small></p></div>
                    <i />
                    <div><span><UserRoundCheck size={15} /></span><p><b>Share + approve</b><small>Aron reviews the Doc</small></p></div>
                    <i />
                    <div><span><ImageIcon size={15} /></span><p><b>Image + post draft</b><small>Relevant image + alt text</small></p></div>
                  </div>

                  <div className="form-footer">
                    <p><ShieldCheck size={16} /> Firm claims and legal statements must be supported before drafting.</p>
                    <button className="primary-button" type="submit" disabled={creating || google.loading}>
                      {creating ? <LoaderCircle className="spin" size={18} /> : <Newspaper size={18} />}
                      {creating ? "Creating blog…" : google.connected ? "Create blog" : "Connect Google to continue"}
                    </button>
                  </div>
                </form>
              </section>
            )}
          </div>
        )}

        <section className="metrics" aria-label="Content totals">
          <div><span>Active content</span><strong>{metrics.total}</strong><Globe2 size={18} /></div>
          <div><span>With Aron</span><strong>{metrics.withAron}</strong><Clock3 size={18} /></div>
          <div><span>Approved by Aron</span><strong>{metrics.approved}</strong><FileCheck2 size={18} /></div>
          <div><span>WordPress drafts</span><strong>{metrics.wordpressDrafts}</strong><CheckCircle2 size={18} /></div>
        </section>

        <section className="queue-card" aria-labelledby="queue-title">
          <div className="queue-header">
            <div>
              <span className="step-number">02</span>
              <div><h2 id="queue-title">Content tracker</h2><p>Manage writing, preparation and approvals here. Completed publications are saved in Published Content.</p></div>
            </div>
            <div className="queue-tools">
              <label className="search-box"><Search size={16} /><input aria-label="Search content" placeholder="Search content" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
              {unfinishedCount > 0 && (
                <button className="secondary-button compact danger-button" onClick={resetUnfinishedRecords}>
                  <Trash2 size={15} /> Reset unfinished ({unfinishedCount})
                </button>
              )}
              <button className="secondary-button compact" onClick={() => openWorkflow("create")}><Plus size={16} /> New page</button>
              <button className="secondary-button compact" onClick={() => openWorkflow("aop")}><BriefcaseBusiness size={15} /> New AOP</button>
              <button className="secondary-button compact" onClick={() => openWorkflow("subaop")}><FileText size={15} /> New Sub-AOP</button>
              <button className="secondary-button compact" onClick={() => openWorkflow("enhance")}><Sparkles size={15} /> Enhance</button>
              <button className="secondary-button compact" onClick={() => openWorkflow("blog")}><Newspaper size={15} /> New blog</button>
            </div>
          </div>

          <div className="tracker-filter-bar" aria-label="Filter content tracker">
            <div className="tracker-type-filters" role="group" aria-label="Content type">
              {CONTENT_FILTER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={contentFilter === option.value ? "active" : ""}
                  aria-pressed={contentFilter === option.value}
                  onClick={() => setContentFilter(option.value)}
                >
                  {option.label} <span>{trackerTypeCounts[option.value]}</span>
                </button>
              ))}
            </div>
            <div className="tracker-status-controls">
              <label>
                <span>Status</span>
                <select
                  aria-label="Filter by status"
                  value={trackerStatusFilter}
                  onChange={(event) => setTrackerStatusFilter(event.target.value as TrackerStatusFilter)}
                >
                  <option value="all">All statuses</option>
                  <option value="pending">Pending action</option>
                  <option value="with-aron">With Aron</option>
                  <option value="ready">Ready for WordPress</option>
                  <option value="wordpress-draft">WordPress drafts</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="attention">Needs attention</option>
                </select>
              </label>
              {(contentFilter !== "all" || trackerStatusFilter !== "all" || search.trim()) && (
                <button
                  type="button"
                  className="text-button tracker-clear-filters"
                  onClick={() => {
                    setContentFilter("all");
                    setTrackerStatusFilter("all");
                    setSearch("");
                  }}
                >
                  Clear filters
                </button>
              )}
              <strong>{visibleRecords.length} shown</strong>
            </div>
          </div>

          {!hydrated ? (
            <div className="empty-state"><LoaderCircle className="spin" size={24} /><h3>Loading your tracker</h3></div>
          ) : visibleRecords.length === 0 ? (
            <div className="empty-state">
              <span><FileText size={24} /></span>
              <h3>{records.length ? "No content matches these filters" : "Your first draft starts here"}</h3>
              <p>{records.length ? "Try another content type, status, firm, topic, practice area, city, or URL." : "The tracker keeps GEO pages, AOP and Sub-AOP pages, enhanced pages, blogs, and every handoff in one place."}</p>
              {!records.length && <button className="text-button" onClick={() => openWorkflow("create")}>Create a geo page <ArrowUpRight size={15} /></button>}
            </div>
          ) : (
            <div className="records">
              <div className="bulk-selection-bar">
                <label className="record-selector select-all-records">
                  <input
                    ref={selectAllRecordsRef}
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisibleRecords}
                    aria-label={`Select all ${visibleRecords.length} visible items`}
                  />
                  <span aria-hidden="true"><Check size={13} /></span>
                  <b>Select all {(search.trim() || contentFilter !== "all" || trackerStatusFilter !== "all") ? `${visibleRecords.length} shown` : "content"}</b>
                </label>
                <div className="bulk-selection-actions">
                  <strong aria-live="polite">
                    {selectedRecords.length
                      ? `${selectedRecords.length} selected`
                      : "Select content to manage"}
                  </strong>
                  {selectedRecords.length > 0 && (
                    <button className="text-button clear-selection" onClick={() => setSelectedRecordIds(new Set())}>
                      Clear
                    </button>
                  )}
                  <button
                    className="secondary-button compact danger-button"
                    onClick={deleteSelectedRecords}
                    disabled={!selectedRecords.length}
                  >
                    <Trash2 size={15} /> Delete selected
                  </button>
                </div>
              </div>
              {visibleRecords.map((record) => (
                <article className={`record ${selectedRecordIds.has(record.id) ? "is-selected" : ""}`} key={record.id}>
                  <div className="record-main">
                    <label className="record-selector row-selector">
                      <input
                        type="checkbox"
                        checked={selectedRecordIds.has(record.id)}
                        onChange={() => toggleRecordSelection(record.id)}
                        aria-label={`Select ${recordTitle(record)}`}
                      />
                      <span aria-hidden="true"><Check size={13} /></span>
                    </label>
                    <span className={`record-icon status-${record.status}`}>
                      {record.status === "generating" ? <LoaderCircle className="spin" size={18} /> : record.status === "queued" ? <Clock3 size={18} /> : record.status === "error" ? <X size={18} /> : <FileText size={18} />}
                    </span>
                    <div className="record-copy">
                      <div className="record-title-row">
                        <h3>
                          {isEnhancement(record) ? (
                            <>Enhance <span>·</span> {enhancementTitle(record)}</>
                          ) : isBlog(record) ? (
                            <>{record.practiceArea}</>
                          ) : isAop(record) ? (
                            <>{record.practiceArea}</>
                          ) : isSubAop(record) ? (
                            <>{record.practiceArea} <span>·</span> {record.parentPracticeArea}</>
                          ) : (
                            <>{formatLocation(record.city, record.state)} <span>·</span> {record.practiceArea}</>
                          )}
                        </h3>
                        <span className={`workflow-badge ${isEnhancement(record) ? "is-enhancement" : isBlog(record) ? "is-blog" : isAop(record) ? "is-aop" : isSubAop(record) ? "is-subaop" : ""}`}>
                          {isEnhancement(record) ? "Existing page" : isBlog(record) ? "Blog" : isAop(record) ? "AOP" : isSubAop(record) ? "Sub-AOP" : "New page"}
                        </span>
                        {record.clientName && <span className="client-badge">{record.clientName}</span>}
                        <span className={`status-badge status-${record.status}`}>{statusLabel(record)}</span>
                      </div>
                      <p className="workflow-next-step">{contentWorkflow(record).note}</p><WorkflowChecklist record={record}/>
                      <p>{recordHost(record)} <span>•</span> {formatDate(record.createdAt)} {record.wordCount ? <><span>•</span> {record.wordCount.toLocaleString()} words</> : null}</p>
                      {record.error && !(
                        record.error.startsWith("No WordPress client is configured") &&
                        hasConfiguredWordPressClient(record, clients)
                      ) && <p className="record-error">{record.error}</p>}
                      {isEnhancement(record) && !record.published && record.wordpressPageId && record.wordpressStatus === "draft" && (
                        <p className="record-note">Private final review copy. Check it in WordPress, then return here to update the existing page.</p>
                      )}
                    </div>
                  </div>

                  {record.status === "error" ? (
                    <div className="record-actions error-actions">
                      <button className="secondary-button compact" onClick={() => retryRecord(record)}><RotateCcw size={15} /> Try again</button>
                      <button className="icon-button danger" onClick={() => deleteRecord(record)} aria-label="Delete page from dashboard" title="Delete from dashboard"><Trash2 size={16} /></button>
                    </div>
                  ) : (
                    <div className="record-actions">
                      {isEnhancement(record) && <a className="source-link" href={record.pageUrl || record.website} target="_blank" rel="noreferrer">Original page <ArrowUpRight size={14} /></a>}
                      {record.docUrl && (
                        <a className="doc-link" href={record.docUrl} target="_blank" rel="noreferrer">Open Google Doc <ArrowUpRight size={15} /></a>
                      )}
                      <label className={`check-item ${record.docUrl ? "checked" : ""}`}><span>{record.docUrl ? <Check size={14} /> : <Circle size={14} />}</span>{record.docUrl ? "Shared with Aron" : "Not sent to Aron yet"}</label>
                      {record.docUrl && !record.aronDone && record.status !== "generating" && (
                        <button
                          className={`secondary-button compact revision-button ${record.approvalStatus === "DECLINED" ? "needs-revision" : ""}`}
                          type="button"
                          onClick={() => openReviewFeedback(record)}
                        >
                          <MessageSquareText size={14} />
                          {record.approvalStatus === "DECLINED" ? "Respond to feedback" : "Revise with feedback"}
                        </button>
                      )}
                      {record.approvalEnabled ? (
                        <label className={`check-item ${record.approvalStatus === "APPROVED" ? "checked" : ""}`}>
                          <span>{record.approvalStatus === "APPROVED" ? <Check size={14} /> : <Circle size={14} />}</span>
                          {record.approvalStatus === "DECLINED" ? "Aron requested changes" : record.approvalStatus === "APPROVED" ? "Aron approved" : "Waiting for Aron’s approval"}
                        </label>
                      ) : (
                        <label className={`check-item ${record.aronDone ? "checked" : ""}`}>
                          <input type="checkbox" checked={record.aronDone} disabled={!record.docUrl || record.aronDone} onChange={() => markAronReviewComplete(record)} />
                          <span>{record.aronDone ? <Check size={14} /> : <Circle size={14} />}</span>
                          {record.aronDone ? "Aron approved" : "Mark Aron’s review complete"}
                        </label>
                      )}
                      {publishingToWordPress === record.id ? (
                        <label className="check-item"><span><LoaderCircle className="spin" size={14} /></span>{isBlog(record) || isAop(record) || isSubAop(record) ? "Creating image + WordPress draft…" : "Uploading WordPress draft…"}</label>
                      ) : isEnhancement(record) && record.published ? (
                        <a className="check-item checked" href={record.wordpressUrl || record.pageUrl || record.website} target="_blank" rel="noreferrer">
                          <span><Check size={14} /></span>Live at original URL <ArrowUpRight size={13} />
                        </a>
                      ) : record.published || record.wordpressStatus === "publish" ? (<>
                        <a className="check-item checked" href={record.wordpressUrl || record.website} target="_blank" rel="noreferrer">
                          <span><Check size={14} /></span>Live on WordPress <ArrowUpRight size={13} />
                        </a>
                        {isBlog(record) && (
                          <button
                            className="secondary-button compact wordpress-publish"
                            onClick={() => void assignBlogToSchedule(record, true)}
                            disabled={schedulingBlog === record.id}
                            title="Return this AMPLIFY blog to a WordPress draft and reserve the client’s next open publishing date"
                          >
                            {schedulingBlog === record.id
                              ? <><LoaderCircle className="spin" size={14} /> Moving to schedule…</>
                              : <><CalendarDays size={14} /> Move to schedule</>}
                          </button>
                        )}
                      </>
                      ) : record.wordpressPageId && record.wordpressStatus === "future" ? (
                        <a className="check-item checked" href={record.wordpressEditUrl || record.wordpressUrl} target="_blank" rel="noreferrer">
                          <span><CalendarDays size={14} /></span>
                          Scheduled for {record.scheduledPublishAt ? new Date(record.scheduledPublishAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "WordPress publishing"}
                          <ArrowUpRight size={13} />
                        </a>
                      ) : record.wordpressPageId && record.wordpressStatus === "draft" ? (<>
                        <a className={`check-item${finalApprovalReady(record) ? " checked" : ""}`} href={wordPressPreviewUrl(record)} target="_blank" rel="noreferrer">
                          <span>{finalApprovalReady(record) ? <Check size={14} /> : <Circle size={14} />}</span>{finalApprovalReady(record) ? "Preview finished draft" : "Preview current draft"} <ArrowUpRight size={13} />
                        </a>
                        <a className="primary-button compact wordpress-publish" href={`/final-review/${record.id}`}>
                          {finalApprovalReady(record) ? "Review & approve" : "See work in progress"}
                        </a>
                        {isBlog(record) && !record.editorialSlotId && (
                          <button
                            className="secondary-button compact wordpress-publish"
                            onClick={() => void assignBlogToSchedule(record)}
                            disabled={schedulingBlog === record.id}
                            title="Reserve the client’s next open publishing date while keeping this post in draft"
                          >
                            {schedulingBlog === record.id
                              ? <><LoaderCircle className="spin" size={14} /> Adding to schedule…</>
                              : <><CalendarDays size={14} /> Add to schedule</>}
                          </button>
                        )}
                        {isBlog(record) && record.editorialSlotId && record.scheduledPublishAt && (
                          <span className="check-item checked">
                            <span><CalendarDays size={14} /></span>
                            {isFuturePublishingDate(record.scheduledPublishAt) ? "Planned for " : "Overdue — final approval publishes now. Originally planned for "}{new Date(record.scheduledPublishAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                          </span>
                        )}
                        {renderFeaturedImageReview(record)}
                        <button
                          className="secondary-button compact wordpress-publish"
                          onClick={() => void buildWordPressDraft(record, true)}
                          title={isBlog(record)
                            ? "Refresh the WordPress post draft with the latest approved article and featured image"
                            : isAop(record)
                              ? "Refresh the WordPress page draft with the latest approved AOP copy, CTAs, schema, and banner image"
                            : isSubAop(record)
                              ? "Refresh the WordPress child-page draft with the latest approved Sub-AOP copy, CTAs, schema, and banner image"
                            : "Refresh the existing WordPress draft with the latest approved copy and banner rules"}
                        >
                          <RotateCcw size={14} /> {isEnhancement(record) ? "Rebuild review copy" : `Refresh WordPress ${isBlog(record) ? "post " : ""}draft`}
                        </button>
                      </>) : record.aronDone && !record.published ? (
                        requiresPreWordPressImageApproval(record) ? (<>
                          {record.pendingImageUrl
                            ? renderFeaturedImageReview(record)
                            : (
                              <button
                                className="primary-button compact wordpress-publish"
                                onClick={() => void generateImageForReview(record)}
                                disabled={generatingImage === record.id}
                                title="Generate the featured image in AMPLIFY for your approval before WordPress"
                              >
                                {generatingImage === record.id
                                  ? <><LoaderCircle className="spin" size={14} /> Generating image…</>
                                  : <><ImageIcon size={14} /> Generate image for approval</>}
                              </button>
                            )}
                          {record.pendingImageReviewId && record.featuredImageApproved === true && (
                            <button
                              className="primary-button compact wordpress-publish"
                              onClick={() => void buildWordPressDraft(record)}
                              disabled={publishingToWordPress === record.id}
                              title={`Send the approved image and Google Doc to WordPress as a ${isBlog(record) ? "post " : ""}draft`}
                            >
                              {publishingToWordPress === record.id
                                ? <><LoaderCircle className="spin" size={14} /> Sending to WordPress…</>
                                : <><Globe2 size={14} /> Send approved content + image to WordPress draft</>}
                            </button>
                          )}
                        </>) : (
                          <button
                            className="secondary-button compact wordpress-publish"
                            onClick={() => void buildWordPressDraft(record, Boolean(record.wordpressPageId), false)}
                            title={`Upload the approved Google Doc as a WordPress ${isBlog(record) ? "post " : ""}draft`}
                          >
                            <Globe2 size={14} /> {isEnhancement(record)
                              ? "Create final WordPress review"
                              : "Upload to WordPress as draft"}
                          </button>
                        )
                      ) : (
                        <label className="check-item"><span><Circle size={14} /></span>WordPress {isBlog(record) ? "post " : ""}draft</label>
                      )}
                      {record.clientId === "billy-cooper-law" && !isEnhancement(record) && !isBlog(record) && !isAop(record) && !isSubAop(record) && record.wordpressPageId && (
                        <button
                          className="secondary-button compact wordpress-publish"
                          onClick={() => void syncGeoDirectory(record)}
                          disabled={syncingDirectory === record.id}
                          title="Make every live GEO page in this campaign link the other live pages in its city list"
                        >
                          {syncingDirectory === record.id
                            ? <><LoaderCircle className="spin" size={14} /> Syncing city links…</>
                            : <><RotateCcw size={14} /> Sync city links</>}
                        </button>
                      )}
                      <button className="icon-button danger record-delete" onClick={() => deleteRecord(record)} aria-label="Delete page from dashboard" title="Delete from dashboard"><Trash2 size={16} /></button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <footer>
          <p>AMPLIFY Content <span>•</span> GEO Prompt v2.0 <span>•</span> AOP + Sub-AOP Prompts <span>•</span> Enhancement Prompt <span>•</span> Blog Prompt</p>
          <button onClick={() => setShowForm((value) => !value)}>{showForm ? "Hide tools" : "Open content tools"} <ChevronDown size={14} /></button>
        </footer>
      </div>
    </main>
  );
}
