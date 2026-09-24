"use client";
import {startVisiblePolling} from "@/lib/visible-polling";
import {reviewErrorMessage} from "@/lib/storage-error";
import { WorkflowChecklist } from "@/components/workflow-checklist";
import { contentWorkflow, finalApprovalReady } from "@/lib/content-workflow";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { AronReviewItem } from "@/lib/aron-review-queue";
import type { EditorialSlot } from "@/lib/editorial";
import { wordPressPreviewUrl, wordPressPreviewLoginUrl } from "@/lib/wordpress-preview";

class AuthorityPendingError extends Error {}
async function json(url: string, body?: object, method = "POST") {
  const response = await fetch(url, body ? { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
  const data = await response.json();
  if (!response.ok && data.authorityPending) throw new AuthorityPendingError(data.error);
  if (!response.ok) throw new Error(reviewErrorMessage(new Error(data.error || "The review could not be loaded.")));
  return data;
}
export default function FinalReview() {
  const { id } = useParams<{ id: string }>();
  const [record, setRecord] = useState<AronReviewItem>();
  const [slot, setSlot] = useState<EditorialSlot>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const [authorityReady, setAuthorityReady] = useState(false);
  const [authorityRetry, setAuthorityRetry] = useState(0);
  useEffect(() => {
    if (!record || record.workflow !== "blog" || !finalApprovalReady(record) || ["publish","future"].includes(record.wordpressStatus || "")) return;
    let active = true;
    let stop = () => {};
    setAuthorityReady(false);
    const verify = async () => {
      try {
        await json("/api/wordpress/go-live", {recordId:record.id, clientId:record.clientId, pageId:record.wordpressPageId, docId:record.docUrl.match(/\/d\/([^/]+)/)?.[1], workflow:"blog", verifyOnly:true});
        if (active) {setAuthorityReady(true);setError("");stop();}
        return true;
      } catch (e) {
        if (active && !(e instanceof AuthorityPendingError)) {setError(e instanceof Error ? e.message : "Draft verification failed.");stop();}
        return true;
      }
    };
    stop = startVisiblePolling(verify, 30000);
    return () => {active=false;stop();};
  }, [record?.id, record?.wordpressPageId, record?.wordpressStatus, record?.preparationRequired, authorityRetry]);
  const [linking, setLinking] = useState<{state:string; pending:string[]; changedUrls:string[]; indexing:string} | null>(null);
  useEffect(() => {
    if (!record?.clientId || !record.wordpressPageId || !["publish","future"].includes(record.wordpressStatus || "")) return;
    let active = true;
    const refresh = async () => {
      try { const data = await json(`/api/wordpress/post-publication?clientId=${encodeURIComponent(record.clientId!)}&pageId=${record.wordpressPageId}&endpoint=${record.workflow === "blog" ? "posts" : "pages"}`); if(active)setLinking(data.job); return true; }
      catch { return false; }
    };
    void refresh();
    const stop = startVisiblePolling(refresh, 60000);
    return () => { active=false; stop(); };
  }, [record?.clientId, record?.wordpressPageId, record?.wordpressStatus, record?.workflow]);
  useEffect(() => { let active = true; (async () => {
    try {
      const [queue, calendar] = await Promise.all([json(`/api/aron/review-queue?id=${encodeURIComponent(id)}`), json("/api/editorial")]);
      const found = [...queue.records, ...queue.archivedRecords].find((r: AronReviewItem) => r.id === id);
      if (!found) throw new Error("This content could not be found in the review queue.");
      if (active) { setRecord(found); setSlot(calendar.slots.find((s: EditorialSlot) => s.contentRecordId === id)); }
    } catch (e) { if (active) setError(e instanceof Error ? e.message : "Review unavailable."); }
  })(); return () => { active = false; }; }, [id]);
  useEffect(()=>{
    if(!["queued","uploading","retry"].includes(record?.upload?.state||""))return;
    let active=true;
    const stop=startVisiblePolling(async()=>{try{
      const queue=await json(`/api/aron/review-queue?id=${encodeURIComponent(id)}`);
      if(active&&queue.records?.[0]){setRecord(queue.records[0]);setError("");}
    }catch(e){if(active)setError(reviewErrorMessage(e,"Status refresh failed."));return false;}},30000);
    return()=>{active=false;stop();};
  },[id,record?.upload?.state]);
  const preparationError = record?.upload ? record.upload.error : record?.error;
  const ready = Boolean(record && finalApprovalReady(record));
  const flow = record && contentWorkflow(record);
  const terminal = flow?.done === true;
  const future = record?.workflow === "blog" && slot && Date.parse(slot.publishAt) > Date.now();
  const action = record?.workflow === "enhance" ? "Approve & update existing page" : future ? "Approve & schedule" : "Approve & publish";
  const preview = record && wordPressPreviewUrl(record);
  const previewLogin = record && wordPressPreviewLoginUrl(record);
  async function prepare() {
    if(!record?.aronDone || busy || terminal || (ready && !error))return;
    setBusy(true);setError("");
    try {
      await json("/api/aron/review-queue",{id:record.id,action:"prepare"},"PATCH");
      setAuthorityReady(false);
      setRecord({...record,preparationRequired:true,upload:{state:"queued",attempts:0,updatedAt:new Date().toISOString()}});
    } catch(e){setError(e instanceof Error?e.message:"Preparation could not finish.");}
    finally {setBusy(false);}
  }
  async function approve() {
    if (!record || !ready || busy || (record.workflow === "blog" && !authorityReady)) return;
    setBusy(true); setError("");
    try {
      const [queue, calendar] = await Promise.all([json(`/api/aron/review-queue?id=${encodeURIComponent(id)}`), json("/api/editorial")]);
      const fresh = [...queue.records, ...queue.archivedRecords].find((r: AronReviewItem) => r.id === id);
      const assigned = calendar.slots.find((s: EditorialSlot) => s.contentRecordId === id);
      if (!fresh || !finalApprovalReady(fresh) || fresh.wordpressPageId !== record.wordpressPageId) throw new Error("The draft status changed. Reload this review before approving.");
      if (record.workflow === "blog" && (assigned?.id !== slot?.id || assigned?.publishAt !== slot?.publishAt)) throw new Error("The publishing slot changed. Reload before approving.");
      const docId = record.docUrl.match(/\/d\/([^/]+)/)?.[1];
      const saved = await json("/api/wordpress/go-live", { recordId: record.id, clientId: record.clientId, pageId: record.wordpressPageId, docId, workflow: record.workflow, ownerApproved: true, publishAt: record.workflow === "blog" ? assigned?.publishAt : undefined });
      if (!saved.ok || !["publish", "future"].includes(saved.status)) throw new Error("WordPress did not confirm publication or scheduling.");
      setResult(saved.status === "future" ? "Approved and scheduled in WordPress." : "Approved and published on WordPress.");
      setLinking(saved.linking || null);
      setRecord({ ...record, wordpressStatus: saved.status, wordpressUrl: saved.pageUrl || record.wordpressUrl });
      try {
        if (assigned) await json("/api/editorial", { action: "sync_status", slotId: assigned.id, status: saved.status === "future" ? "scheduled" : "published" });
        await json(`/api/aron/review-queue?id=${encodeURIComponent(id)}`);
      } catch { setError("WordPress saved successfully, but the calendar status could not refresh. Refresh the calendar to reconcile it."); }
    } catch (e) {
      if (e instanceof AuthorityPendingError) {setAuthorityReady(false);setAuthorityRetry(n=>n+1);setError("");}
      else setError(e instanceof Error ? e.message : "Approval failed.");
    }
    finally { setBusy(false); }
  }
  return <main className="final-review-page">
    <header className="final-review-toolbar"><Link href="/attention">← Your approvals</Link><h1>{record?.practiceArea || record?.docName || "Final page review"}</h1>
      {slot && <p>Assigned date: {new Date(slot.publishAt).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "full", timeStyle: "short" })} Eastern.{!future && ready && record?.workflow === "blog" && " This date has passed; approval publishes now."}</p>}
      {record?.workflow === "blog" && !slot && ready && !terminal && <p>No calendar date is assigned to this blog. Approval publishes it now.</p>}
      {preview && terminal && <a className="secondary-button compact" href={preview} target="_blank" rel="noreferrer">{record?.wordpressStatus === "publish" ? "Open published page ↗" : "Preview scheduled page ↗"}</a>}
      {ready && !result && <><p>Preview the page and images. Selecting approve authorizes this version for publication or scheduling.</p><button className="primary-button" disabled={busy || (record?.workflow === "blog" && !authorityReady)} onClick={() => void approve()}>{busy ? "Saving approval…" : record?.workflow === "blog" && !authorityReady ? "Verifying draft…" : action}</button>{record?.workflow === "blog" && !authorityReady && !error && <p role="status">Checking the saved draft’s authority sources. This page updates automatically when verification finishes.</p>}</>}
      {record && !ready && !result && <div><p><strong>{flow?.label}</strong></p><p>{flow?.note}</p>{!terminal && <>{record.aronDone && <button className="primary-button" disabled={busy || ["queued","uploading","retry"].includes(record.upload?.state || "")} onClick={()=>void prepare()}>{busy || ["queued","uploading","retry"].includes(record.upload?.state||"") ? "Preparation running in background…" : "Prepare for final approval"}</button>}<p><Link href={`/?record=${encodeURIComponent(record.id)}`}>Open this item’s preparation →</Link></p>{Boolean(preparationError || record.draftWarnings?.length) && <details open><summary>What needs fixing</summary>{preparationError && <p>{preparationError}</p>}{record.draftWarnings?.map((warning,index)=><p key={index}>{warning}</p>)}</details>}</>}</div>}
      {record && <WorkflowChecklist record={record} authorityVerified={record.workflow === "blog" && !terminal ? authorityReady : undefined}/>}
      {ready && error && record?.workflow === "blog" && !authorityReady && <button className="secondary-button" disabled={busy} onClick={()=>void prepare()}>Prepare corrected draft</button>}
      {result && <p role="status">{result}</p>}{error && <p role="alert">{error} {!record && <button className="secondary-button compact" onClick={() => window.location.reload()}>Try again</button>}</p>}
      {linking && <section aria-label="Post-publication checks"><p><strong>Internal links:</strong> {linking.state === "complete" ? "Reconciled and verified." : linking.state === "waiting_publication" ? "Waiting for the scheduled page to go live." : linking.state === "needs_attention" ? "Needs attention." : "Reconciliation queued or running."}</p>{linking.pending?.map((message,index)=><p key={index}>{message}</p>)}<p><strong>Google indexing request:</strong> Pending individual Search Console submission.</p><Link href="/post-publication">Review or retry link reconciliation →</Link></section>}
    </header>
    {preview && !terminal && <section className="editorial-panel" style={{marginTop:24}}><h2>{ready ? "Review the finished page" : "Preview the current draft"}</h2><p>{ready ? "Preview the finished draft with the website’s theme before approving it." : "This is an unfinished WordPress draft. Its layout, banner, images or other preparation may still change."} This review screen stays open in this tab.</p><a className="primary-button" href={preview} target="_blank" rel="noreferrer">Preview page in WordPress ↗</a>{previewLogin && <p>If the preview shows “Page not found,” your WordPress browser session may be signed out. <a href={previewLogin} target="_blank" rel="noreferrer">Sign in to view preview ↗</a>. After signing in, WordPress returns you to this draft.</p>}{ready && <p className="final-review-help">After reviewing the page and images, return here and select “{action}.” You may need to sign in to the client’s WordPress site to view its private draft.</p>}</section>}
    {!record && !error && <p>Loading final review…</p>}
  </main>;
}
