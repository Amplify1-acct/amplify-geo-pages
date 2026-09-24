export const STORAGE_LIMIT_MESSAGE = "AMPLIFY’s database has reached its monthly usage allowance. Reviews and approvals are temporarily unavailable until database capacity is restored. Please try again later.";

export function isStorageLimitError(error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return /max requests limit exceeded|monthly usage allowance/i.test(message);
}

export function reviewErrorMessage(error: unknown, fallback = "The review could not be loaded.") {
  if (isStorageLimitError(error)) return STORAGE_LIMIT_MESSAGE;
  return error instanceof Error ? error.message : fallback;
}
