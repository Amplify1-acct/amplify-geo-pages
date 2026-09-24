"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type AuditRow = {
  id: number;
  group: string;
  locale: "en" | "es";
  label: string;
  pageUrl: string;
  contentLength: number;
  complete: boolean;
  repairable: boolean;
  ctaOk: boolean;
  bannerOk: boolean;
  directoryOk: boolean;
  directLinksOk: boolean;
  localeVideoOk: boolean;
  videoResponsiveOk: boolean;
};

type AuditReport = {
  generatedAt: string;
  total: number;
  complete: number;
  incomplete: number;
  repairableIncomplete: number;
  rows: AuditRow[];
};

const groupNames: Record<string, string> = {
  "new-york": "New York County",
  westchester: "Westchester County",
  bronx: "Bronx County",
  rockland: "Rockland County",
  queens: "Queens County",
  brooklyn: "Kings County / Brooklyn",
};

export default function BillyGeoAuditClient() {
  const [report, setReport] = useState<AuditReport | null>(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [failed, setFailed] = useState<Array<{ id: number; message: string }>>([]);

  const load = useCallback(async () => {
    setError("");
    const response = await fetch("/api/wordpress/billy-geo-audit", { cache: "no-store" });
    const data = await response.json() as AuditReport & { error?: string };
    if (!response.ok) throw new Error(data.error || "The GEO audit could not be loaded.");
    setReport(data);
    return data;
  }, []);

  useEffect(() => {
    load().catch((reason) => setError(reason instanceof Error ? reason.message : "The GEO audit could not be loaded."));
  }, [load]);

  const summaries = useMemo(() => {
    if (!report) return [];
    return Object.keys(groupNames).map((group) => {
      const rows = report.rows.filter((row) => row.group === group);
      return {
        group,
        total: rows.length,
        complete: rows.filter((row) => row.complete).length,
        cta: rows.filter((row) => row.ctaOk).length,
        banner: rows.filter((row) => row.bannerOk).length,
        directory: rows.filter((row) => row.directoryOk).length,
      };
    });
  }, [report]);

  async function repairAll() {
    if (!report || running) return;
    const targets = report.rows.filter((row) => !row.complete && row.repairable);
    setRunning(true);
    setCompleted(0);
    setFailed([]);
    let cursor = 0;
    const failures: Array<{ id: number; message: string }> = [];
    async function worker() {
      while (cursor < targets.length) {
        const index = cursor;
        cursor += 1;
        const target = targets[index];
        try {
          const response = await fetch("/api/wordpress/billy-geo-audit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pageId: target.id }),
          });
          const data = await response.json() as { error?: string };
          if (!response.ok) throw new Error(data.error || `Page ${target.id} could not be repaired.`);
        } catch (reason) {
          failures.push({ id: target.id, message: reason instanceof Error ? reason.message : "Unknown repair error" });
          setFailed([...failures]);
        } finally {
          setCompleted((value) => value + 1);
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(4, Math.max(1, targets.length)) }, () => worker()));
    try {
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The final GEO audit could not be loaded.");
    }
    setRunning(false);
  }

  const targets = report?.rows.filter((row) => !row.complete && row.repairable) || [];

  return (
    <main style={{ minHeight: "100vh", background: "#f4f6f3", color: "#15332e", padding: "48px 24px", fontFamily: "Arial, Helvetica, sans-serif" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <p style={{ margin: 0, color: "#60736f", textTransform: "uppercase", letterSpacing: 2, fontWeight: 700 }}>Billy Cooper Law</p>
        <h1 style={{ margin: "10px 0 8px", fontSize: 42 }}>GEO page audit and repair</h1>
        <p style={{ maxWidth: 780, lineHeight: 1.6, color: "#52635f" }}>
          Checks every English and Spanish county, city, and neighborhood page for the locked Billy CTA cards, the approved local banner, reciprocal county links, direct outbound links, and the correct language video.
        </p>

        {error && <div style={{ marginTop: 24, padding: 16, borderRadius: 12, background: "#fff0ed", color: "#9b2c1f" }}>{error}</div>}

        {!report ? (
          <div style={{ marginTop: 32, padding: 28, borderRadius: 18, background: "white" }}>Running audit…</div>
        ) : (
          <>
            <section style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 14, marginTop: 30 }}>
              {[
                ["Live GEO pages", report.total],
                ["Complete", report.complete],
                ["Need repair", report.incomplete],
                ["Repairable now", report.repairableIncomplete],
              ].map(([label, value]) => (
                <div key={String(label)} style={{ padding: 20, borderRadius: 16, background: "white", border: "1px solid #dfe6e2" }}>
                  <div style={{ fontSize: 13, color: "#6d7c78", textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
                  <strong style={{ display: "block", marginTop: 8, fontSize: 34 }}>{value}</strong>
                </div>
              ))}
            </section>
            <p style={{ color: "#687773" }}>WordPress content loaded for {report.rows.filter((row) => row.contentLength > 0).length} of {report.total} pages.</p>

            <section style={{ marginTop: 22, padding: 22, borderRadius: 18, background: "white", border: "1px solid #dfe6e2" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 24 }}>County groups</h2>
                  <p style={{ margin: "7px 0 0", color: "#687773" }}>English and Spanish pages are counted together.</p>
                </div>
                <button
                  type="button"
                  onClick={repairAll}
                  disabled={running || targets.length === 0}
                  style={{ border: 0, borderRadius: 999, padding: "14px 22px", background: running || targets.length === 0 ? "#bdc8c4" : "#15332e", color: "white", fontWeight: 800, cursor: running || targets.length === 0 ? "default" : "pointer" }}
                >
                  {running ? `Repairing ${completed} of ${targets.length}…` : targets.length ? `Repair ${targets.length} live GEO pages` : "All pages complete"}
                </button>
              </div>
              <div style={{ overflowX: "auto", marginTop: 22 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead><tr>{["County group", "Complete", "CTAs", "Banners", "County links"].map((heading) => <th key={heading} style={{ padding: "10px 12px", borderBottom: "1px solid #dfe6e2", fontSize: 13, color: "#6d7c78" }}>{heading}</th>)}</tr></thead>
                  <tbody>{summaries.map((summary) => <tr key={summary.group}>
                    <td style={{ padding: 12, borderBottom: "1px solid #edf1ef", fontWeight: 700 }}>{groupNames[summary.group]}</td>
                    <td style={{ padding: 12, borderBottom: "1px solid #edf1ef" }}>{summary.complete}/{summary.total}</td>
                    <td style={{ padding: 12, borderBottom: "1px solid #edf1ef" }}>{summary.cta}/{summary.total}</td>
                    <td style={{ padding: 12, borderBottom: "1px solid #edf1ef" }}>{summary.banner}/{summary.total}</td>
                    <td style={{ padding: 12, borderBottom: "1px solid #edf1ef" }}>{summary.directory}/{summary.total}</td>
                  </tr>)}</tbody>
                </table>
              </div>
            </section>

            {running && <div style={{ marginTop: 18, height: 10, overflow: "hidden", borderRadius: 999, background: "#dfe6e2" }}><div style={{ height: "100%", width: `${targets.length ? (completed / targets.length) * 100 : 0}%`, background: "#c8a94d", transition: "width .2s" }} /></div>}
            {failed.length > 0 && <section style={{ marginTop: 18, padding: 18, borderRadius: 14, background: "#fff0ed", color: "#8f2f22" }}><strong>{failed.length} page repairs need another pass.</strong><ul>{failed.map((item) => <li key={item.id}>Page {item.id}: {item.message}</li>)}</ul></section>}
          </>
        )}
      </div>
    </main>
  );
}
