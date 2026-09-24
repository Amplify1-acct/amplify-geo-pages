export type PublicationClient = { id: string; name: string; website: string };
type RecordClient = { clientId?: string; clientName?: string; website?: string; wordpressUrl?: string; pageUrl?: string };

function host(value?: string): string | undefined {
  if (!value?.trim()) return undefined;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    return hostname.includes(".") && !/\s/.test(hostname) ? hostname : undefined;
  } catch { return undefined; }
}

export function publicationClient(record: RecordClient, clients: PublicationClient[]) {
  const hosts = [record.wordpressUrl, record.pageUrl, record.website, record.clientName].map(host).filter(Boolean);
  const match = clients.find(c => c.id === record.clientId)
    || clients.find(c => hosts.includes(host(c.website)))
    || clients.find(c => c.name.trim().toLowerCase() === record.clientName?.trim().toLowerCase());
  if (match) return { key: `client:${match.id}`, name: match.name };
  const domain = hosts[0] || host(record.clientName);
  if (domain) return { key: `host:${domain}`, name: domain };
  const name = record.clientName?.trim() || "Unknown client";
  return { key: `name:${name.toLowerCase()}`, name };
}
