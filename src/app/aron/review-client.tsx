"use client";

import { startVisiblePolling } from "@/lib/visible-polling";
import { reviewErrorMessage } from "@/lib/storage-error";

import { finalApprovalReady } from "@/lib/content-workflow";
import { wordPressPreviewUrl } from "@/lib/wordpress-preview";

import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock3,
  FileText,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatLocation } from "@/lib/location";
import type { AronReviewItem } from "@/lib/aron-review-queue";
import { wordPressReviewDisplay } from "@/lib/aron-wordpress-display";
import { waitingReviewPriority } from "@/lib/aron-review-order";

type QueueResponse = {
  records?: AronReviewItem[];
  archivedRecords?: AronReviewItem[];
  reviewerEmail?: string;
  updatedAt?: string | null;
  error?: string;
};

type QueueView = "waiting" | "approved" | "archive";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently added";
  const today = new Date();
  return date.toDateString() === today.toDateString()
    ? `Today at ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
    : date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function host(record: AronReviewItem) {
  try {
    return new URL(record.pageUrl || record.website).hostname.replace(/^www\./, "");
  } catch {
    return record.website;
  }
}

function enhancementTitle(record: AronReviewItem) {
  try {
    const url = new URL(record.pageUrl || record.website);
    return decodeURIComponent(url.pathname)
      .split("/")
      .filter(Boolean)
      .at(-1)
      ?.replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
      || url.hostname.replace(/^www\./, "");
  } catch {
    return "Existing page";
  }
}

function title(record: AronReviewItem) {
  if (record.workflow === "enhance") return enhancementTitle(record);
  if (["blog", "aop", "subaop"].includes(record.workflow || "")) {
    return record.practiceArea || record.docName || "Content draft";
  }
  return `${formatLocation(record.city, record.state)} · ${record.practiceArea}`;
}

function workflowLabel(record: AronReviewItem) {
  if (record.workflow === "enhance") return "Enhancement";
  if (record.workflow === "blog") return "Blog";
  if (record.workflow === "aop") return "AOP";
  if (record.workflow === "subaop") return "Sub-AOP";
  return "GEO page";
}

function isApproved(record: AronReviewItem) {
  return record.aronDone || record.approvalStatus === "APPROVED";
}

function stableWaitingOrder(left: AronReviewItem, right: AronReviewItem) {
  return waitingReviewPriority(right) - waitingReviewPriority(left)
    || left.createdAt.localeCompare(right.createdAt)
    || (left.clientName || "").localeCompare(right.clientName || "")
    || title(left).localeCompare(title(right))
    || left.id.localeCompare(right.id);
}

function stableApprovedOrder(left: AronReviewItem, right: AronReviewItem) {
  const leftDate = left.updatedAt || left.approvedAt || left.createdAt;
  const rightDate = right.updatedAt || right.approvedAt || right.createdAt;
  return rightDate.localeCompare(leftDate)
    || (left.clientName || "").localeCompare(right.clientName || "")
    || title(left).localeCompare(title(right))
    || left.id.localeCompare(right.id);
}

async function recordWordPressFailure(record: AronReviewItem, message: string) {
  const response = await fetch("/api/aron/review-queue", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: record.id, action: "wordpress-error", error: message }),
  }).catch(() => null);
  if (!response) return null;
  const data = await response.json().catch(() => ({})) as { record?: AronReviewItem };
  return data.record || null;
}

export default function AronReview() {
  const [records, setRecords] = useState<AronReviewItem[]>([]);
  const [archivedRecords, setArchivedRecords] = useState<AronReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [reviewerEmail, setReviewerEmail] = useState("");
  const [search, setSearch] = useState("");
  const [queueView, setQueueView] = useState<QueueView>("waiting");
  const [error, setError] = useState("");
  const [statusCode, setStatusCode] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const loadingQueue = useRef(false);
  const loadQueue = useCallback(async (quiet = false) => {
    if (loadingQueue.current) return;
    loadingQueue.current = true;
    if (!quiet) setRefreshing(true);
    try {
      const response = await fetch("/api/aron/review-queue", { cache: "no-store" });
      const data = await response.json() as QueueResponse;
      if (!response.ok) throw Object.assign(new Error(data.error || "The review queue could not be loaded."), { status: response.status });
      setRecords(Array.isArray(data.records) ? data.records : []);
      setArchivedRecords((data.archivedRecords || []).sort(stableApprovedOrder));
      setReviewerEmail(data.reviewerEmail || "");
      setError("");
      setStatusCode(null);
      return true;
    } catch (loadError) {
      const message = reviewErrorMessage(loadError, "The review queue could not be loaded.");
      const code = typeof loadError === "object" && loadError && "status" in loadError
        ? Number((loadError as { status?: unknown }).status)
        : null;
      setError(message);
      setStatusCode(Number.isFinite(code) ? code : null);
      return false;
    } finally {
      loadingQueue.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => startVisiblePolling(() => loadQueue(true)), [loadQueue]);

  const waitingRecords = useMemo(
    () => records
      .filter((record) => record.status === "review" && !isApproved(record))
      .sort(stableWaitingOrder),
    [records],
  );
  const approvedRecords = useMemo(
    () => records
      .filter(isApproved)
      .sort(stableApprovedOrder),
    [records],
  );

  const visibleRecords = useMemo(() => {
    const viewRecords = queueView === "archive" ? archivedRecords : queueView === "approved" ? approvedRecords : waitingRecords;
    const query = search.trim().toLowerCase();
    if (!query) return viewRecords;
    return viewRecords.filter((record) => [
      title(record),
      record.clientName,
      record.practiceArea,
      record.city,
      record.state,
      record.jurisdiction,
      host(record),
    ].filter(Boolean).join(" ").toLowerCase().includes(query));
  }, [approvedRecords, archivedRecords, queueView, search, waitingRecords]);

  const selectedVisible = visibleRecords.filter(record => selectedIds.has(record.id));
  const allSelected = visibleRecords.length > 0 && selectedVisible.length === visibleRecords.length;

  async function deleteSelected() {
    if (deleting || approvingId || !selectedVisible.length) return;
    setDeleting(true);
    setDeleteError("");
    const ids = selectedVisible.map(record => record.id);
    try {
      const response = await fetch("/api/aron/review-queue", {
        method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "The selected entries could not be deleted.");
      setSelectedIds(new Set());
      setNotice(`${data.deletedIds.length} ${data.deletedIds.length === 1 ? "entry deleted" : "entries deleted"}. Google Docs and WordPress pages are unchanged.`);
      await loadQueue(true);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "The selected entries could not be deleted.");
    } finally {
      setDeleting(false);
    }
  }

  async function approve(record: AronReviewItem) {
    if (approvingId) return;
    setApprovingId(record.id);
    setError("");
    setNotice("");
    let approvedRecord: AronReviewItem | null = null;
    try {
      const response = await fetch("/api/aron/review-queue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: record.id, action: "approve" }),
      });
      const data = await response.json() as QueueResponse & { ok?: boolean; record?: AronReviewItem };
      if (!response.ok || data.ok !== true) {
        throw new Error(data.error || "The approval could not be saved.");
      }
      approvedRecord = data.record || {
        ...record,
        aronDone: true,
        approvalStatus: "APPROVED",
        status: "ready",
        updatedAt: new Date().toISOString(),
      };
      const savedApproval = approvedRecord;
      setRecords((current) => current.map((item) => item.id === record.id ? savedApproval : item));
      setQueueView("approved");
      setNotice(`Approved “${title(record)}”. Its WordPress draft is queued on the server. You can close this tab; uploads and temporary retries continue in the background.`);
      await loadQueue(true);
    } catch (approvalError) {
      const message = approvalError instanceof Error ? approvalError.message : "The approval could not be saved.";
      if (approvedRecord) {
        const failedRecord = await recordWordPressFailure(approvedRecord, message);
        if (failedRecord) {
          setRecords((current) => current.map((item) => item.id === record.id ? failedRecord : item));
        }
        setError(`Aron’s approval was saved, but the WordPress draft needs attention: ${message}`);
      } else {
        setError(message);
      }
    } finally {
      setApprovingId(null);
    }
  }

  async function recoverUploads() {
    if (approvingId) return;
    setApprovingId("recovery"); setError(""); setNotice("Checking Aron-approved work and queuing unfinished WordPress preparation…");
    try {
      const response = await fetch("/api/aron/recover-uploads", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Draft recovery failed.");
      setNotice(`${result.archived || 0} entries archived. ${result.reconciled || 0} already-published entries reconciled. ${result.queued} approved drafts queued. ${result.connectionsSaved} document connections verified. ${result.inaccessible} Docs need access from their owner.${result.errors?.length ? ` ${result.errors.length} items need attention.` : ""} Uploads continue on the server.`);
      await loadQueue(true);
      if (result.errors?.length) setError(result.errors.join("\n"));
    } catch (error) { setError(error instanceof Error ? error.message : "Draft recovery failed."); }
    finally { setApprovingId(null); }
  }

  async function retryWordPress(record: AronReviewItem) {
    if (approvingId || !isApproved(record) || record.wordpressPageId) return;
    setApprovingId(record.id);
    setError("");
    setNotice(`Uploading “${title(record)}” to WordPress now.`);
    try {
      const response=await fetch("/api/aron/review-queue",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:record.id,action:"retry-upload"})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"The upload could not be queued.");
      setNotice(`“${title(record)}” is queued for a duplicate-safe WordPress draft upload. You can close this tab.`);
      await loadQueue(true);
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "The WordPress draft could not be created.";
      const failedRecord = await recordWordPressFailure(record, message);
      if (failedRecord) {
        setRecords((current) => current.map((item) => item.id === record.id ? failedRecord : item));
      }
      setError(`The WordPress draft still needs attention: ${message}`);
    } finally {
      setApprovingId(null);
    }
  }

  async function refreshWordPress(record: AronReviewItem) {
    if (approvingId || !isApproved(record) || !record.wordpressPageId) return;
    setApprovingId(record.id);
    setNotice("");
    try {
      await loadQueue(true);
    } finally {
      setApprovingId(null);
    }
  }

  return (
    <main className="aron-shell">
      <header className="aron-topbar">
        <Link className="brand" href="/" aria-label="AMPLIFY Content dashboard">
          <span className="brand-mark">A</span>
          <span className="brand-word">AMPLIFY</span>
          <span className="brand-product">Aron Review</span>
        </Link>
        <div className="aron-topbar-actions">
          {reviewerEmail && <span className="connection-pill is-connected"><span className="connection-dot" />{reviewerEmail}</span>}
          <button className="secondary-button compact" disabled={deleting || Boolean(approvingId)} onClick={() => void recoverUploads()}>Recover approved drafts</button>
          <Link className="secondary-button compact" href="/"><ArrowLeft size={15} /> Content dashboard</Link>
        </div>
      </header>

      <div className="aron-page">
        <section className="aron-hero">
          <div>
            <p className="eyebrow"><ShieldCheck size={14} /> Private editorial queue</p>
            <h1>Ready when you are, Aron.</h1>
            <p>Open each draft in Google Docs, make any edits there, then approve it here when the content is ready to move forward.</p>
          </div>
          <div className="aron-count" aria-label={loading || error ? "Draft count unavailable" : `${waitingRecords.length} drafts waiting`}>
            <span>Waiting for approval</span>
            <strong>{loading || error ? "—" : waitingRecords.length}</strong>
            <Clock3 size={20} />
          </div>
        </section>

        {notice && <div className="aron-notice" role="status"><CheckCircle2 size={18} /><span>{notice}</span></div>}

        {error && !loading && (
          <div className="aron-error" role="alert">
            <div><ShieldCheck size={20} /></div>
            <section>
              <strong>{statusCode === 401 ? "Connect an AMPLIFY Google account" : statusCode === 403 ? "Use an approved AMPLIFY account" : "The queue needs attention"}</strong>
              <p>{error}</p>
              <button className="secondary-button compact" type="button" disabled={refreshing} onClick={() => void loadQueue()}>{refreshing ? "Retrying…" : "Try again"}</button>
              {(statusCode === 401 || statusCode === 403) && (
                <a className="primary-button" href="/api/google/connect?returnTo=/aron">Connect Google</a>
              )}
            </section>
          </div>
        )}

        {!error && (
          <section className="aron-queue" aria-labelledby="aron-queue-title">
            <header>
              <div>
                <span>Content review</span>
                <h2 id="aron-queue-title">{queueView === "archive" ? "Archived content" : queueView === "approved" ? "Already approved by Aron" : "Waiting for your approval"}</h2>
              </div>
              <div className="aron-tools">
                <label className="search-box"><Search size={16} /><input aria-label="Search approval queue" placeholder="Search drafts" value={search} onChange={(event) => { setSearch(event.target.value); setSelectedIds(new Set()); }} /></label>
                <button className="secondary-button compact" type="button" onClick={() => void loadQueue()} disabled={refreshing}>
                  <RefreshCw className={refreshing ? "spin" : ""} size={15} /> Refresh
                </button>
              </div>
            </header>

            <div className="aron-status-tabs" role="tablist" aria-label="Filter approval queue">
              <button
                type="button"
                role="tab"
                aria-selected={queueView === "waiting"}
                className={queueView === "waiting" ? "active" : ""}
                onClick={() => { setQueueView("waiting"); setSelectedIds(new Set()); setDeleteError(""); }} disabled={deleting}
              >
                Waiting for approval <span>{waitingRecords.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={queueView === "approved"}
                className={queueView === "approved" ? "active" : ""}
                onClick={() => { setQueueView("approved"); setSelectedIds(new Set()); setDeleteError(""); }} disabled={deleting}
              >
                Approved by Aron <span>{approvedRecords.length}</span>
              </button>
              <button type="button" role="tab" aria-selected={queueView === "archive"}
                className={queueView === "archive" ? "active" : ""} onClick={() => { setQueueView("archive"); setSelectedIds(new Set()); setDeleteError(""); }} disabled={deleting}>
                Archive <span>{archivedRecords.length}</span>
              </button>
            </div>

            {!loading && visibleRecords.length > 0 && (
              <div className="aron-bulk-tools">
                <label><input type="checkbox" aria-label="Select all visible entries" checked={allSelected}
                  ref={element => { if (element) element.indeterminate = selectedVisible.length > 0 && !allSelected; }}
                  disabled={deleting} onChange={() => setSelectedIds(allSelected ? new Set() : new Set(visibleRecords.map(record => record.id)))} />
                  Select all {search.trim() ? "matches" : "in this tab"} ({visibleRecords.length})</label>
                <span>{selectedVisible.length} selected</span>
                <button className="secondary-button compact aron-delete" type="button" onClick={() => void deleteSelected()}
                  disabled={deleting || Boolean(approvingId) || !selectedVisible.length}>
                  {deleting ? <LoaderCircle className="spin" size={15} /> : <Trash2 size={15} />}
                  {deleting ? "Deleting…" : `Delete selected (${selectedVisible.length})`}
                </button>
                <small>Removes AMPLIFY entries only. Google Docs and WordPress pages are kept.</small>
              </div>
            )}
            {deleteError && <p className="aron-delete-error" role="alert">{deleteError}</p>}
            {loading ? (
              <div className="aron-empty"><LoaderCircle className="spin" size={26} /><h3>Loading your review queue</h3></div>
            ) : visibleRecords.length === 0 ? (
              <div className="aron-empty">
                <span><Check size={24} /></span>
                <h3>{search.trim() ? "No drafts match your search" : queueView === "archive" ? "No archived content yet" : queueView === "approved" ? "No approved drafts waiting" : "You’re all caught up"}</h3>
                <p>{search.trim() ? "Try a firm, location, practice area, or page title." : queueView === "archive" ? "Published content and previously archived items are saved here with their Google Doc and WordPress links." : queueView === "approved" ? "Approved drafts and scheduled posts stay here. Published items move to Archive when publication is confirmed." : "New Google Docs will appear here automatically when they are ready for your review."}</p>
              </div>
            ) : (
              <div className="aron-records">
                {visibleRecords.map((record) => (
                  <article className={`aron-record ${isApproved(record) ? "is-approved" : ""}`} key={record.id}>
                    <label className="aron-row-select"><input type="checkbox" aria-label={`Select ${record.clientName || host(record)}: ${title(record)}`}
                      checked={selectedIds.has(record.id)} disabled={deleting}
                      onChange={() => setSelectedIds(current => { const next = new Set(current); if (next.has(record.id)) next.delete(record.id); else next.add(record.id); return next; })} />
                      <FileText size={19} aria-hidden="true" /></label>
                    <div className="aron-record-copy">
                      <div className="aron-record-labels">
                        <span>{workflowLabel(record)}</span>
                        {record.clientName && <span>{record.clientName}</span>}
                        {waitingReviewPriority(record) > 0 && <span>Pinned to top</span>}
                        {isApproved(record) && <span className="aron-approved-label"><Check size={11} /> Approved by Aron</span>}
                        {queueView !== "archive" && isApproved(record) && !record.wordpressPageId && !["queued","uploading","retry"].includes(record.upload?.state || "") && <span className="aron-wordpress-needed-label">WordPress not uploaded</span>}
                        {record.wordpressPageId && <span className="aron-wordpress-ready-label"><Check size={11} /> {wordPressReviewDisplay(record).label}</span>}
                        {queueView !== "archive" && record.upload && !record.wordpressPageId && <span>{({queued:"Draft preparation queued",uploading:"Preparing WordPress draft",retry:"Preparation retry scheduled",blocked:"Preparation needs attention",complete:"Draft preparation complete"})[record.upload.state]}</span>}
                      </div>
                      <h3>{title(record)}</h3>
                      {record.reviewArchivedAt && <p>Archived {formatDate(record.reviewArchivedAt)}</p>}
                      {record.wordpressPageId && wordPressReviewDisplay(record).draft && Boolean(record.draftWarnings?.length) && <details><summary>Publication preparation notes</summary>{record.draftWarnings?.map((warning, index) => <p key={index} role="note">{warning}</p>)}</details>}
                      <p>{host(record)} <span>•</span> {formatDate(record.createdAt)} {record.wordCount ? <><span>•</span> {record.wordCount.toLocaleString()} words</> : null}</p>
                      {queueView !== "archive" && isApproved(record) && !record.wordpressPageId && (record.upload ? record.upload.error : record.error) && <p role="note" style={{color:"#8d410d",maxWidth:720}}>{record.upload ? record.upload.error : record.error}</p>}
                      {record.wordpressStatusError && <p role="alert">{record.wordpressStatusError}</p>}
                      {record.wordpressPageId && wordPressReviewDisplay(record).note && <p role="note">{wordPressReviewDisplay(record).note}</p>}
                      {record.wordpressPageId && wordPressReviewDisplay(record).draft && <p><Link href={finalApprovalReady(record) ? `/final-review/${encodeURIComponent(record.id)}` : `/?record=${encodeURIComponent(record.id)}`}>{finalApprovalReady(record) ? "Open final approval" : "Open this item’s preparation"}</Link></p>}
                      {queueView !== "archive" && record.upload?.state === "blocked" && /Google Doc access/.test(record.upload.error || "") && <p><a href="/api/google/connect?existingDocs=1&returnTo=%2Faron">Reconnect for existing Docs</a> — Google will ask you to grant read access to existing Drive files. Use the account that can open this approved Doc.</p>}
                    </div>
                    <div className="aron-record-actions">
                      <a className="secondary-button" href={record.docUrl} target="_blank" rel="noreferrer">
                        Open Google Doc <ArrowUpRight size={16} />
                      </a>
                      {record.wordpressPageId ? (
                        <>
                          <a className="primary-button aron-approve is-approved" href={record.wordpressStatus === "draft" ? `/final-review/${encodeURIComponent(record.id)}` : wordPressPreviewUrl(record) || record.wordpressEditUrl} target="_blank" rel="noreferrer">
                            <CheckCircle2 size={17} /> {finalApprovalReady(record) ? "Review & approve" : record.wordpressStatus === "draft" ? "View preparation status" : wordPressReviewDisplay(record).action}
                          </a>
                          <a className="secondary-button compact" href={record.wordpressEditUrl} target="_blank" rel="noreferrer">Edit in WordPress</a>
                          <button className="secondary-button compact" type="button" onClick={() => void refreshWordPress(record)} disabled={deleting || Boolean(approvingId)}>
                            {approvingId === record.id
                              ? <><LoaderCircle className="spin" size={15} /> Refreshing…</>
                              : <><RefreshCw size={15} /> Check WordPress status</>}
                          </button>
                        </>
                      ) : queueView === "archive" ? null : isApproved(record) ? (
                        <button className="primary-button aron-approve needs-wordpress" type="button" onClick={() => void retryWordPress(record)} disabled={deleting || Boolean(approvingId) || ["queued","uploading","retry"].includes(record.upload?.state || "")}>
                          {approvingId === record.id
                            ? <><LoaderCircle className="spin" size={17} /> Uploading…</>
                            : <><RefreshCw size={17} /> {["queued","uploading","retry"].includes(record.upload?.state || "") ? (record.upload?.state === "uploading" ? "Preparing draft…" : record.upload?.state === "retry" ? "Retry scheduled" : "Upload queued") : record.upload?.state === "blocked" ? "Retry preparation" : "Upload to WordPress"}</>}
                        </button>
                      ) : (
                        <button className="primary-button aron-approve" type="button" onClick={() => void approve(record)} disabled={deleting || Boolean(approvingId)}>
                          {approvingId === record.id
                            ? <><LoaderCircle className="spin" size={17} /> Approving…</>
                            : <><Check size={17} /> Approve & upload draft</>}
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
