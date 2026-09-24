type PreviewRecord = {
  wordpressPageId?: number;
  wordpressPreviewUrl?: string;
  wordpressUrl?: string;
  website?: string;
  wordpressStatus?: string;
  workflow?: string;
};

/** Open the saved theme-rendered draft, never the editor or the original live enhancement. */
export function wordPressPreviewUrl(record: PreviewRecord): string | undefined {
  if (!record.wordpressPageId) return undefined;
  if (record.wordpressStatus === "publish") return record.wordpressUrl;
  if (record.wordpressPreviewUrl) {
    try {
      const preview = new URL(record.wordpressPreviewUrl);
      const saved = new URL(record.wordpressUrl || record.website || "");
      if (preview.hostname.replace(/^www\./, "") === saved.hostname.replace(/^www\./, "")) {
        preview.host = saved.host;
        preview.protocol = saved.protocol;
      }
      return preview.toString();
    } catch { return record.wordpressPreviewUrl; }
  }
  try {
    const url = new URL(record.wordpressUrl || record.website || "");
    url.search = "";
    url.hash = "";
    url.searchParams.set(record.workflow === "blog" ? "p" : "page_id", String(record.wordpressPageId));
    url.searchParams.set("preview", "true");
    return url.toString();
  } catch { return undefined; }
}

/** WordPress browser sessions are separate from REST Application Passwords. */
export function wordPressPreviewLoginUrl(record: PreviewRecord): string | undefined {
  const preview = wordPressPreviewUrl(record);
  if (!preview || record.wordpressStatus === "publish") return undefined;
  try {
    const target = new URL(preview);
    const login = new URL("wp-login.php", target.origin + "/");
    login.searchParams.set("redirect_to", target.toString());
    return login.toString();
  } catch { return undefined; }
}
