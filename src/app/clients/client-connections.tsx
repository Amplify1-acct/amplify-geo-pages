"use client";

import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Download,
  ExternalLink,
  Globe2,
  LoaderCircle,
  Plus,
  RefreshCw,
  Save,
  ServerCog,
  ShieldCheck,
  UserRound,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type ClientForm = {
  id: string;
  name: string;
  website: string;
  reviewerEmail: string;
  phoneDisplay: string;
  phoneHref: string;
  locale: "en" | "es";
  jurisdictions: string[];
  contactUrl?: string;
  practiceAreas: string[];
  practiceAreaUrls: Record<string, string>;
  lawyers: Array<{ name: string; imageUrl: string }>;
  brand: { primary: string; secondary: string; accent: string; surface: string; logoUrl?: string };
  blogDefaults: { authorId?: number; categoryId?: number; defaultJurisdiction?: string };
  cta: { consultationText?: string; linkLabel?: string };
  wordpress?: {
    siteUrl: string;
    username: string;
    pageTemplate?: string;
    passwordConfigured?: boolean;
    applicationPassword?: string;
  };
  wordpressReady?: boolean;
  assetsReady?: boolean;
};

type Health = {
  configured?: boolean;
  connected?: boolean;
  pagesConnected?: boolean;
  postsConnected?: boolean;
  mediaConnected?: boolean;
  bridgeConnected?: boolean;
  bridgeVersion?: string | null;
  yoastActive?: boolean;
  currentUser?: { id?: number; name?: string } | null;
  blogAuthorConfigured?: boolean;
  blogAuthorValid?: boolean;
  blogCategoryConfigured?: boolean;
  blogCategoryValid?: boolean;
  message?: string;
};

type WordPressOptions = {
  users: Array<{ id: number; name: string }>;
  categories: Array<{ id: number; name: string; count?: number }>;
};

const LATEST_BRIDGE_VERSION = "1.9.6";

function bridgeHealth(health: Health) {
  if (!health.bridgeConnected) {
    return { current: false, detail: `Install v${LATEST_BRIDGE_VERSION}` };
  }
  if (health.bridgeVersion !== LATEST_BRIDGE_VERSION) {
    return {
      current: false,
      detail: health.bridgeVersion
        ? `Installed v${health.bridgeVersion} · update to v${LATEST_BRIDGE_VERSION}`
        : `Update to v${LATEST_BRIDGE_VERSION}`,
    };
  }
  return { current: true, detail: `v${LATEST_BRIDGE_VERSION} current` };
}

const emptyClient: ClientForm = {
  id: "",
  name: "",
  website: "",
  reviewerEmail: "aron@amplifylaw.ai",
  phoneDisplay: "",
  phoneHref: "",
  locale: "en",
  jurisdictions: [],
  contactUrl: "",
  practiceAreas: [],
  practiceAreaUrls: {},
  lawyers: [],
  brand: { primary: "#151515", secondary: "#353535", accent: "#d2b052", surface: "#f7f7f7", logoUrl: "" },
  blogDefaults: {},
  cta: {},
  wordpress: { siteUrl: "", username: "", pageTemplate: "", applicationPassword: "" },
};

function lines(values: string[]) {
  return values.join("\n");
}

function stringList(value: string) {
  return value.split(/\r?\n|,/).map((item) => item.replace(/\s+/g, " ").trim()).filter(Boolean);
}

function pairs(value: string) {
  return Object.fromEntries(value.split(/\r?\n/).map((row) => {
    const [label, ...url] = row.split("|");
    return [label?.trim(), url.join("|").trim()];
  }).filter(([label, url]) => label && url));
}

function pairLines(value: Record<string, string>) {
  return Object.entries(value).map(([label, url]) => `${label} | ${url}`).join("\n");
}

function lawyerLines(value: Array<{ name: string; imageUrl: string }>) {
  return value.map((lawyer) => `${lawyer.name} | ${lawyer.imageUrl}`).join("\n");
}

function lawyers(value: string) {
  return value.split(/\r?\n/).map((row) => {
    const [name, ...url] = row.split("|");
    return { name: name?.trim(), imageUrl: url.join("|").trim() };
  }).filter((lawyer) => lawyer.name && lawyer.imageUrl);
}

type StructuredTextDrafts = {
  practiceAreas: string;
  jurisdictions: string;
  practiceAreaUrls: string;
  lawyers: string;
};

function structuredTextDrafts(client: ClientForm): StructuredTextDrafts {
  return {
    practiceAreas: lines(client.practiceAreas),
    jurisdictions: lines(client.jurisdictions),
    practiceAreaUrls: pairLines(client.practiceAreaUrls),
    lawyers: lawyerLines(client.lawyers),
  };
}

function idFromName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

function HealthItem({ label, ok, detail }: { label: string; ok?: boolean; detail?: string }) {
  return (
    <div className={`health-item ${ok ? "is-ok" : ""}`}>
      {ok ? <CheckCircle2 size={17} /> : <XCircle size={17} />}
      <span><strong>{label}</strong>{detail && <small>{detail}</small>}</span>
    </div>
  );
}

export default function ClientConnections() {
  const [clients, setClients] = useState<ClientForm[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState<ClientForm>(emptyClient);
  const [textDrafts, setTextDrafts] = useState<StructuredTextDrafts>(() => structuredTextDrafts(emptyClient));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshingSite, setRefreshingSite] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [needsGoogle, setNeedsGoogle] = useState(false);
  const [health, setHealth] = useState<Health | null>(null);
  const [wpOptions, setWpOptions] = useState<WordPressOptions>({ users: [], categories: [] });

  const loadClients = useCallback(async (selectId?: string) => {
    setLoading(true);
    setError("");
    const response = await fetch("/api/client-connections", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) {
      setNeedsGoogle(response.status === 401);
      setError(data.error || "Client connections could not be loaded.");
      setLoading(false);
      return;
    }
    const nextClients = data.clients as ClientForm[];
    setClients(nextClients);
    const nextId = selectId || selectedId || nextClients[0]?.id || "";
    const selected = nextClients.find((client) => client.id === nextId);
    setSelectedId(selected?.id || "");
    const nextForm = selected ? structuredClone(selected) : structuredClone(emptyClient);
    setForm(nextForm);
    setTextDrafts(structuredTextDrafts(nextForm));
    setNeedsGoogle(false);
    setLoading(false);
  }, [selectedId]);

  useEffect(() => { void loadClients(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = useMemo(() => clients.find((client) => client.id === selectedId), [clients, selectedId]);

  function chooseClient(id: string) {
    const client = clients.find((item) => item.id === id);
    if (!client) return;
    setSelectedId(id);
    const nextForm = structuredClone(client);
    setForm(nextForm);
    setTextDrafts(structuredTextDrafts(nextForm));
    setHealth(null);
    setWpOptions({ users: [], categories: [] });
    setError("");
    setNotice("");
  }

  function newClient() {
    setSelectedId("");
    const nextForm = structuredClone(emptyClient);
    setForm(nextForm);
    setTextDrafts(structuredTextDrafts(nextForm));
    setHealth(null);
    setWpOptions({ users: [], categories: [] });
    setError("");
    setNotice("");
  }

  function field<K extends keyof ClientForm>(key: K, value: ClientForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save(refreshWebsiteIdentity = false) {
    if (refreshWebsiteIdentity) setRefreshingSite(true);
    else setSaving(true);
    setError("");
    setNotice("");
    const payload = {
      ...form,
      practiceAreas: stringList(textDrafts.practiceAreas),
      jurisdictions: stringList(textDrafts.jurisdictions),
      practiceAreaUrls: pairs(textDrafts.practiceAreaUrls),
      lawyers: lawyers(textDrafts.lawyers),
      refreshWebsiteIdentity,
      id: form.id || idFromName(form.name),
      wordpress: form.wordpress?.siteUrl || form.wordpress?.username || form.wordpress?.applicationPassword
        ? form.wordpress
        : undefined,
    };
    const response = await fetch("/api/client-connections", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "The client could not be saved.");
      setSaving(false);
      setRefreshingSite(false);
      return;
    }
    setNotice(data.websiteIdentityImported
      ? `${data.client.name} is saved. AMPLIFY imported ${data.practiceAreaCount} practice areas and ${data.practiceAreaUrlCount} verified links, along with its public phone, logo, and brand treatment.`
      : `${data.client.name} is saved in the encrypted client store.`);
    await loadClients(data.client.id);
    setSaving(false);
    setRefreshingSite(false);
  }

  async function testConnection() {
    const id = form.id || selectedId;
    if (!id) return;
    setTesting(true);
    setError("");
    setHealth(null);
    const response = await fetch(`/api/wordpress/status?clientId=${encodeURIComponent(id)}&full=1`, { cache: "no-store" });
    const data = await response.json() as Health;
    setHealth(data);
    if (!data.connected) setError(data.message || "WordPress could not be reached.");
    if (data.connected) {
      const optionsResponse = await fetch(`/api/wordpress/options?clientId=${encodeURIComponent(id)}`, { cache: "no-store" });
      const options = await optionsResponse.json();
      if (optionsResponse.ok) setWpOptions({ users: options.users || [], categories: options.categories || [] });
    }
    setTesting(false);
  }

  if (loading) {
    return <main className="connections-loading"><LoaderCircle className="spin" /><strong>Loading client connections…</strong></main>;
  }

  if (needsGoogle) {
    return (
      <main className="connections-gate">
        <span className="brand-mark">A</span>
        <h1>Connect Google to manage clients</h1>
        <p>The encrypted client store lives in AMPLIFY’s private Google Drive app data.</p>
        <a className="primary-button" href="/api/google/connect">Connect Google</a>
        <a className="text-button" href="/"><ArrowLeft size={15} /> Back to content</a>
      </main>
    );
  }

  return (
    <main className="connections-shell">
      <header className="connections-topbar">
        <a className="brand" href="/"><span className="brand-mark">A</span><span className="brand-word">AMPLIFY</span><span className="brand-product">Client Connections</span></a>
        <div className="connections-actions">
          <a className="secondary-button compact" href={`/amplify-geo-bridge.zip?v=${LATEST_BRIDGE_VERSION}`} download><Download size={14} /> Content Bridge {LATEST_BRIDGE_VERSION}</a>
          <a className="secondary-button compact" href="/"><ArrowLeft size={14} /> Content workflow</a>
        </div>
      </header>

      <div className="connections-layout">
        <aside className="client-list-panel">
          <div className="client-list-heading"><div><small>AMPLIFY CLIENTS</small><strong>{clients.length} connected profiles</strong></div><button className="icon-button" onClick={newClient} title="Add client"><Plus size={18} /></button></div>
          <div className="client-list">
            {clients.map((client) => (
              <button key={client.id} className={selectedId === client.id ? "active" : ""} onClick={() => chooseClient(client.id)}>
                <span className="client-avatar">{client.name.slice(0, 1).toUpperCase()}</span>
                <span><strong>{client.name}</strong><small>{new URL(client.website).hostname.replace(/^www\./, "")}</small></span>
                {client.wordpressReady && <Check size={14} />}
              </button>
            ))}
          </div>
          <button className="add-client-button" onClick={newClient}><Plus size={16} /> Add AMPLIFY client</button>
          <div className="encrypted-note"><ShieldCheck size={17} /><span><strong>Encrypted at rest</strong><small>WordPress passwords never reach the browser after saving.</small></span></div>
        </aside>

        <section className="connection-editor">
          <div className="connection-editor-heading">
            <div><p className="eyebrow"><ServerCog size={14} /> {selected ? "Client profile" : "New connection"}</p><h1>{selected ? selected.name : "Connect a client"}</h1><p>One profile controls GEO pages, blogs, CTAs, images, approvals, and WordPress defaults.</p></div>
            <button className="primary-button" onClick={() => void save(false)} disabled={saving || refreshingSite}>{saving ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />}{saving ? "Saving…" : "Save client"}</button>
          </div>
          {error && <div className="connection-message error"><XCircle size={17} /><span>{error}</span></div>}
          {notice && <div className="connection-message success"><CheckCircle2 size={17} /><span>{notice}</span></div>}

          <div className="settings-section">
            <div className="settings-title"><span>01</span><div><h2>Firm identity</h2><p>Verified public information used in every workflow.</p></div></div>
            <div className="settings-grid">
              <label className="field"><span>Firm name</span><input value={form.name} onChange={(e) => { field("name", e.target.value); if (!selectedId) field("id", idFromName(e.target.value)); }} /></label>
              <label className="field"><span>Client ID</span><input value={form.id} onChange={(e) => field("id", idFromName(e.target.value))} placeholder="firm-name" /></label>
              <label className="field"><span>Official website</span><input type="url" value={form.website} onChange={(e) => field("website", e.target.value)} placeholder="https://lawfirm.com" /></label>
              <label className="field"><span>Reviewer email</span><input type="email" value={form.reviewerEmail} onChange={(e) => field("reviewerEmail", e.target.value)} /></label>
              <label className="field"><span>Main phone</span><input value={form.phoneDisplay} onChange={(e) => field("phoneDisplay", e.target.value)} placeholder="(555) 555-5555" /></label>
              <label className="field"><span>Telephone link</span><input value={form.phoneHref} onChange={(e) => field("phoneHref", e.target.value)} placeholder="+15555555555" /></label>
              <label className="field"><span>Contact page</span><input type="url" value={form.contactUrl || ""} onChange={(e) => field("contactUrl", e.target.value)} placeholder="https://lawfirm.com/contact/" /></label>
              <label className="field"><span>Content language</span><select value={form.locale} onChange={(e) => field("locale", e.target.value as "en" | "es")}><option value="en">English</option><option value="es">Spanish</option></select></label>
              <label className="field field-full"><span>Practice areas <em>one per line</em></span><textarea rows={5} value={textDrafts.practiceAreas} onChange={(e) => setTextDrafts((current) => ({ ...current, practiceAreas: e.target.value }))} /></label>
              <div className="field field-full"><button className="secondary-button" type="button" onClick={() => void save(true)} disabled={saving || refreshingSite || !form.website}>{refreshingSite ? <LoaderCircle className="spin" size={16} /> : <Globe2 size={16} />}{refreshingSite ? "Refreshing website…" : "Refresh practice areas from website"}</button><small className="field-hint">Merges verified practice-area names and links from the firm’s public site without deleting manual entries.</small></div>
              <label className="field field-full"><span>Jurisdictions and service areas <em>one per line</em></span><textarea rows={4} value={textDrafts.jurisdictions} onChange={(e) => setTextDrafts((current) => ({ ...current, jurisdictions: e.target.value }))} /></label>
              <label className="field field-full"><span>Practice-area URLs <em>Practice Area | https://…</em></span><textarea rows={4} value={textDrafts.practiceAreaUrls} onChange={(e) => setTextDrafts((current) => ({ ...current, practiceAreaUrls: e.target.value }))} /></label>
            </div>
          </div>

          <div className="settings-section">
            <div className="settings-title"><span>02</span><div><h2>Brand and CTA</h2><p>Assets and approved contact language used in branded CTAs.</p></div></div>
            <div className="settings-grid">
              {(["primary", "secondary", "accent", "surface"] as const).map((color) => <label className="field color-field" key={color}><span>{color[0].toUpperCase() + color.slice(1)} color</span><div><input type="color" value={form.brand[color]} onChange={(e) => field("brand", { ...form.brand, [color]: e.target.value })} /><input value={form.brand[color]} onChange={(e) => field("brand", { ...form.brand, [color]: e.target.value })} /></div></label>)}
              <label className="field field-full"><span>Logo URL</span><input type="url" value={form.brand.logoUrl || ""} onChange={(e) => field("brand", { ...form.brand, logoUrl: e.target.value })} /></label>
              <label className="field field-full"><span>Lawyer images <em>Name | https://image-url</em></span><textarea rows={3} value={textDrafts.lawyers} onChange={(e) => setTextDrafts((current) => ({ ...current, lawyers: e.target.value }))} /></label>
              <label className="field field-full"><span>Approved consultation message</span><textarea rows={3} value={form.cta.consultationText || ""} onChange={(e) => field("cta", { ...form.cta, consultationText: e.target.value })} /></label>
              <label className="field field-full"><span>CTA secondary-link label</span><input value={form.cta.linkLabel || ""} onChange={(e) => field("cta", { ...form.cta, linkLabel: e.target.value })} placeholder="Learn about personal injury cases" /></label>
            </div>
          </div>

          <div className="settings-section">
            <div className="settings-title"><span>03</span><div><h2>WordPress connection</h2><p>Use a dedicated AMPLIFY user and Application Password.</p></div></div>
            <div className="settings-grid">
              <label className="field"><span>WordPress site URL</span><input type="url" value={form.wordpress?.siteUrl || ""} onChange={(e) => field("wordpress", { ...(form.wordpress || { username: "" }), siteUrl: e.target.value })} placeholder="https://lawfirm.com" /></label>
              <label className="field"><span>WordPress username</span><input value={form.wordpress?.username || ""} onChange={(e) => field("wordpress", { ...(form.wordpress || { siteUrl: "" }), username: e.target.value })} /></label>
              <label className="field"><span>Application Password</span><input type="password" autoComplete="new-password" value={form.wordpress?.applicationPassword || ""} onChange={(e) => field("wordpress", { ...(form.wordpress || { siteUrl: "", username: "" }), applicationPassword: e.target.value })} placeholder={form.wordpress?.passwordConfigured ? "Saved — enter only to replace" : "xxxx xxxx xxxx xxxx"} /></label>
              <label className="field"><span>Page template <em>optional</em></span><input value={form.wordpress?.pageTemplate || ""} onChange={(e) => field("wordpress", { ...(form.wordpress || { siteUrl: "", username: "" }), pageTemplate: e.target.value })} /></label>
            </div>
            <div className="wordpress-toolbar"><button className="secondary-button" onClick={testConnection} disabled={testing || !form.id}>{testing ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />} Test WordPress</button><a className="text-button" href={`/amplify-geo-bridge.zip?v=${LATEST_BRIDGE_VERSION}`} download><Download size={15} /> Download bridge v{LATEST_BRIDGE_VERSION}</a>{form.wordpress?.siteUrl && <a className="text-button" href={`${form.wordpress.siteUrl.replace(/\/$/, "")}/wp-admin/profile.php`} target="_blank" rel="noreferrer">Create Application Password <ExternalLink size={14} /></a>}</div>
            {health && (() => { const bridge = bridgeHealth(health); return <div className="health-grid"><HealthItem label="WordPress pages" ok={health.pagesConnected} /><HealthItem label="Blog posts" ok={health.postsConnected} /><HealthItem label="Media uploads" ok={health.mediaConnected} /><HealthItem label="Content Bridge" ok={bridge.current} detail={bridge.detail} /><HealthItem label="Yoast SEO" ok={health.yoastActive} /><HealthItem label="Publishing user" ok={Boolean(health.currentUser)} detail={health.currentUser?.name} /><HealthItem label="Default blog author" ok={health.blogAuthorValid} detail={health.blogAuthorConfigured ? "Verified in WordPress" : "Choose below"} /><HealthItem label="Default blog category" ok={health.blogCategoryValid} detail={health.blogCategoryConfigured ? "Verified in WordPress" : "Choose below"} /></div>; })()}
          </div>

          <div className="settings-section">
            <div className="settings-title"><span>04</span><div><h2>Blog publishing defaults</h2><p>Prevents posts from using Uncategorized or the wrong author.</p></div></div>
            <div className="settings-grid">
              <label className="field"><span>Default jurisdiction</span><input list="client-jurisdictions" value={form.blogDefaults.defaultJurisdiction || ""} onChange={(e) => field("blogDefaults", { ...form.blogDefaults, defaultJurisdiction: e.target.value })} /></label>
              <label className="field"><span>Default author</span><select value={form.blogDefaults.authorId || ""} onChange={(e) => field("blogDefaults", { ...form.blogDefaults, authorId: Number(e.target.value) || undefined })}><option value="">Choose after testing WordPress</option>{wpOptions.users.map((user) => <option key={user.id} value={user.id}>{user.name} · ID {user.id}</option>)}</select></label>
              <label className="field"><span>Default blog category</span><select value={form.blogDefaults.categoryId || ""} onChange={(e) => field("blogDefaults", { ...form.blogDefaults, categoryId: Number(e.target.value) || undefined })}><option value="">Choose after testing WordPress</option>{wpOptions.categories.map((category) => <option key={category.id} value={category.id}>{category.name} · ID {category.id}</option>)}</select></label>
              <div className="field default-policy"><span>Publication policy</span><div><ShieldCheck size={18} /><p><strong>Private draft only</strong><small>Google approval and owner approval remain required before publication.</small></p></div></div>
              <datalist id="client-jurisdictions">{form.jurisdictions.map((jurisdiction) => <option key={jurisdiction} value={jurisdiction} />)}</datalist>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
