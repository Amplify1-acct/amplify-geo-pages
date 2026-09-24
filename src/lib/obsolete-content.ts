type ContentIdentity = {
  clientId?: unknown;
  clientName?: unknown;
  website?: unknown;
  pageUrl?: unknown;
  workflow?: unknown;
  createdAt?: unknown;
};

const DRAZEN_HOST = "myfloridainjurylaw.com";
const DRAZEN_OLD_PAGE_CUTOFF = Date.parse("2026-08-26T00:00:00.000Z");

function host(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    return new URL(value).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function normalized(value: unknown) {
  return typeof value === "string"
    ? value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
    : "";
}

export function isDrazenManciniContent(value: ContentIdentity) {
  return [host(value.website), host(value.pageUrl)].includes(DRAZEN_HOST)
    || [value.clientId, value.clientName]
      .map(normalized)
      .some((candidate) => candidate === "drazen mancini" || candidate === "drazen mancini p a");
}

export function isObsoleteDrazenPage(value: ContentIdentity) {
  if (!isDrazenManciniContent(value) || value.workflow === "blog") return false;
  const createdAt = typeof value.createdAt === "string" ? Date.parse(value.createdAt) : Number.NaN;
  return Number.isFinite(createdAt) && createdAt < DRAZEN_OLD_PAGE_CUTOFF;
}
