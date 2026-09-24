/** Join contiguous Google Docs link runs split by inline text formatting.
 * Only identical anchor attributes and whitespace-only gaps qualify; real
 * duplicate citations separated by punctuation or blocks remain validation errors.
 */
export function mergeGoogleDocLinkRuns(html: string): string {
  const anchor = /<a\b([^>]*)>((?:(?!<\/?a\b)[\s\S])*?)<\/a>/gi;
  let result = "";
  let cursor = 0;
  let previousAttributes: string | undefined;
  for (const match of html.matchAll(anchor)) {
    const gap = html.slice(cursor, match.index);
    if (previousAttributes === match[1] && /^\s*$/.test(gap) && result.endsWith("</a>")) {
      result = result.slice(0, -4) + gap + match[2] + "</a>";
    } else {
      result += gap + match[0];
    }
    previousAttributes = match[1];
    cursor = match.index! + match[0].length;
  }
  return result + html.slice(cursor);
}
