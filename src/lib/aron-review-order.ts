import type { AronReviewItem } from "./aron-review-queue";

// Priority only affects waiting items. Approval history keeps its existing order.
export function waitingReviewPriority(record: AronReviewItem) {
  if (record.status !== "review" || record.aronDone || record.approvalStatus === "APPROVED") return 0;
  const priority = record.reviewPriority;
  return typeof priority === "number" && Number.isFinite(priority) && priority > 0 ? priority : 0;
}
