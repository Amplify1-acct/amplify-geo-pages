/** Rebase only page identity URLs when a draft receives its public permalink. */
export function rebaseSchemaPermalink(schema: Record<string, unknown>, permalink: string) {
  const graph = Array.isArray(schema['@graph']) ? schema['@graph'] : [];
  const bases = new Set<string>();
  for (const node of graph) {
    if (node && typeof node === 'object' && node['@type'] === 'FAQPage') {
      for (const field of ['@id', 'url']) {
        const value = node[field];
        if (typeof value === 'string') bases.add(value.split('#')[0]);
      }
    }
  }
  bases.delete(permalink);
  function walk(value: unknown, field = ''): unknown {
    if (typeof value === 'string' && ['@id', 'url', 'mainEntityOfPage'].includes(field)) {
      for (const base of bases) if (base && (value === base || value.startsWith(base + '#'))) return permalink + value.slice(base.length);
    }
    if (Array.isArray(value)) return value.map(item => walk(item, field));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k,walk(v,k)]));
    return value;
  }
  const rebased = walk(schema) as Record<string, unknown>;
  // The visible AMPLIFY FAQ section uses #faq. Legacy schema may retain a
  // different fragment even after its page URL has been rebased.
  for (const node of Array.isArray(rebased['@graph']) ? rebased['@graph'] : []) {
    if (node && typeof node === 'object' && node['@type'] === 'FAQPage') {
      const section = new URL(permalink); section.hash = 'faq';
      node['@id'] = section.toString();
      node.url = section.toString();
    }
  }
  return rebased;
}

/** The installed Fulginiti renderer uses #faqpage for its FAQ entity. */
export function addFulginitiFaqAnchor(content: string, siteUrl: string) {
  let host: string;
  try { host = new URL(siteUrl).hostname.replace(/^www\./, ""); } catch { return content; }
  if (host !== "fulginiti-law.com") return content;
  return content.replace(/<h2\b[^>]*>[\s\S]*?<\/h2>/gi, heading => {
    if (!/\bid=["'](?:heading-)?faq["']/i.test(heading) || /\bid=["']faqpage["']/i.test(heading)) return heading;
    return heading.replace(/<\/h2>/i, '<span id="faqpage" data-amplify-faq-anchor="1"></span></h2>');
  });
}
