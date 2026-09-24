/** Called only after the owner's final approval and draft readiness checks. */
export function blogPublicationPlan(publishAt?: string, now = new Date()) {
  const assigned = publishAt?.trim();
  const date = assigned ? new Date(assigned) : null;
  if (date && !Number.isFinite(date.getTime())) {
    throw new Error("The selected publishing date is invalid.");
  }
  const scheduled = Boolean(date && date.getTime() > now.getTime());
  return {
    status: scheduled ? "future" as const : "publish" as const,
    overdue: Boolean(date && date.getTime() <= now.getTime()),
    // An overdue draft must get today's publication date, not its old draft date.
    dateGmt: (scheduled ? date! : now).toISOString(),
  };
}
