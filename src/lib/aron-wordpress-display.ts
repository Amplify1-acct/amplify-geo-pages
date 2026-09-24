import { contentWorkflow } from "./content-workflow";
import type { AronReviewItem } from "./aron-review-queue";

export function wordPressReviewDisplay(record: AronReviewItem) {
  const scheduled = record.wordpressStatus === "future";
  const draft = record.wordpressStatus === "draft";
  const labels: Record<string, string> = {
    publish: "Published on WordPress", future: "Scheduled on WordPress",
    private: "Private on WordPress", pending: "Pending WordPress review", trash: "In WordPress Trash",
  };
  let label = labels[record.wordpressStatus || ""] || "WordPress status needs verification";
  let note = "";
  if (draft) {
    label = record.wordpressIntakeOnly ? "Draft · preparation needed" : "Draft · final checks needed";
    note = record.wordpressIntakeOnly
      ? "WordPress contains the approval intake copy. Complete preparation in the content dashboard before requesting final publication approval."
      : "Writing approved. Verify preparation in the content dashboard before final publication approval. This status check does not certify images, CTAs, FAQs, SEO, or links.";
    if (!record.wordpressIntakeOnly && record.preparationRequired === false) {
      label = "Draft · ready for final approval";
      note = "Preparation verified. Final publication approval is required before publishing or scheduling.";
    }
    if (record.error) { label = "Draft · needs attention"; note = record.error; }
  }
  if (scheduled && record.wordpressScheduledAt && Number.isFinite(Date.parse(record.wordpressScheduledAt))) {
    note = "Scheduled for " + new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short",
    }).format(new Date(record.wordpressScheduledAt)) + " (America/New_York).";
  }
  const action = scheduled ? "Preview scheduled content" : record.wordpressStatus === "publish"
    ? "Open published content" : draft ? "Preview as published" : "Open WordPress";
  const flow = contentWorkflow(record);
  return { label: flow.label, note: scheduled && note ? note : flow.note, action, draft };
}
