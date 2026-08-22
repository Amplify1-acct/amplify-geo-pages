"use client";

import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock3,
  FileCheck2,
  FileText,
  FileUp,
  Globe2,
  LoaderCircle,
  LogOut,
  Plus,
  RotateCcw,
  Search,
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

type PageRecord = {
  id: string;
  workflow?: "create" | "enhance";
  website: string;
  pageUrl?: string;
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
  willShared?: boolean;
  published: boolean;
  updatedAt?: string;
  error?: string;
  bulkBatchId?: string;
  bulkPosition?: number;
  wordpressPageId?: number;
  wordpressUrl?: string;
  wordpressBackupId?: string;
  wordpressPublishedAt?: string;
  wordpressDraftCreatedAt?: string;
  wordpressEditUrl?: string;
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
  siteUrl?: string | null;
  message?: string;
};

type DraftInput = {
  website: string;
  practiceArea: string;
  city: string;
  state: string;
  notes: string;
};

type EnhanceInput = {
  pageUrl: string;
  notes: string;
};

type BulkImport = {
  fileName: string;
  urls: string[];
  totalFound: number;
};

const STORAGE_KEY = "amplify-geo-pages-v1";
const FORM_KEY = "amplify-geo-form-v1";
const ENHANCE_FORM_KEY = "amplify-enhance-form-v1";
const STALLED_RESET_KEY = "amplify-stalled-reset-2026-08-18-v1";
const STALLED_RESET_CUTOFF = Date.parse("2026-08-18T10:15:00-04:00");
const BULK_ENHANCE_LIMIT = 50;
const emptyForm: DraftInput = {
  website: "",
  practiceArea: "",
  city: "",
  state: "",
  notes: "",
};
const emptyEnhanceForm: EnhanceInput = {
  pageUrl: "",
  notes: "",
};
const emptyBulkImport: BulkImport = {
  fileName: "",
  urls: [],
  totalFound: 0,
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

function statusLabel(record: PageRecord) {
  if (record.status === "queued") return "Queued";
  if (record.status === "generating") return "Researching";
  if (record.status === "error") return "Needs attention";
  if (record.wordpressDraftCreatedAt) return "WordPress draft";
  if (record.published) return "Published";
  if (record.willShared) return "With Will + Abigail";
  if (record.approvalStatus === "DECLINED") return "Changes requested";
  if (record.aronDone) return "Ready to share";
  return "With Aron";
}

function isEnhancement(record: PageRecord) {
  return record.workflow === "enhance";
}

function isStalledRecord(record: PageRecord) {
  if (record.docUrl) return false;
  return record.status === "error" || record.status === "queued" || record.status === "generating";
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

export default function Home() {
  const router = useRouter();
  const [records, setRecords] = useState<PageRecord[]>([]);
  const [form, setForm] = useState<DraftInput>(emptyForm);
  const [enhanceForm, setEnhanceForm] = useState<EnhanceInput>(emptyEnhanceForm);
  const [enhanceInputMode, setEnhanceInputMode] = useState<"single" | "bulk">("single");
  const [bulkUrlText, setBulkUrlText] = useState("");
  const [bulkImport, setBulkImport] = useState<BulkImport>(emptyBulkImport);
  const [activeWorkflow, setActiveWorkflow] = useState<"create" | "enhance">("create");
  const [hydrated, setHydrated] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(true);
  const [cloudReady, setCloudReady] = useState(false);
  const [stalledResetComplete, setStalledResetComplete] = useState(false);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [sharingWithReviewers, setSharingWithReviewers] = useState<string | null>(null);
  const [publishingToWordPress, setPublishingToWordPress] = useState<string | null>(null);
  const [creatingWordPressBatch, setCreatingWordPressBatch] = useState(false);
  const pollingJobs = useRef(new Set<string>());
  const sharingReviewerJobs = useRef(new Set<string>());
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
  });

  const shareRecordWithReviewers = useCallback(
    async (record: PageRecord, approvalTriggered = false) => {
      if (record.willShared || sharingReviewerJobs.current.has(record.id)) return;

      const docId = googleDocId(record);
      if (!docId) {
        setNotice("The Google Doc link is missing, so it could not be shared with Will and Abigail.");
        return;
      }

      sharingReviewerJobs.current.add(record.id);
      setSharingWithReviewers(record.id);
      setNotice(null);
      try {
        const response = await fetch("/api/google/share", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ docId }),
        });
        const data = await readApiResponse(response);
        if (data.shared !== true) {
          throw new Error(
            "Google did not confirm that the document was shared with Will and Abigail.",
          );
        }

        setRecords((current) =>
          current.map((item) =>
            item.id === record.id
              ? {
                  ...item,
                  docId,
                  aronDone: true,
                  approvalStatus: approvalTriggered ? "APPROVED" : item.approvalStatus,
                  willShared: true,
                  status: "ready",
                  published: false,
                  error: undefined,
                  updatedAt: new Date().toISOString(),
                }
              : item,
          ),
        );
        setNotice(
          approvalTriggered
            ? "Aron approved the Google Doc. It was automatically shared with Will and Abigail."
            : "Aron’s review is complete. The edited and approved Google Doc was shared with Will and Abigail.",
        );
      } catch (error) {
        setNotice(
          error instanceof Error
            ? error.message
            : "The Google Doc could not be shared with Will and Abigail.",
        );
      } finally {
        sharingReviewerJobs.current.delete(record.id);
        setSharingWithReviewers((current) => (current === record.id ? null : current));
      }
    },
    [],
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const storedForm = localStorage.getItem(FORM_KEY);
        const storedEnhanceForm = localStorage.getItem(ENHANCE_FORM_KEY);
        if (stored) setRecords(JSON.parse(stored));
        if (storedForm) setForm(JSON.parse(storedForm));
        if (storedEnhanceForm) setEnhanceForm(JSON.parse(storedEnhanceForm));
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
          for (const record of localRecords) {
            const cloudRecord = merged.get(record.id);
            const localTime = new Date(record.updatedAt || record.createdAt).getTime();
            const cloudTime = cloudRecord
              ? new Date(cloudRecord.updatedAt || cloudRecord.createdAt).getTime()
              : 0;
            if (!cloudRecord || localTime >= cloudTime) merged.set(record.id, record);
          }
          return [...merged.values()].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          );
        });
        setCloudReady(true);
      })
      .catch(() => setCloudReady(true));
    return () => {
      cancelled = true;
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
    if (!hydrated || memoryInitialized.current || !records.length) return;
    memoryInitialized.current = true;
    setForm((current) => {
      const hasDraft = Object.values(current).some((value) => value.trim());
      if (hasDraft) return current;
      const previous = records.find((record) => !isEnhancement(record));
      if (!previous) return current;
      return {
        website: previous.website,
        practiceArea: previous.practiceArea,
        city: "",
        state: previous.state,
        notes: "",
      };
    });
  }, [hydrated, records]);

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
                          willShared: false,
                          wordCount:
                            typeof data.wordCount === "number" ? data.wordCount : undefined,
                          error: undefined,
                          updatedAt: new Date().toISOString(),
                        }
                      : item,
                  ),
                );
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
        !record.willShared &&
        record.status !== "generating" &&
        record.status !== "error",
    );
    if (!candidates.length) return;

    let cancelled = false;
    const checkApprovals = async () => {
      for (const record of candidates) {
        if (cancelled) return;
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
            await shareRecordWithReviewers(
              { ...record, approvalStatus: status, aronDone: true },
              true,
            );
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
    const interval = window.setInterval(() => void checkApprovals(), 30000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [google.connected, hydrated, records, shareRecordWithReviewers]);

  useEffect(() => {
    fetch("/api/google/status", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setGoogle({ loading: false, ...data }))
      .catch(() =>
        setGoogle((current) => ({ ...current, loading: false, connected: false })),
      );

    const frame = window.requestAnimationFrame(() => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("google") === "connected") setNotice("Google Drive connected.");
      if (params.get("google") === "failed") setNotice("Google could not be connected. Try again.");
      if (params.get("setup") === "google") {
        setNotice("Google OAuth needs to be configured in Vercel before you can connect.");
      }
      if (params.size) window.history.replaceState({}, "", "/");
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    fetch("/api/wordpress/status", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setWordpress({ loading: false, ...data }))
      .catch(() => setWordpress({ loading: false, configured: false }));
  }, []);

  const metrics = useMemo(
    () => ({
      total: records.length,
      withAron: records.filter(
        (record) => !record.willShared && record.status === "review",
      ).length,
      withReviewers: records.filter((record) => record.willShared && !record.published).length,
      published: records.filter((record) => record.published).length,
    }),
    [records],
  );

  const unfinishedCount = useMemo(
    () => records.filter((record) => isStalledRecord(record)).length,
    [records],
  );

  const formMemory = useMemo(
    () => {
      const createdPages = records.filter((record) => !isEnhancement(record));
      return {
        websites: recentRecordValues(createdPages, "website"),
        practiceAreas: recentRecordValues(createdPages, "practiceArea"),
        cities: recentRecordValues(createdPages, "city"),
        states: recentRecordValues(createdPages, "state"),
      };
    },
    [records],
  );

  const visibleRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return records;
    return records.filter((record) =>
      [record.pageUrl, record.website, record.practiceArea, record.city, record.state]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [records, search]);

  const approvedDraftRecords = useMemo(
    () =>
      records.filter(
        (record) =>
          !isEnhancement(record) &&
          record.willShared &&
          Boolean(googleDocId(record)) &&
          !record.wordpressDraftCreatedAt,
      ),
    [records],
  );

  function updateForm<K extends keyof DraftInput>(key: K, value: DraftInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateEnhanceForm<K extends keyof EnhanceInput>(key: K, value: EnhanceInput[K]) {
    setEnhanceForm((current) => ({ ...current, [key]: value }));
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

  function openWorkflow(workflow: "create" | "enhance") {
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

  function deleteRecord(record: PageRecord) {
    const title = isEnhancement(record)
      ? enhancementTitle(record)
      : `${formatLocation(record.city, record.state)} · ${record.practiceArea}`;
    const confirmed = window.confirm(
      `Delete "${title}" from the dashboard?${record.docUrl ? " The Google Doc will not be deleted." : ""}`,
    );
    if (!confirmed) return;

    if (record.jobId) pollingJobs.current.delete(record.jobId);
    if (startingBulkJob.current === record.id) startingBulkJob.current = null;
    sharingReviewerJobs.current.delete(record.id);
    setRecords((current) => current.filter((item) => item.id !== record.id));
    setNotice("The page was removed from the dashboard.");
  }

  async function publishToWordPress(record: PageRecord) {
    if (!record.docUrl || !googleDocId(record)) {
      setNotice("The approved Google Doc is missing, so this page cannot be published yet.");
      return;
    }
    if (!record.willShared) {
      setNotice("Complete Aron’s review before publishing this page to WordPress.");
      return;
    }
    if (!wordpress.connected) {
      setNotice(
        wordpress.message ||
          "WordPress needs to be connected in Vercel before this button can publish.",
      );
      return;
    }

    const pageUrl = record.pageUrl || record.website;
    const confirmed = window.confirm(
      `Publish the approved Google Doc to ${pageUrl}? This replaces the page content. A backup will be saved first.`,
    );
    if (!confirmed) return;

    setPublishingToWordPress(record.id);
    setNotice(null);
    try {
      const response = await fetch("/api/wordpress/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docId: googleDocId(record),
          pageUrl,
        }),
      });
      const data = await readApiResponse(response);
      if (data.ok !== true || typeof data.pageId !== "number") {
        throw new Error("WordPress did not confirm that the page was updated.");
      }

      updateRecord(record.id, {
        wordpressPageId: data.pageId,
        wordpressUrl: typeof data.pageUrl === "string" ? data.pageUrl : pageUrl,
        wordpressBackupId:
          typeof data.backupId === "string" ? data.backupId : undefined,
        wordpressPublishedAt:
          typeof data.updatedAt === "string" ? data.updatedAt : new Date().toISOString(),
        published: true,
        status: "published",
        error: undefined,
      });
      setNotice("The approved page was backed up and published to WordPress.");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "The page could not be published to WordPress.",
      );
    } finally {
      setPublishingToWordPress((current) => (current === record.id ? null : current));
    }
  }

  async function createWordPressDraft(
    record: PageRecord,
    options: { confirm?: boolean; quiet?: boolean } = {},
  ) {
    const docId = googleDocId(record);
    if (!record.docUrl || !docId) {
      if (!options.quiet) setNotice("The approved Google Doc is missing, so this draft cannot be created yet.");
      return false;
    }
    if (!record.willShared) {
      if (!options.quiet) setNotice("Complete Aron’s review before creating a WordPress draft.");
      return false;
    }
    if (!wordpress.connected) {
      if (!options.quiet) {
        setNotice(
          wordpress.message ||
            "WordPress needs to be connected in Vercel before drafts can be created.",
        );
      }
      return false;
    }

    const fallbackTitle = `${formatLocation(record.city, record.state)} ${record.practiceArea}`.trim();
    if (options.confirm !== false) {
      const confirmed = window.confirm(
        `Create “${fallbackTitle}” as a WordPress draft? It will not be published automatically.`,
      );
      if (!confirmed) return false;
    }

    setPublishingToWordPress(record.id);
    if (!options.quiet) setNotice(null);
    try {
      const response = await fetch("/api/wordpress/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docId,
          website: record.website,
          fallbackTitle,
        }),
      });
      const data = await readApiResponse(response);
      if (data.ok !== true || typeof data.pageId !== "number") {
        throw new Error("WordPress did not confirm that the draft was created.");
      }

      updateRecord(record.id, {
        wordpressPageId: data.pageId,
        wordpressUrl: typeof data.previewUrl === "string" ? data.previewUrl : undefined,
        wordpressEditUrl: typeof data.editUrl === "string" ? data.editUrl : undefined,
        wordpressDraftCreatedAt:
          typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString(),
        published: false,
        status: "ready",
        error: undefined,
      });
      if (!options.quiet) setNotice("The approved page was created in WordPress as a draft.");
      return true;
    } catch (error) {
      if (!options.quiet) {
        setNotice(
          error instanceof Error ? error.message : "The WordPress draft could not be created.",
        );
      }
      return false;
    } finally {
      setPublishingToWordPress((current) => (current === record.id ? null : current));
    }
  }

  async function createApprovedWordPressDrafts() {
    if (!approvedDraftRecords.length || creatingWordPressBatch) return;
    if (!wordpress.connected) {
      setNotice(
        wordpress.message || "WordPress needs to be connected in Vercel before drafts can be created.",
      );
      return;
    }

    const confirmed = window.confirm(
      `Create ${approvedDraftRecords.length} approved page${approvedDraftRecords.length === 1 ? "" : "s"} as WordPress drafts? Nothing will be published automatically.`,
    );
    if (!confirmed) return;

    setCreatingWordPressBatch(true);
    setNotice(null);
    let created = 0;
    for (const record of approvedDraftRecords) {
      if (await createWordPressDraft(record, { confirm: false, quiet: true })) created += 1;
    }
    setCreatingWordPressBatch(false);
    setNotice(
      created === approvedDraftRecords.length
        ? `${created} approved WordPress draft${created === 1 ? " was" : "s were"} created.`
        : `${created} of ${approvedDraftRecords.length} approved WordPress drafts were created. Open the remaining page actions for details.`,
    );
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
    const pending: PageRecord = {
      id,
      workflow: "create",
      ...submittedForm,
      status: "generating",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      aronDone: false,
      willShared: false,
      published: false,
    };
    setRecords((current) => [pending, ...current]);
    setCreating(true);
    setShowForm(false);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  function pendingEnhancement(id: string, input: EnhanceInput): PageRecord {
    const timestamp = new Date().toISOString();
    return {
      id,
      workflow: "enhance",
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
      willShared: false,
      published: false,
    };
  }

  const queueEnhancement = useCallback(
    async (id: string, input: EnhanceInput) => {
      try {
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workflow: "enhance",
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

  useEffect(() => {
    if (!hydrated || !google.connected || !cloudReady || !stalledResetComplete) return;
    if (startingBulkJob.current) return;

    const activeBulkJob = records.some(
      (record) => record.bulkBatchId && record.status === "generating",
    );
    if (activeBulkJob) return;

    const next = records
      .filter((record) => record.bulkBatchId && record.status === "queued")
      .sort((a, b) => {
        const created = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        return created || (a.bulkPosition || 0) - (b.bulkPosition || 0);
      })[0];
    if (!next) return;

    startingBulkJob.current = next.id;
    let started = false;
    const timeout = window.setTimeout(() => {
      started = true;
      void queueEnhancement(next.id, {
        pageUrl: next.pageUrl || next.website,
        notes: next.notes || "",
      }).finally(() => {
        if (startingBulkJob.current === next.id) startingBulkJob.current = null;
      });
    }, 0);
    return () => {
      window.clearTimeout(timeout);
      if (!started && startingBulkJob.current === next.id) startingBulkJob.current = null;
    };
  }, [cloudReady, google.connected, hydrated, queueEnhancement, records, stalledResetComplete]);

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
      setEnhanceForm(emptyEnhanceForm);
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
    const submissions = bulkImport.urls.map((pageUrl) => ({
      id: crypto.randomUUID(),
      input: { pageUrl, notes: enhanceForm.notes },
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
    setEnhanceForm(emptyEnhanceForm);
    setBulkUrlText("");
    setBulkImport(emptyBulkImport);
    setNotice(
      `${submissions.length} page${submissions.length === 1 ? "" : "s"} added. They will be enhanced one at a time in the order listed.`,
    );
  }

  async function retryRecord(record: PageRecord) {
    if (isEnhancement(record)) {
      setEnhanceForm({
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

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="AMPLIFY Geo Pages home">
          <span className="brand-mark">A</span>
          <span className="brand-word">AMPLIFY</span>
          <span className="brand-product">Geo Pages</span>
        </a>
        <div className="topbar-actions">
          <span
            className={`connection-pill ${wordpress.connected ? "is-connected" : ""}`}
            title={wordpress.message || undefined}
          >
            <span className="connection-dot" />
            {wordpress.loading
              ? "Checking WordPress"
              : wordpress.connected
                ? `WordPress · ${wordpress.siteUrl ? new URL(wordpress.siteUrl).hostname.replace(/^www\./, "") : "connected"}`
                : "WordPress not connected"}
          </span>
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
            <p className="eyebrow"><Sparkles size={14} /> Local authority workflow</p>
            <h1>GEO Pages Created<br />and Shared With Aron</h1>
            <p className="hero-copy">
              Create a new local page or enhance one that is already live. Research, writing,
              Google Docs, and the Aron handoff happen in one flow.
            </p>
          </div>
          <div className="hero-actions">
            <button className="primary-button hero-button" onClick={() => openWorkflow("create")}>
              <Plus size={18} /> New geo page
            </button>
            <button className="secondary-button hero-button" onClick={() => openWorkflow("enhance")}>
              <Sparkles size={17} /> Enhance existing
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

        {showForm && (
          <div id="page-workflow">
            <div className="workflow-switch" role="tablist" aria-label="Choose a page workflow">
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

              <div className="workflow-preview">
                <div><span><Search size={15} /></span><p><b>Research</b><small>Firm + location</small></p></div>
                <i />
                <div><span><Sparkles size={15} /></span><p><b>Write</b><small>Master prompt</small></p></div>
                <i />
                <div><span><FileCheck2 size={15} /></span><p><b>Deliver</b><small>Google Docs</small></p></div>
                <i />
                <div><span><UserRoundCheck size={15} /></span><p><b>Share</b><small>Aron as editor</small></p></div>
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
            ) : (
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
                    <div><span><Search size={15} /></span><p><b>Analyze</b><small>Live page + links</small></p></div>
                    <i />
                    <div><span><Sparkles size={15} /></span><p><b>Enhance</b><small>Dedicated prompt</small></p></div>
                    <i />
                    <div><span><FileCheck2 size={15} /></span><p><b>Deliver</b><small>New Google Doc</small></p></div>
                    <i />
                    <div><span><UserRoundCheck size={15} /></span><p><b>Share</b><small>Aron as editor</small></p></div>
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
            )}
          </div>
        )}

        <section className="metrics" aria-label="Page totals">
          <div><span>All pages</span><strong>{metrics.total}</strong><Globe2 size={18} /></div>
          <div><span>With Aron</span><strong>{metrics.withAron}</strong><Clock3 size={18} /></div>
          <div><span>With Will + Abigail</span><strong>{metrics.withReviewers}</strong><CheckCircle2 size={18} /></div>
          <div><span>Published</span><strong>{metrics.published}</strong><FileCheck2 size={18} /></div>
        </section>

        <section className="queue-card" aria-labelledby="queue-title">
          <div className="queue-header">
            <div>
              <span className="step-number">02</span>
              <div><h2 id="queue-title">Page tracker</h2><p>Aron’s Google approval automatically sends the edited doc to Will and Abigail. A checkbox appears if Approvals aren’t available.</p></div>
            </div>
            <div className="queue-tools">
              <label className="search-box"><Search size={16} /><input aria-label="Search pages" placeholder="Search pages" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
              {approvedDraftRecords.length > 0 && (
                <button
                  className="secondary-button compact wordpress-publish"
                  onClick={() => void createApprovedWordPressDrafts()}
                  disabled={
                    wordpress.loading ||
                    !wordpress.connected ||
                    creatingWordPressBatch ||
                    Boolean(publishingToWordPress)
                  }
                  title={wordpress.connected ? "Create drafts for all approved new pages" : wordpress.message}
                >
                  {creatingWordPressBatch ? <LoaderCircle className="spin" size={15} /> : <FileUp size={15} />}
                  {creatingWordPressBatch
                    ? "Creating drafts…"
                    : `Create ${approvedDraftRecords.length} WP draft${approvedDraftRecords.length === 1 ? "" : "s"}`}
                </button>
              )}
              {unfinishedCount > 0 && (
                <button className="secondary-button compact danger-button" onClick={resetUnfinishedRecords}>
                  <Trash2 size={15} /> Reset unfinished ({unfinishedCount})
                </button>
              )}
              <button className="secondary-button compact" onClick={() => openWorkflow("create")}><Plus size={16} /> New page</button>
              <button className="secondary-button compact" onClick={() => openWorkflow("enhance")}><Sparkles size={15} /> Enhance</button>
            </div>
          </div>

          {!hydrated ? (
            <div className="empty-state"><LoaderCircle className="spin" size={24} /><h3>Loading your tracker</h3></div>
          ) : visibleRecords.length === 0 ? (
            <div className="empty-state">
              <span><FileText size={24} /></span>
              <h3>{records.length ? "No pages match that search" : "Your first page starts here"}</h3>
              <p>{records.length ? "Try a different firm, practice area, city, or URL." : "The tracker keeps new pages, enhanced pages, and every handoff in one place."}</p>
              {!records.length && <button className="text-button" onClick={() => openWorkflow("create")}>Create a geo page <ArrowUpRight size={15} /></button>}
            </div>
          ) : (
            <div className="records">
              {visibleRecords.map((record) => (
                <article className="record" key={record.id}>
                  <div className="record-main">
                    <span className={`record-icon status-${record.status}`}>
                      {record.status === "generating" ? <LoaderCircle className="spin" size={18} /> : record.status === "queued" ? <Clock3 size={18} /> : record.status === "error" ? <X size={18} /> : <FileText size={18} />}
                    </span>
                    <div className="record-copy">
                      <div className="record-title-row">
                        <h3>
                          {isEnhancement(record) ? (
                            <>Enhance <span>·</span> {enhancementTitle(record)}</>
                          ) : (
                            <>{formatLocation(record.city, record.state)} <span>·</span> {record.practiceArea}</>
                          )}
                        </h3>
                        <span className={`workflow-badge ${isEnhancement(record) ? "is-enhancement" : ""}`}>
                          {isEnhancement(record) ? "Existing page" : "New page"}
                        </span>
                        <span className={`status-badge status-${record.status}`}>{statusLabel(record)}</span>
                      </div>
                      <p>{recordHost(record)} <span>•</span> {formatDate(record.createdAt)} {record.wordCount ? <><span>•</span> {record.wordCount.toLocaleString()} words</> : null}</p>
                      {record.error && <p className="record-error">{record.error}</p>}
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
                      {record.docUrl && <a className="doc-link" href={record.docUrl} target="_blank" rel="noreferrer">Open Google Doc <ArrowUpRight size={15} /></a>}
                      <label className={`check-item ${record.docUrl ? "checked" : ""}`}><span>{record.docUrl ? <Check size={14} /> : <Circle size={14} />}</span>Shared with Aron</label>
                      {record.approvalEnabled ? (
                        <label className={`check-item ${record.approvalStatus === "APPROVED" || record.willShared ? "checked" : ""}`}>
                          <span>{record.approvalStatus === "APPROVED" || record.willShared ? <Check size={14} /> : <Circle size={14} />}</span>
                          {record.approvalStatus === "DECLINED" ? "Aron requested changes" : record.approvalStatus === "APPROVED" || record.willShared ? "Aron approved" : "Waiting for Aron’s approval"}
                        </label>
                      ) : (
                        <label className={`check-item ${record.willShared ? "checked" : ""}`}>
                          <input type="checkbox" checked={Boolean(record.willShared)} disabled={!record.docUrl || Boolean(record.willShared) || sharingWithReviewers === record.id} onChange={() => void shareRecordWithReviewers(record)} />
                          <span>{sharingWithReviewers === record.id ? <LoaderCircle className="spin" size={14} /> : record.willShared ? <Check size={14} /> : <Circle size={14} />}</span>{sharingWithReviewers === record.id ? "Sharing with Will + Abigail…" : "Aron finished — send to Will + Abigail"}
                        </label>
                      )}
                      <label className={`check-item ${record.willShared ? "checked" : ""}`}><span>{sharingWithReviewers === record.id ? <LoaderCircle className="spin" size={14} /> : record.willShared ? <Check size={14} /> : <Circle size={14} />}</span>{sharingWithReviewers === record.id ? "Sharing with Will + Abigail…" : "Shared with Will + Abigail"}</label>
                      {isEnhancement(record) ? (
                        record.wordpressPublishedAt ? (
                          <a
                            className="check-item checked wordpress-published"
                            href={record.wordpressUrl || record.pageUrl || record.website}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <span><Check size={14} /></span>
                            Published to WordPress <ArrowUpRight size={13} />
                          </a>
                        ) : record.willShared ? (
                          <button
                            className="secondary-button compact wordpress-publish"
                            onClick={() => void publishToWordPress(record)}
                            disabled={
                              wordpress.loading ||
                              !wordpress.connected ||
                              publishingToWordPress === record.id
                            }
                            title={
                              wordpress.connected
                                ? "Publish the approved Google Doc to the existing WordPress page"
                                : wordpress.message || "Connect WordPress in Vercel to enable publishing"
                            }
                          >
                            {publishingToWordPress === record.id ? (
                              <LoaderCircle className="spin" size={15} />
                            ) : (
                              <Globe2 size={15} />
                            )}
                            {publishingToWordPress === record.id
                              ? "Publishing…"
                              : "Publish to WordPress"}
                          </button>
                        ) : (
                          <label className="check-item">
                            <span><Circle size={14} /></span>Publish to WordPress
                          </label>
                        )
                      ) : (
                        record.wordpressDraftCreatedAt ? (
                          <a
                            className="check-item checked wordpress-published"
                            href={record.wordpressEditUrl || record.wordpressUrl || record.website}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <span><Check size={14} /></span>
                            WordPress draft <ArrowUpRight size={13} />
                          </a>
                        ) : record.willShared ? (
                          <button
                            className="secondary-button compact wordpress-publish"
                            onClick={() => void createWordPressDraft(record)}
                            disabled={
                              wordpress.loading ||
                              !wordpress.connected ||
                              creatingWordPressBatch ||
                              publishingToWordPress === record.id
                            }
                            title={
                              wordpress.connected
                                ? "Create this approved page as a WordPress draft"
                                : wordpress.message || "Connect WordPress in Vercel to enable drafts"
                            }
                          >
                            {publishingToWordPress === record.id ? (
                              <LoaderCircle className="spin" size={15} />
                            ) : (
                              <FileUp size={15} />
                            )}
                            {publishingToWordPress === record.id
                              ? "Creating draft…"
                              : "Create WordPress draft"}
                          </button>
                        ) : (
                          <label className="check-item">
                            <span><Circle size={14} /></span>WordPress draft
                          </label>
                        )
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
          <p>AMPLIFY Geo Pages <span>•</span> Create Prompt v2.0 <span>•</span> Enhancement Prompt</p>
          <button onClick={() => setShowForm((value) => !value)}>{showForm ? "Hide tools" : "Open page tools"} <ChevronDown size={14} /></button>
        </footer>
      </div>
    </main>
  );
}
