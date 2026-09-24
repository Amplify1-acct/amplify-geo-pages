"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Row = {
  key: string;
  englishId: number;
  title: string;
  label: string;
  slug: string;
  id: number;
  status: string;
  link: string;
  readyDraft: boolean;
  complete: boolean;
};

type Report = {
  total: number;
  complete: number;
  missing: number;
  drafts: number;
  draftsReady: number;
  needPreparation: number;
  rows: Row[];
};

export default function BillySpanishMirrorsClient() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/wordpress/billy-spanish-mirrors", { cache: "no-store" });
    const data = await response.json() as Report & { error?: string };
    if (!response.ok) throw new Error(data.error || "The Spanish inventory could not be loaded.");
    setReport(data);
    return data;
  }, []);

  useEffect(() => {
    load().catch((reason) => setError(reason instanceof Error ? reason.message : "The Spanish inventory could not be loaded."));
  }, [load]);

  const readyToFinalize = useMemo(() => Boolean(
    report && report.missing === 0 && report.needPreparation === 0 && report.complete < report.total,
  ), [report]);

  async function createAll() {
    if (!report || running) return;
    setRunning(true);
    setError("");
    setMessage("");
    try {
      const targets = report.rows.filter((row) => !row.complete && !row.readyDraft);
      const hub = targets.find((row) => row.key === "new-york-county");
      if (hub) {
        setMessage(`Translating ${hub.label}…`);
        await create(hub.key);
      }
      const children = targets.filter((row) => row.key !== "new-york-county");
      let cursor = 0;
      let completed = 0;
      async function worker() {
        while (cursor < children.length) {
          const row = children[cursor];
          cursor += 1;
          setMessage(`Translating ${row.label} (${completed + 1} of ${children.length})…`);
          await create(row.key);
          completed += 1;
        }
      }
      await Promise.all(Array.from({ length: Math.min(2, Math.max(1, children.length)) }, () => worker()));
      const current = await load();
      setMessage(`${current.draftsReady} Spanish drafts are ready for final verification.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The Spanish drafts could not be created.");
    } finally {
      setRunning(false);
    }
  }

  async function create(key: string) {
    const response = await fetch("/api/wordpress/billy-spanish-mirrors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", key }),
    });
    const data = await response.json() as { error?: string };
    if (!response.ok) throw new Error(data.error || `${key} could not be created.`);
  }

  async function finalize() {
    if (!report || running || !readyToFinalize) return;
    setRunning(true);
    setError("");
    setMessage("Adding Spanish videos, reciprocal links, banners, metadata, and instant Billy CTAs…");
    try {
      const response = await fetch("/api/wordpress/billy-spanish-mirrors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "finalize" }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "The Spanish pages could not be published.");
      const current = await load();
      setMessage(`${current.complete} of ${current.total} Spanish New York County pages are live and verified.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The Spanish pages could not be published.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", padding: "48px 24px", background: "#f4f6f3", color: "#15332e", fontFamily: "Arial, Helvetica, sans-serif" }}>
      <div style={{ maxWidth: 1060, margin: "0 auto" }}>
        <p style={{ margin: 0, color: "#697a75", fontWeight: 800, letterSpacing: 2, textTransform: "uppercase" }}>Billy Cooper Law</p>
        <h1 style={{ margin: "10px 0", fontSize: 42 }}>Spanish New York County mirrors</h1>
        <p style={{ maxWidth: 800, color: "#536560", lineHeight: 1.6 }}>
          Creates the seven missing, indexable Spanish GEO pages from their English counterparts. Every page receives its own Spanish URL, localized copy and metadata, the approved Spanish firm video, the matching local banner, reciprocal county links, and the instant Billy CTA cards.
        </p>
        {error && <div style={{ marginTop: 22, padding: 16, borderRadius: 12, background: "#fff0ed", color: "#962f22" }}>{error}</div>}
        {message && <div style={{ marginTop: 22, padding: 16, borderRadius: 12, background: "#edf6f1", color: "#245443" }}>{message}</div>}
        {!report ? <div style={{ marginTop: 28, padding: 24, borderRadius: 16, background: "white" }}>Loading WordPress inventory…</div> : <>
          <section style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 14, marginTop: 28 }}>
            {[["Expected", report.total], ["Need preparation", report.needPreparation], ["Drafts ready", report.draftsReady], ["Live + verified", report.complete]].map(([label, value]) => <div key={String(label)} style={{ padding: 20, borderRadius: 16, background: "white", border: "1px solid #dce5e1" }}><div style={{ color: "#71807c", fontSize: 12, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase" }}>{label}</div><strong style={{ display: "block", marginTop: 8, fontSize: 34 }}>{value}</strong></div>)}
          </section>
          <section style={{ marginTop: 24, padding: 22, borderRadius: 18, background: "white", border: "1px solid #dce5e1" }}>
            <div style={{ display: "flex", gap: 12, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
              <div><h2 style={{ margin: 0 }}>Mirror set</h2><p style={{ margin: "7px 0 0", color: "#687873" }}>Nothing is published until all seven drafts exist.</p></div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={createAll} disabled={running || report.needPreparation === 0} style={{ border: 0, borderRadius: 999, padding: "13px 20px", background: running || report.needPreparation === 0 ? "#bcc7c3" : "#c9aa52", color: "#0c2f3f", fontWeight: 900 }}>{running ? "Working…" : `Prepare ${report.needPreparation} Spanish drafts`}</button>
                <button onClick={finalize} disabled={running || !readyToFinalize} style={{ border: 0, borderRadius: 999, padding: "13px 20px", background: running || !readyToFinalize ? "#bcc7c3" : "#15332e", color: "white", fontWeight: 900 }}>Verify and publish all 7</button>
              </div>
            </div>
            <div style={{ overflowX: "auto", marginTop: 20 }}><table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr>{["Spanish page", "English source", "WordPress ID", "Status"].map((heading) => <th key={heading} style={{ textAlign: "left", padding: 11, borderBottom: "1px solid #dce5e1", color: "#71807c", fontSize: 12 }}>{heading}</th>)}</tr></thead><tbody>{report.rows.map((row) => <tr key={row.key}><td style={{ padding: 11, borderBottom: "1px solid #edf1ef", fontWeight: 700 }}>{row.link ? <a href={row.link} target="_blank" rel="noreferrer" style={{ color: "#15332e" }}>{row.label}</a> : row.label}</td><td style={{ padding: 11, borderBottom: "1px solid #edf1ef" }}>{row.englishId}</td><td style={{ padding: 11, borderBottom: "1px solid #edf1ef" }}>{row.id || "—"}</td><td style={{ padding: 11, borderBottom: "1px solid #edf1ef" }}>{row.complete ? "Live + verified" : row.readyDraft ? "Draft ready" : row.status === "missing" ? "Missing" : "Needs refresh"}</td></tr>)}</tbody></table></div>
          </section>
        </>}
      </div>
    </main>
  );
}
