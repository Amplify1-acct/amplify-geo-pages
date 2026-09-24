function removeOpenAiTracking(value: string) {
  try {
    const parsed = new URL(value);
    if (parsed.searchParams.get("utm_source")?.toLowerCase() === "openai") {
      parsed.searchParams.delete("utm_source");
      return parsed.toString();
    }
  } catch {
    // Preserve valid non-URL schemes such as mailto and tel unchanged.
  }
  return value;
}

export function directLink(href?: string) {
  if (!href) return href;
  try {
    const parsed = new URL(href.replace(/&amp;/gi, "&"));
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (hostname === "google.com" && parsed.pathname === "/url") {
      const target = parsed.searchParams.get("q") || parsed.searchParams.get("url");
      if (target && /^(https?:|mailto:|tel:)/i.test(target)) {
        return removeOpenAiTracking(target);
      }
    }
  } catch {
    // The HTML sanitizer handles relative or malformed values.
  }
  return removeOpenAiTracking(href);
}
