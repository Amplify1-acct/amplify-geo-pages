import { userActionRoute } from "../../../../lib/ai-control.mjs";
import { isStorageLimitError, STORAGE_LIMIT_MESSAGE } from "@/lib/storage-error";
import { after, NextRequest, NextResponse } from "next/server";
import { enqueueWordPressUpload, runWordPressUpload } from "@/lib/wordpress-upload-worker";
import { refreshAronWordPressStatuses } from "@/lib/aron-wordpress-status";
import { publicUploadJobs } from "@/lib/wordpress-upload-store";
import {
  approveAronReviewItem,
  deleteAronReviewItems,
  isAronReviewer,
  listAronReviewItems,
  getAronReviewItem,
  pruneObsoleteAronReviewItems,
  saveAronWordPressDraft,
  saveAronWordPressError,
  type AronReviewItem,
} from "@/lib/aron-review-queue";
import { getGoogleAccessToken, getGoogleEmail } from "@/lib/google";
import { waitingReviewPriority } from "@/lib/aron-review-order";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function authorizedAron() {
  const accessToken = await getGoogleAccessToken();
  const email = await getGoogleEmail(accessToken);
  if (!isAronReviewer(email)) {
    throw new Error("This review page is only available to an approved AMPLIFY Google account.");
  }
  return { accessToken, email: email! };
}

function errorResponse(error: unknown) {
  if (isStorageLimitError(error)) return NextResponse.json(
    { error: STORAGE_LIMIT_MESSAGE, code: "STORAGE_LIMIT" },
    { status: 503, headers: { "Retry-After": "300", "Cache-Control": "no-store" } },
  );
  const message = error instanceof Error ? error.message : "Aron’s review queue could not be loaded.";
  const status = /storage is not connected/i.test(message)
    ? 503
    : /not connected|not configured|expired|reconnect|authorized/i.test(message)
      ? 401
      : /only available/i.test(message)
        ? 403
        : /no longer|not currently/i.test(message)
          ? 409
          : 500;
  return NextResponse.json({ error: message }, { status });
}

function normalized(value?: string) {
  return (value || "")
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function contentTitle(record: AronReviewItem) {
  if (record.workflow === "enhance") {
    try {
      return decodeURIComponent(new URL(record.pageUrl || record.website).pathname)
        .split("/")
        .filter(Boolean)
        .at(-1)
        ?.replace(/[-_]+/g, " ")
        || record.docName
        || "existing page";
    } catch {
      return record.docName || "existing page";
    }
  }
  if (["blog", "aop", "subaop"].includes(record.workflow || "")) {
    return record.practiceArea || record.docName || "content draft";
  }
  return `${record.city} ${record.state} ${record.practiceArea}`;
}

function contentOwner(record: AronReviewItem) {
  if (record.clientId) return normalized(record.clientId);
  try {
    return new URL(record.website).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return normalized(record.clientName || record.website);
  }
}

function exactContentKey(record: AronReviewItem) {
  return [contentOwner(record), record.workflow || "create", normalized(contentTitle(record))].join("|");
}

function geoContentKey(record: AronReviewItem) {
  const practiceArea = normalized(record.practiceArea).replace(/\blawyer$/, "").trim();
  return [contentOwner(record), "create", normalized(record.city), normalized(record.state), practiceArea].join("|");
}

function withoutApprovalOverlaps(records: AronReviewItem[]) {
  const approved = records.filter((record) => record.aronDone || record.approvalStatus === "APPROVED");
  const approvedExactKeys = new Set(approved.map(exactContentKey));
  const approvedGeoKeys = new Set(
    approved.filter((record) => !record.workflow || record.workflow === "create").map(geoContentKey),
  );
  const seenWaiting = new Set<string>();

  return records.filter((record) => {
    if (record.aronDone || record.approvalStatus === "APPROVED") return true;
    const exactKey = exactContentKey(record);
    const overlapsApproved = approvedExactKeys.has(exactKey)
      || ((!record.workflow || record.workflow === "create") && approvedGeoKeys.has(geoContentKey(record)));
    if (overlapsApproved || seenWaiting.has(exactKey)) return false;
    seenWaiting.add(exactKey);
    return true;
  });
}

function stableQueueOrder(left: AronReviewItem, right: AronReviewItem) {
  return waitingReviewPriority(right) - waitingReviewPriority(left)
    || left.createdAt.localeCompare(right.createdAt)
    || contentOwner(left).localeCompare(contentOwner(right))
    || contentTitle(left).localeCompare(contentTitle(right))
    || left.id.localeCompare(right.id);
}

export async function GET(request: NextRequest) {
  try {
    const { email, accessToken } = await authorizedAron();
    const recordId = request.nextUrl.searchParams.get("id");
    if (recordId) {
      const item = await getAronReviewItem(recordId);
      if (!item || item.reviewDeletedAt) return NextResponse.json({error:"Review item not found."},{status:404});
      const errors = await refreshAronWordPressStatuses([item], accessToken, true);
      const fresh = await getAronReviewItem(recordId);
      const jobs = await publicUploadJobs([recordId]);
      return NextResponse.json({records:[{...fresh,upload:jobs.get(recordId),wordpressStatusError:errors.get(recordId)}],archivedRecords:[]}, {headers:{"Cache-Control":"private, no-store, max-age=0"}});
    }
    await pruneObsoleteAronReviewItems();
    const statusErrors = await refreshAronWordPressStatuses(await listAronReviewItems(true), accessToken);
    const records = await listAronReviewItems(true);
    const eligibleRecords = records.filter(
      (record) => record.docUrl && (
        (record.status === "review" && !record.aronDone && record.approvalStatus !== "APPROVED")
        || record.aronDone
        || record.approvalStatus === "APPROVED"
      ),
    );
    const reviewRecords = withoutApprovalOverlaps(eligibleRecords).filter(record => !record.reviewArchivedAt && !record.reviewDeletedAt).sort(stableQueueOrder);
    const uploads=await publicUploadJobs(reviewRecords.map(record=>record.id));
    return NextResponse.json({
      records: reviewRecords.map(record=>({...record,upload:uploads.get(record.id),wordpressStatusError:statusErrors.get(record.id)})),
      archivedRecords: records.filter(record => record.reviewArchivedAt && !record.reviewDeletedAt && record.docUrl),
      reviewerEmail: email,
      updatedAt: records[0]?.updatedAt || records[0]?.createdAt || null,
    }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    return errorResponse(error);
  }
}

async function handlePATCH(request: NextRequest) {
  try {
    const {email}=await authorizedAron();
    const input = await request.json() as {
      id?: unknown;
      action?: unknown;
      result?: {
        pageId?: unknown;
        pageUrl?: unknown;
        editUrl?: unknown;
        previewUrl?: unknown;
        featuredMediaId?: unknown;
        featuredImageUrl?: unknown;
        imageReviewRequired?: unknown;
        status?: unknown;
        preparationRequired?: unknown;
        warnings?: unknown;
      };
      error?: unknown;
    };
    const id = typeof input.id === "string" ? input.id.trim() : "";
    if (!id || id.length > 200 || !["approve", "retry-upload", "prepare", "wordpress-draft", "wordpress-error"].includes(String(input.action))) {
      return NextResponse.json({ error: "Choose a valid content item to approve." }, { status: 400 });
    }
    if(input.action === "prepare") {
      await enqueueWordPressUpload(id,email,undefined,"prepare");
      after(()=>runWordPressUpload(id).then(()=>undefined));
      return NextResponse.json({ok:true,queued:true});
    }
    if(input.action === "retry-upload") {
      await enqueueWordPressUpload(id,email);
      after(()=>runWordPressUpload(id).then(()=>undefined));
      return NextResponse.json({ok:true,queued:true});
    }
    const record = input.action === "approve"
      ? await approveAronReviewItem(id)
      : input.action === "wordpress-draft"
        ? await saveAronWordPressDraft(id, {
            pageId: Number(input.result?.pageId),
            pageUrl: typeof input.result?.pageUrl === "string" ? input.result.pageUrl : undefined,
            editUrl: typeof input.result?.editUrl === "string" ? input.result.editUrl : undefined,
            previewUrl: typeof input.result?.previewUrl === "string" ? input.result.previewUrl : undefined,
            featuredMediaId: Number(input.result?.featuredMediaId) || undefined,
            featuredImageUrl: typeof input.result?.featuredImageUrl === "string" ? input.result.featuredImageUrl : undefined,
            imageReviewRequired: input.result?.imageReviewRequired === true,
            status: input.result?.status === "publish" ? "publish" : "draft",
            preparationRequired: typeof input.result?.preparationRequired === "boolean" ? input.result.preparationRequired : undefined,
            warnings: Array.isArray(input.result?.warnings) ? input.result.warnings.filter((value): value is string => typeof value === "string") : undefined,
          })
        : await saveAronWordPressError(
            id,
            typeof input.error === "string" ? input.error : "The WordPress draft could not be created.",
          );
    // Writing approval records the decision; preparation has its own explicit action.
    return NextResponse.json({ ok: true, record, queued:false });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await authorizedAron();
    const input = await request.json().catch(() => null);
    if (!Array.isArray(input?.ids) || !input.ids.length || input.ids.length > 1000
      || input.ids.some((id: unknown) => typeof id !== "string" || !id.trim() || id.length > 200)) {
      return NextResponse.json({ error: "Select between 1 and 1,000 valid entries to delete." }, { status: 400 });
    }
    const ids = [...new Set<string>(input.ids.map((id: string) => id.trim()))];
    const deletedIds = await deleteAronReviewItems(ids);
    return NextResponse.json({ ok: true, deletedIds });
  } catch (error) {
    return errorResponse(error);
  }
}

export const PATCH = userActionRoute("Prepare approved content", handlePATCH);
