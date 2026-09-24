import { currentAIAction, withAIAction, assertAIAvailable } from "@/lib/ai-control.mjs";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { GOOGLE_REFRESH_COOKIE, getGoogleEmail, refreshGoogleAccessToken, withJobGoogleToken } from "@/lib/google";
import { getAronReviewItem, isAronReviewer, saveAronWordPressDraft, saveAronWordPressError } from "@/lib/aron-review-queue";
import { dueUploadIds, getDocUploadConnection, getUploadJob, putUploadJob, uploadLease, type UploadJob } from "@/lib/wordpress-upload-store";
import { sameApprovedDocument, uploadFailure, exhaustedImageReview } from "@/lib/wordpress-upload-policy";
import { POST as buildDraft } from "@/app/api/wordpress/draft/route";

export async function enqueueWordPressUpload(id:string,email:string,verifiedConnection?:{email:string;credential:string}, mode:"intake"|"prepare"="prepare") {
  const record=await getAronReviewItem(id);
  const docId=record?.docUrl.match(/\/document\/d\/([A-Za-z0-9_-]+)/)?.[1];
  if(!record||(record.reviewArchivedAt&&!record.wordpressPageId)||!docId||!sameApprovedDocument(record,docId))throw new Error("Approve this Google Doc before uploading it.");
  if(mode === "prepare" && ["publish","future","trash"].includes(record.wordpressStatus||""))throw new Error("Only unpublished drafts can be prepared.");
  if(record.wordpressPageId && mode === "intake")return;
  const release=await uploadLease(`job:${id}`);
  if(!release)return;
  try {
    const old=await getUploadJob(id);
    if(old&&["queued","uploading","retry"].includes(old.state)&&old.docId===docId){
      const action=currentAIAction();
      if(action && (!old.aiAction || old.aiAction.expiresAt<=Date.now()))await putUploadJob({...old,aiAction:action},Date.now());
      return;
    }
    // The reviewer may not have the creator's per-file OAuth grant. New Docs
    // retain a server-only connection scoped to this exact approved Doc.
    const creator=verifiedConnection||await getDocUploadConnection(docId);
    const reviewerCredential=verifiedConnection?.credential||(await cookies()).get(GOOGLE_REFRESH_COOKIE)?.value;
    const credential=creator?.email===email?reviewerCredential||creator.credential:creator?.credential||reviewerCredential;
    if(!credential)throw new Error("Reconnect Google Drive before queuing an upload.");
    await putUploadJob({id,docId,credential,mode,aiAction:currentAIAction() || undefined,email:creator?.email||email,state:"queued",attempts:0,updatedAt:new Date().toISOString()},Date.now());
  } finally {await release();}
}

export async function runWordPressUpload(id?:string) {
  const releaseWorker=await uploadLease("worker");
  if(!releaseWorker)return {busy:true};
  try {
    const target=id||(await dueUploadIds())[0];
    if(!target)return {idle:true};
    const release=await uploadLease(`job:${target}`);
    if(!release)return {busy:true};
    try {
      const job=await getUploadJob(target);
      if(!job||!["queued","retry","uploading"].includes(job.state))return {idle:true};
      if (!job.aiAction || job.aiAction.expiresAt <= Date.now()) {
        const error="Start preparation explicitly to authorize this saved job.";
        await putUploadJob({...job,state:"blocked",error,nextAttemptAt:undefined,updatedAt:new Date().toISOString()});
        return {blocked:true,error};
      }
      await assertAIAvailable();
      if (job.error && exhaustedImageReview(job.error)) {
        await putUploadJob({...job, state:"blocked", credential:undefined, nextAttemptAt:undefined, updatedAt:new Date().toISOString()});
        await saveAronWordPressError(target,job.error);
        return {blocked:true,id:target,error:job.error};
      }
      const record=await getAronReviewItem(target);
      if(!record||(record.reviewArchivedAt&&!record.wordpressPageId)||!sameApprovedDocument(record,job.docId)) {
        await putUploadJob({...job,credential:undefined,state:"blocked",error:"The approved document changed. Review it before retrying.",updatedAt:new Date().toISOString()});
        return {blocked:true};
      }
      if(record.wordpressPageId && (job.mode !== "prepare" || ["publish","future"].includes(record.wordpressStatus||""))) {
        await putUploadJob({...job,credential:undefined,nextAttemptAt:undefined,state:"complete",updatedAt:new Date().toISOString()});
        return {complete:true};
      }
      if(job.attempts>=3 || (job.pendingChecks || 0)>=30) {
        const error="The upload timed out repeatedly. Review WordPress for a partial draft before retrying.";
        await putUploadJob({...job,credential:undefined,state:"blocked",error,updatedAt:new Date().toISOString()});
        await saveAronWordPressError(target,error);
        return {blocked:true,error};
      }
      const running:UploadJob={...job,state:"uploading",attempts:job.attempts+1,updatedAt:new Date().toISOString()};
      // An interrupted server invocation becomes eligible after its lease expires.
      await putUploadJob(running,Date.now()+610_000);
      try {
        if(!job.credential)throw new Error("Reconnect Google Drive before retrying.");
        const accessToken=await refreshGoogleAccessToken(job.credential);
        const email=await getGoogleEmail(accessToken);
        if(email!==job.email||!isAronReviewer(email))throw new Error("Reconnect an authorized Google account before retrying.");
        const response=await withAIAction(job.aiAction,()=>withJobGoogleToken(accessToken,()=>buildDraft(new NextRequest("https://amplify.internal/api/wordpress/draft",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
          ...record,intakeRecordId:job.mode === "prepare" ? undefined : record.id,docId:job.docId,aronApproved:true,approvedImageReviewId:record.pendingImageReviewId,
        })}))));
        const result=await response.json();
        if (result.preparationPending === true && response.status === 429) {
          const due = Date.now() + 60_000;
          await putUploadJob({ ...running, attempts: job.attempts, pendingChecks: (job.pendingChecks || 0) + 1, state: "retry", error: result.error,
            nextAttemptAt: new Date(due).toISOString(), updatedAt: new Date().toISOString() }, due);
          return { id: target, pending: true };
        }
        if(!response.ok||!result.ok||!Number.isInteger(result.pageId))throw Object.assign(new Error(result.error||"WordPress did not confirm the draft."),{status:response.status});
        await saveAronWordPressDraft(target,result);
        if(job.mode === "prepare" && result.preparationRequired !== false){
          const error=result.warning||"Draft preparation needs review before approval.";
          await putUploadJob({...running,credential:undefined,state:"blocked",error,updatedAt:new Date().toISOString()});
          return {blocked:true,id:target,error};
        }
        await putUploadJob({...running,credential:undefined,nextAttemptAt:undefined,state:"complete",error:undefined,updatedAt:new Date().toISOString()});
        return {complete:true,id:target,pageId:result.pageId};
      } catch(error) {
        const status=typeof error==="object"&&error&&"status" in error?Number(error.status):500;
        const failure=uploadFailure(status,error instanceof Error?error.message:"Upload failed.",running.attempts);
        const due=Date.now()+failure.delayMs;
        await putUploadJob({...running,state:failure.blocked?"blocked":"retry",credential:failure.blocked?undefined:running.credential,error:failure.message,nextAttemptAt:failure.blocked?undefined:new Date(due).toISOString(),updatedAt:new Date().toISOString()},failure.blocked?undefined:due);
        await saveAronWordPressError(target,failure.message);
        return {id:target,blocked:failure.blocked,error:failure.message};
      }
    } finally {await release();}
  } finally {await releaseWorker();}
}

// Drain several small intake uploads each minute; a closed browser cannot stall the queue.
export async function drainWordPressUploads() {
  const results = [];
  const started = Date.now();
  while (results.length < 10 && Date.now() - started < 200_000) {
    const result = await runWordPressUpload();
    if ("idle" in result || "busy" in result) break;
    results.push(result);
  }
  return { processed: results.length, results };
}
