import { currentAIAction } from "@/lib/ai-control.mjs";
import { refreshAronWordPressStatuses } from "@/lib/aron-wordpress-status";
import { archiveHistoricalFulginitiQueue, listAronReviewItems, isAronReviewer, returnAronDraftToPreparation } from "@/lib/aron-review-queue";
import { getUploadJob, getDocUploadConnection, saveDocUploadConnection } from "@/lib/wordpress-upload-store";
import { finalApprovalReady } from "@/lib/content-workflow";
import { enqueueWordPressUpload } from "@/lib/wordpress-upload-worker";
import { reconcileConfirmedPublishedBacklog } from "@/lib/published-backlog-reconciliation";

// Verify each exact Doc before retaining this account's existing connection.
// No new Google permissions are granted by recovery.
export async function recoverWordPressUploads(accessToken: string, email: string, credential: string, explicitRecovery = false) {
  if (!isAronReviewer(email)) throw new Error("An approved AMPLIFY account is required.");
  const published = explicitRecovery ? await reconcileConfirmedPublishedBacklog(accessToken) : { reconciled: 0, errors: [] as string[] };
  const archived = explicitRecovery ? await archiveHistoricalFulginitiQueue() : 0;
  const statusErrors = explicitRecovery ? await refreshAronWordPressStatuses(await listAronReviewItems(), accessToken) : new Map<string, string>();
  const records = (await listAronReviewItems()).filter(record => (!record.reviewArchivedAt || (explicitRecovery && record.reviewArchiveReason === "wordpress-upload")) && record.docUrl
    && (record.aronDone || record.approvalStatus === "APPROVED")
    && !["publish", "future", "trash"].includes(record.wordpressStatus || "")
    && !record.finalApprovedAt
    && !published.errors.some(error => error.startsWith(`${record.id}:`))
    && !finalApprovalReady(record))
    .sort((a,b) => (b.approvedAt || "").localeCompare(a.approvedAt || ""));
  const result = { archived, checked: 0, connectionsSaved: 0, queued: 0, inaccessible: 0, reconciled: published.reconciled, errors: [...published.errors] };
  for (let start = 0; start < records.length; start += 5) {
    await Promise.all(records.slice(start, start + 5).map(async record => {
      const docId = record.docUrl.match(/\/document\/d\/([A-Za-z0-9_-]+)/)?.[1];
      if (!docId) return;
      try {
        result.checked++;
        if (statusErrors.has(record.id)) throw new Error(statusErrors.get(record.id));
        const job = await getUploadJob(record.id);
        if (job && ["queued", "uploading", "retry"].includes(job.state)) return;
        if (!explicitRecovery && job?.state === "blocked") return;
        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${docId}?fields=id,mimeType,trashed,appProperties&supportsAllDrives=true`, {
          headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store", signal: AbortSignal.timeout(20_000),
        });
        if ([403, 404].includes(response.status)) { result.inaccessible++; return; }
        if (!response.ok) throw new Error(`Google access check returned ${response.status}.`);
        const doc = await response.json();
        if (doc.trashed || doc.mimeType !== "application/vnd.google-apps.document" || !doc.appProperties?.amplifyResponseId) return;
        const existingConnection = await getDocUploadConnection(docId);
        // A reviewer who can read a shared Doc must not replace its creator's
        // connection (the creator also owns the private client configuration).
        const connection = existingConnection && existingConnection.email !== email
          ? existingConnection : { email, credential };
        if (connection.email === email) await saveDocUploadConnection(docId, connection);
        result.connectionsSaved++;
        if (!explicitRecovery || !currentAIAction()) return;
        if (!(record.aronDone || record.approvalStatus === "APPROVED")) return;
        if (record.reviewArchivedAt && record.wordpressPageId) {
          await returnAronDraftToPreparation(record.id, record.wordpressPageId, ["Recovered approved draft for full preparation."]);
        }
        await enqueueWordPressUpload(record.id, connection.email, connection, "prepare");
        result.queued++;
      } catch (error) {
        result.errors.push(`${record.id}: ${error instanceof Error ? error.message : "Recovery failed."}`);
      }
    }));
  }
  return result;
}
