/** RDCY's default page template supplies the body H1 from the WordPress title. */
export function themeRendersPageTitle(siteUrl: string): boolean {
  return new URL(siteUrl).hostname.toLowerCase().replace(/^www\./, "") === "pbglaw.com";
}

export function preparePageTitle(content: string, escapedTitle: string, siteUrl: string): string {
  if (themeRendersPageTitle(siteUrl)) return content;
  return `<h1>${escapedTitle}</h1>\n${content}`;
}
