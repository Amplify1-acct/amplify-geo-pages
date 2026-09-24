"use client";

import { useState } from "react";

const PAGE_IDS = [
  2665, 2659, 2561, 2556, 2553, 2550, 2547, 2541, 2537, 2533,
  2521, 2517, 2511, 2529, 2525, 2500, 2485, 2475, 2492, 2479,
  2469, 2465, 2462, 2458, 2450,
];

type RepairResult = {
  ok?: boolean;
  repaired?: Array<{ id: number; title: string; url: string }>;
  failed?: Array<{ id: number; error: string }>;
  error?: string;
};

type DirectoryResult = {
  ok?: boolean;
  updated?: Array<{ id: number; title: string; url: string; anchorsChanged: number }>;
  unchanged?: Array<{ id: number; title: string; url: string }>;
  failed?: Array<{ id?: number; slug?: string; error: string }>;
  error?: string;
};

export default function FulginitiTruckStateRepairPage() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RepairResult | null>(null);
  const [directoryResult, setDirectoryResult] = useState<DirectoryResult | null>(null);
  const [personalInjuryDirectoryResult, setPersonalInjuryDirectoryResult] = useState<DirectoryResult | null>(null);

  async function runRepair(pageIds = PAGE_IDS) {
    setRunning(true);
    setResult(null);
    try {
      const clientsResponse = await fetch("/api/clients", { cache: "no-store" });
      const clientsData = await clientsResponse.json() as {
        clients?: Array<{ id: string; website: string }>;
      };
      const client = clientsData.clients?.find((candidate) => {
        try {
          return new URL(candidate.website).hostname.replace(/^www\./, "") === "fulginiti-law.com";
        } catch {
          return false;
        }
      });
      if (!client) throw new Error("The connected Fulginiti Law client was not found.");
      const response = await fetch("/api/wordpress/repair-enhancement-locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: client.id,
          pageIds,
          expectedPracticeArea: "Truck Accidents",
          confirmed: true,
        }),
      });
      const data = await response.json() as RepairResult;
      if (!response.ok) throw new Error(data.error || "The repair request failed.");
      setResult(data);
    } catch (error) {
      setResult({ error: error instanceof Error ? error.message : "The repair request failed." });
    } finally {
      setRunning(false);
    }
  }

  async function normalizeDirectoryLabels() {
    setRunning(true);
    setDirectoryResult(null);
    try {
      const clientsResponse = await fetch("/api/clients", { cache: "no-store" });
      const clientsData = await clientsResponse.json() as {
        clients?: Array<{ id: string; website: string }>;
      };
      const client = clientsData.clients?.find((candidate) => {
        try {
          return new URL(candidate.website).hostname.replace(/^www\./, "") === "fulginiti-law.com";
        } catch {
          return false;
        }
      });
      if (!client) throw new Error("The connected Fulginiti Law client was not found.");
      const response = await fetch("/api/wordpress/fulginiti-truck-directory-labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: client.id, confirmed: true }),
      });
      const data = await response.json() as DirectoryResult;
      if (!response.ok) throw new Error(data.error || "The directory update failed.");
      setDirectoryResult(data);
    } catch (error) {
      setDirectoryResult({ error: error instanceof Error ? error.message : "The directory update failed." });
    } finally {
      setRunning(false);
    }
  }

  async function normalizePersonalInjuryDirectoryLabels() {
    setRunning(true);
    setPersonalInjuryDirectoryResult(null);
    try {
      const clientsResponse = await fetch("/api/clients", { cache: "no-store" });
      const clientsData = await clientsResponse.json() as {
        clients?: Array<{ id: string; website: string }>;
      };
      const client = clientsData.clients?.find((candidate) => {
        try {
          return new URL(candidate.website).hostname.replace(/^www\./, "") === "fulginiti-law.com";
        } catch {
          return false;
        }
      });
      if (!client) throw new Error("The connected Fulginiti Law client was not found.");
      const response = await fetch("/api/wordpress/fulginiti-personal-injury-directory-labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: client.id, confirmed: true }),
      });
      const data = await response.json() as DirectoryResult;
      if (!response.ok) throw new Error(data.error || "The personal-injury directory update failed.");
      setPersonalInjuryDirectoryResult(data);
    } catch (error) {
      setPersonalInjuryDirectoryResult({ error: error instanceof Error ? error.message : "The personal-injury directory update failed." });
    } finally {
      setRunning(false);
    }
  }

  return (
    <main style={{ maxWidth: 920, margin: "60px auto", padding: 24, fontFamily: "Arial, sans-serif" }}>
      <h1>Fulginiti truck-page state repair</h1>
      <p>This authenticated maintenance pass adds the verified state abbreviation to the 25 enhanced truck-accident pages updated today, then refreshes their CTAs and SEO metadata.</p>
      <button
        type="button"
        onClick={() => runRepair()}
        disabled={running}
        style={{ padding: "14px 20px", border: 0, borderRadius: 8, background: "#17312d", color: "white", fontWeight: 700, cursor: running ? "wait" : "pointer" }}
      >
        {running ? "Repairing…" : "Run verified repair"}
      </button>
      <button
        type="button"
        onClick={() => runRepair([2517])}
        disabled={running}
        style={{ marginLeft: 12, padding: "14px 20px", border: "1px solid #17312d", borderRadius: 8, background: "white", color: "#17312d", fontWeight: 700, cursor: running ? "wait" : "pointer" }}
      >
        Repair King of Prussia only
      </button>
      <button
        type="button"
        onClick={() => normalizeDirectoryLabels()}
        disabled={running}
        style={{ marginLeft: 12, padding: "14px 20px", border: "1px solid #17312d", borderRadius: 8, background: "white", color: "#17312d", fontWeight: 700, cursor: running ? "wait" : "pointer" }}
      >
        {running ? "Updating…" : "Use city-only truck directory anchors"}
      </button>
      <button
        type="button"
        onClick={() => normalizePersonalInjuryDirectoryLabels()}
        disabled={running}
        style={{ marginTop: 12, padding: "14px 20px", border: "1px solid #17312d", borderRadius: 8, background: "white", color: "#17312d", fontWeight: 700, cursor: running ? "wait" : "pointer" }}
      >
        {running ? "Updating…" : "Use city-only personal-injury directory anchors"}
      </button>
      {result?.error && <p role="alert" style={{ color: "#a42121" }}>{result.error}</p>}
      {result?.repaired && (
        <section>
          <h2>Repaired: {result.repaired.length}</h2>
          <ul>{result.repaired.map((page) => <li key={page.id}><a href={page.url}>{page.title}</a></li>)}</ul>
        </section>
      )}
      {result?.failed?.length ? (
        <section>
          <h2>Needs attention: {result.failed.length}</h2>
          <ul>{result.failed.map((page) => <li key={page.id}>{page.id}: {page.error}</li>)}</ul>
        </section>
      ) : null}
      {directoryResult?.error && <p role="alert" style={{ color: "#a42121" }}>{directoryResult.error}</p>}
      {directoryResult?.updated && (
        <section>
          <h2>Directory pages updated: {directoryResult.updated.length}</h2>
          <p>Unchanged: {directoryResult.unchanged?.length || 0}</p>
          <ul>{directoryResult.updated.map((page) => <li key={page.id}><a href={page.url}>{page.title}</a> — {page.anchorsChanged} anchors</li>)}</ul>
        </section>
      )}
      {directoryResult?.failed?.length ? (
        <section>
          <h2>Directory pages needing attention: {directoryResult.failed.length}</h2>
          <ul>{directoryResult.failed.map((page) => <li key={page.id || page.slug}>{page.id || page.slug}: {page.error}</li>)}</ul>
        </section>
      ) : null}
      {personalInjuryDirectoryResult?.error && <p role="alert" style={{ color: "#a42121" }}>{personalInjuryDirectoryResult.error}</p>}
      {personalInjuryDirectoryResult?.updated && (
        <section>
          <h2>Personal-injury directory pages updated: {personalInjuryDirectoryResult.updated.length}</h2>
          <p>Unchanged: {personalInjuryDirectoryResult.unchanged?.length || 0}</p>
          <ul>{personalInjuryDirectoryResult.updated.map((page) => <li key={page.id}><a href={page.url}>{page.title}</a> — {page.anchorsChanged} anchors</li>)}</ul>
        </section>
      )}
      {personalInjuryDirectoryResult?.failed?.length ? (
        <section>
          <h2>Personal-injury directories needing attention: {personalInjuryDirectoryResult.failed.length}</h2>
          <ul>{personalInjuryDirectoryResult.failed.map((page) => <li key={page.id || page.slug}>{page.id || page.slug}: {page.error}</li>)}</ul>
        </section>
      ) : null}
    </main>
  );
}
