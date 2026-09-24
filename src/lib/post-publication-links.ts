// Pure planner. Only explicit community rosters, WordPress parent relationships
// and the client's configured practice hubs establish relationships.
export type LinkPage = { id: number; status?: string; parent?: number; link?: string; slug?: string; title?: { raw?: string; rendered?: string }; content?: { raw?: string; rendered?: string } };
export type LinkContext = { siteUrl: string; practiceAreaUrls: Record<string, string>; workflow?: string };
export const text = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#0*39;|&apos;/g, "'").replace(/&#8217;|’/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const key = (s: string) => text(s).toLowerCase().replace(/[^a-z0-9À-ÿ]+/g, " ").trim();
const esc = (s: string) => s.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const raw = (p: LinkPage) => p.content?.raw || p.content?.rendered || "";
const title = (p: LinkPage) => text(p.title?.raw || p.title?.rendered || "");
const language = (p: LinkPage) => /\/es\/|abogad|en español/i.test((p.link || "") + " " + title(p)) ? "es" : "en";
export function publicLink(value: string, siteUrl: string) {
  const url = new URL(value, siteUrl), site = new URL(siteUrl);
  if (url.protocol !== "https:" || url.hostname.replace(/^www\./, "") !== site.hostname.replace(/^www\./, "") || url.search || /amplify-draft/i.test(url.pathname)) throw new Error("Only canonical public URLs on this client's website can be linked.");
  return url.href;
}
const urlKey = (s: string) => new URL(s).pathname.replace(/\/$/, "");
function identity(p: LinkPage) {
  const t = title(p).replace(/\s*[|—]\s*.+$/, "");
  const normal = t.match(/^(.+?),?\s+(NY|NJ|PA|FL|CT|CA|TX|GA|NC|SC|OH|IL|MA|MD|VA|TN|CO|AZ|NV|WA|OR|MI|MN|MO|WI|AL|LA|KY|OK|AR|UT|IA|KS|NE|NM|ID|NH|ME|RI|DE|VT|WV|MS|MT|ND|SD|WY|AK|HI)\s+(.+?)(?:\s+(?:Lawyers?|Attorneys?))?$/i);
  const reverse = t.match(/^(.+?)\s+(?:Lawyers?|Attorneys?)\s+in\s+(.+?)\s+(NY|NJ|PA|FL|CT|CA|TX|GA|NC|SC|OH|IL|MA|MD|VA)$/i);
  if (normal) return { location: normal[1].replace(/,$/, ""), state: normal[2].toUpperCase(), topic: normal[3].replace(/\s+(?:Lawyers?|Attorneys?)$/i, "") };
  if (reverse) return { location: reverse[2], state: reverse[3].toUpperCase(), topic: reverse[1] };
  return null;
}
function directories(html: string) {
  return [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2\b|$)/gi)].flatMap(section => {
    if (!/(?:cities|towns|communities|areas|neighborhoods).*(?:serve|cover)|(?:lawyers?|attorneys?) serving/i.test(text(section[1]))) return [];
    const list = section[2].match(/<ul\b[^>]*>[\s\S]*?<\/ul>/i);
    if (!list || /<ul\b/gi.test(list[0].slice(4))) return [];
    const labels = [...list[0].matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map(m => identity({id:0,title:{raw:text(m[1])}})?.location || text(m[1]));
    if (!labels.length || labels.some(l => !l || l.length > 100)) return [];
    return [{ html: list[0], labels, heading: text(section[1]) }];
  });
}
function topicLabel(label: string, heading: string, context?: { topic?: string; location?: string }) {
  // These approved nursing-home resource labels apply only to navigation lists.
  if (/nursing home/i.test(heading)) {
    label = label.replace(/\s+(?:Lawyers?|Attorneys?)$/i, "");
    if (/^(?:Florida )?Nursing Home Abuse(?: Lawyer)?$/i.test(label)) return "Abuse Overview";
    if (/^(?:Florida )?Nursing Home Patient Rights$/i.test(label)) return "Patient Rights";
    if (/^(?:Damages in Florida Nursing Home Cases|(?:Florida )?Nursing Home (?:Abuse )?Damages)$/i.test(label)) return "Damages";
    if (/^(?:Florida )?Nursing Home Bedsores(?: Lawyer)?$/i.test(label)) return "Bedsores";
    if (/^(?:Florida )?Nursing Home Infections(?: and Sepsis)?$/i.test(label)) return "Infections and Sepsis";
    if (/^(?:Florida )?Nursing Home Wrongful Death(?: Lawyer)?$/i.test(label)) return "Wrongful Death";
    if (/^(?:Florida )?Assisted Living Abuse(?: Lawyer)?$/i.test(label)) return "Assisted Living Abuse";
    return label.replace(/^(?:Florida\s+)?Nursing Home\s+/i, "")
      .replace(/\s+in\s+(?:Florida\s+)?Nursing Homes?(?:\s+Cases)?$/i, "")
      .replace(/^Florida\s+(?=Assisted Living)/i, "");
  }
  let result = label;
  for (const shared of [context?.location, context?.topic].filter(Boolean) as string[]) {
    if (!key(heading).includes(key(shared))) continue;
    const escaped = shared.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(`^${escaped}\\s+|\\s+in\\s+${escaped}$`, "i"), "");
  }
  result = result.replace(/\s+(?:Lawyers?|Attorneys?)$/i, "");
  return result || label;
}
export function cleanResourceLabels(content: string, context?: { topic?: string; location?: string }) {
  return content.replace(/<h[2-6]\b[^>]*>([\s\S]*?)<\/h[2-6]>([\s\S]*?)(?=<h[2-6]\b|$)/gi, (section, headingHtml: string, body: string) => {
    const heading = text(headingHtml);
    if (!/related.*(?:resources|topics|practices)|types of accidents|practice areas/i.test(heading) || /\b(?:sources|references|fuentes)\b/i.test(heading)) return section;
    const updated = body.replace(/<ul\b[^>]*>[\s\S]*?<\/ul>/gi, list => {
      const labels = [...list.matchAll(/<a\b[^>]*>([^<]+)<\/a>/gi)].map(m => text(m[1]).split(/\s+/));
      const common = labels.length > 1 ? labels[0].filter((word,i) => labels.every(words => words[i]?.toLowerCase() === word.toLowerCase())) : [];
      // Only a contiguous shared prefix already supplied by this heading can
      // be shortened; distinct subject words and source titles are preserved.
      let prefixLength=0;
      while (labels.length > 1 && prefixLength < labels[0].length && labels.every(words => words[prefixLength]?.toLowerCase() === labels[0][prefixLength].toLowerCase())) prefixLength++;
      const prefix = prefixLength >= 2 && prefixLength < Math.min(...labels.map(words=>words.length)) ? common.slice(0,prefixLength).join(" ") : "";
      return list.replace(/(<a\b[^>]*>)([^<]+)(<\/a>)/gi, (_a, open, label, close) => {
        const cleaned = topicLabel(text(label), heading, context);
        const shortened = prefix && key(heading).includes(key(prefix)) && cleaned.toLowerCase().startsWith(prefix.toLowerCase()+" ") ? cleaned.slice(prefix.length).trim() : cleaned;
        return open + esc(shortened) + close;
      });
    });
    return section.slice(0, section.length - body.length) + updated;
  });
}
function appendDirectory(content: string, marker: string, heading: string, items: { label: string; url: string }[]) {
  const block = `<!-- ${marker}:start -->\n<!-- wp:heading -->\n<h2>${esc(heading)}</h2>\n<!-- /wp:heading -->\n<!-- wp:list -->\n<ul>${items.map(i => `<li><a href="${esc(i.url)}">${esc(i.label)}</a></li>`).join("\n")}</ul>\n<!-- /wp:list -->\n<!-- ${marker}:end -->`;
  const start = content.indexOf(`<!-- ${marker}:start -->`), endMarker = `<!-- ${marker}:end -->`, end = content.indexOf(endMarker);
  if (start >= 0 && end >= start) return content.slice(0, start) + block + content.slice(end + endMarker.length);
  return content.trimEnd() + "\n\n" + block;
}
export function planPublicationLinks(pages: LinkPage[], currentId: number, context: LinkContext) {
  const current = pages.find(p => p.id === currentId && p.status === "publish");
  if (!current?.link) throw new Error("Link reconciliation waits until the page is published.");
  publicLink(current.link, context.siteUrl);
  const live = pages.filter(p => p.status === "publish" && p.link && language(p) === language(current));
  const updates = new Map<number, string>();
  const pending: string[] = [];
  const originalIdentity = identity(current);
  const isBlog = context.workflow === "blog";
  const getContent = (p: LinkPage) => updates.get(p.id) ?? raw(p);
  const put = (p: LinkPage, content: string) => { updates.set(p.id, content); };
  const targets = new Set<number>([current.id]);
  if (originalIdentity && !isBlog) {
    const peers = live.filter(p => { const i = identity(p); return i && i.state === originalIdentity.state && key(i.topic) === key(originalIdentity.topic); });
    const currentLists = directories(raw(current));
    if (!currentLists.length) pending.push(`Page ${current.id}: no explicit community roster; confirm the canonical campaign.`);
    for (const directory of currentLists) {
      const cluster = peers.filter(p => directory.labels.some(l => key(l) === key(identity(p)!.location)));
      const namedCounty = directory.heading.match(/([A-Z][A-Za-z .'-]+ County)/)?.[1];
      const parent = peers.find(p => /County$/i.test(identity(p)!.location) && (p.id === current.parent || (namedCounty && key(namedCounty).endsWith(key(identity(p)!.location)))));
      const canonical = parent ? directories(raw(parent)).find(d => d.labels.some(l => key(l) === key(originalIdentity.location))) : undefined;
      const roster = canonical?.labels || directory.labels;
      const network = peers.filter(p => roster.some(l => key(l) === key(identity(p)!.location)) || p.id === parent?.id);
      const duplicates = roster.filter(l => network.filter(p => key(identity(p)!.location) === key(l)).length > 1);
      if (duplicates.length) { pending.push(`Ambiguous published destinations: ${duplicates.join(", ")}.`); continue; }
      for (const p of network.length ? network : cluster) {
        targets.add(p.id);
        const lists = directories(getContent(p));
        const matching = lists.find(d => d.labels.some(l => key(l) === key(originalIdentity.location)) && d.labels.some(l => roster.some(r => key(l) === key(r))));
        if (!matching) { pending.push(`Page ${p.id}: missing matching body community roster.`); continue; }
        const labels = [...roster];
        // A WordPress child omitted by the roster must be retained, not dropped.
        for (const child of peers.filter(c => parent && c.parent === parent.id)) {
          const label = identity(child)!.location;
          if (!labels.some(l => key(l) === key(label))) { labels.push(label); pending.push(`Page ${child.id}: appended missing child to the canonical roster; review its order.`); }
        }
        const opening = matching.html.match(/^<ul\b[^>]*>/i)![0];
        const items = labels.map(label => {
          const destination = peers.filter(candidate => key(identity(candidate)!.location) === key(label));
          if (destination.length > 1) throw new Error(`Ambiguous location: ${label}`);
          const linked = destination[0];
          return `<li>${linked && linked.id !== p.id ? `<a href="${esc(publicLink(linked.link!, context.siteUrl))}">${esc(label)}</a>` : esc(label)}</li>`;
        });
        put(p, getContent(p).replace(matching.html, `${opening}${items.join("\n")}</ul>`));
        if (parent && parent.id !== p.id) put(p, appendDirectory(getContent(p), "amplify-county-link", "County Resources", [{ label: identity(parent)!.location, url: publicLink(parent.link!, context.siteUrl) }]));
      }
    }
    const hubUrls = Object.entries(context.practiceAreaUrls).filter(([practice]) => key(practice) === key(originalIdentity.topic)).map(([,url]) => url);
    // Existing direct root-practice links are additional evidence when a client
    // profile has no mapping. Never construct a guessed destination slug.
    const hubs = live.filter(p => hubUrls.some(u => urlKey(u) === urlKey(p.link!)));
    if (hubs.length !== 1) pending.push(`Page ${current.id}: confirm the main AOP URL for ${originalIdentity.topic}.`);
    else {
      const hub = hubs[0]; targets.add(hub.id);
      for (const id of [...targets].filter(id => id !== hub.id)) {
        const p = live.find(p => p.id === id)!;
        const bodyLists = [...getContent(p).matchAll(/<ul\b[^>]*>[\s\S]*?<\/ul>/gi)].map(m=>m[0]).join("\n");
        if (!bodyLists.includes(hub.link!)) put(p, appendDirectory(getContent(p), "amplify-main-aop-link", "Related Resources", [{ label: originalIdentity.topic, url: publicLink(hub.link!, context.siteUrl) }]));
      }
      // The statewide hub links back to every verified live location for this
      // practice; individual city directories retain their county scope.
      put(hub, appendDirectory(getContent(hub), "amplify-live-geo-directory", `${originalIdentity.topic}: Locations We Serve`, peers.map(p => ({ label: identity(p)!.location, url: publicLink(p.link!, context.siteUrl) })).sort((a,b) => a.label.localeCompare(b.label))));
    }
  } else if (!isBlog && (context.workflow === "subaop" || context.workflow === "aop")) {
    const parent = context.workflow === "aop" ? current : live.find(p => p.id === current.parent);
    if (!parent) pending.push(`Page ${current.id}: confirm the main AOP relationship.`);
    else {
      const children = live.filter(p => p.parent === parent.id);
      for (const p of [parent, ...children]) {
        targets.add(p.id);
        const entries = [parent, ...children].filter(other => other.id !== p.id).map(other => ({ label: topicLabel(title(other), `Related ${title(parent)} Resources`, { topic: title(parent) }), url: publicLink(other.link!, context.siteUrl) }));
        put(p, appendDirectory(getContent(p), "amplify-practice-directory", `Related ${title(parent)} Resources`, entries));
      }
    }
  } else if (!isBlog) pending.push(`Page ${current.id}: location/practice identity needs explicit confirmation before cross-linking.`);
  for (const id of targets) { const p = live.find(p => p.id === id)!; put(p, cleanResourceLabels(getContent(p), originalIdentity || undefined)); }
  return { updates: [...updates].map(([id,content]) => ({ page: live.find(p => p.id === id)!, content })), checkedIds: [...targets], pending };
}
