"use client";

import { finalApprovalReady } from "@/lib/content-workflow";
import CalendarView from "./components/calendar-view";

import { wordPressPreviewUrl } from "@/lib/wordpress-preview";

import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CircleAlert,
  Clock3,
  ExternalLink,
  LoaderCircle,
  Plus,
  RefreshCcw,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type {
  EditorialCadence,
  EditorialSchedule,
  EditorialSlot,
  EditorialSlotStatus,
} from "@/lib/editorial";

import { editorialDraftStatus as trackerStatus, editorialActionGroup, editorialStatusLabel } from "@/lib/editorial-draft-status";

type ClientSummary = {
  id: string;
  name: string;
  website: string;
  practiceAreas?: string[];
  jurisdictions?: string[];
  blogDefaults?: { defaultJurisdiction?: string };
};

type TrackerRecord = {
  id: string;
  editorialSlotId?: string;
  status?: string;
  docUrl?: string;
  wordpressPageId?: number;
  workflow?: string;
  preparationRequired?: boolean;
  aronDone?: boolean;
  error?: string;
  wordpressIntakeOnly?: boolean;
  featuredImageReviewRequired?: boolean;
  wordpressStatusError?: string;
  wordpressPreviewUrl?: string;
  wordpressEditUrl?: string;
  wordpressUrl?: string;
  wordpressStatus?: string;
  scheduledPublishAt?: string;
};

type ScheduleForm = {
  id: string;
  clientId: string;
  cadence: EditorialCadence;
  weekday: number;
  dayOfMonth: number;
  publishHour: number;
  timezone: string;
  leadDays: number;
  practiceAreas: string[];
  jurisdiction: string;
  candidateCount: number;
  enabled: boolean;
};

const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const timezones = [
  ["America/New_York", "Eastern"],
  ["America/Chicago", "Central"],
  ["America/Denver", "Mountain"],
  ["America/Los_Angeles", "Pacific"],
  ["America/Phoenix", "Arizona"],
  ["Pacific/Honolulu", "Hawaii"],
];

const blankSchedule: ScheduleForm = {
  id: "",
  clientId: "",
  cadence: "biweekly",
  weekday: 2,
  dayOfMonth: 15,
  publishHour: 9,
  timezone: "America/New_York",
  leadDays: 10,
  practiceAreas: [],
  jurisdiction: "",
  candidateCount: 8,
  enabled: true,
};

const statusLabels: Record<EditorialSlotStatus, string> = {
  topic_selection: "Choose a topic",
  selected: "Topic selected",
  drafting: "Drafting",
  review: "With reviewer",
  wordpress_draft: "WordPress draft",
  scheduled: "Scheduled",
  published: "Published",
  skipped: "Skipped",
  error: "Needs attention",
};

function formatDate(value: string, timezone?: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone || "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}


async function api(input?: Record<string, unknown>) {
  const response = await fetch("/api/editorial", input ? {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  } : { cache: "no-store" });
  const text = await response.text();
  const data = text ? JSON.parse(text) as Record<string, unknown> : {};
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "The editorial calendar could not be updated.");
  return data;
}

export default function EditorialCalendarPage() {
  const router = useRouter();
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [schedules, setSchedules] = useState<EditorialSchedule[]>([]);
  const [slots, setSlots] = useState<EditorialSlot[]>([]);
  const [records, setRecords] = useState<TrackerRecord[]>([]);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [calendarLayout, setCalendarLayout] = useState<"calendar" | "list">("calendar");
  const [working, setWorking] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [form, setForm] = useState<ScheduleForm>(blankSchedule);
  const [customTopics, setCustomTopics] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [clientsResponse, editorialData, trackerResponse] = await Promise.all([
        fetch("/api/clients", { cache: "no-store" }).then((response) => response.json()),
        api(),
        fetch("/api/tracker", { cache: "no-store" }).then((response) => response.json()),
      ]);
      const availableClients = Array.isArray(clientsResponse.clients) ? clientsResponse.clients as ClientSummary[] : [];
      setClients(availableClients);
      setConfigured(editorialData.configured === true);
      setSchedules(Array.isArray(editorialData.schedules) ? editorialData.schedules as EditorialSchedule[] : []);
      setSlots(Array.isArray(editorialData.slots) ? editorialData.slots as EditorialSlot[] : []);
      if (trackerResponse.error) throw new Error(trackerResponse.error);
      const reviewResponse = await fetch("/api/aron/review-queue", { cache: "no-store" });
      const reviewData = await reviewResponse.json();
      if (!reviewResponse.ok) throw new Error(reviewData.error || "Approval status could not be verified.");
      const combined = new Map<string, TrackerRecord>();
      for (const record of [...(trackerResponse.records || []), ...(reviewData.archivedRecords || []), ...(reviewData.records || [])]) {
        combined.set(record.id, { ...combined.get(record.id), ...record });
      }
      setRecords([...combined.values()]);
      setForm((current) => {
        if (current.clientId || !availableClients[0]) return current;
        const first = availableClients[0];
        return {
          ...current,
          clientId: first.id,
          practiceAreas: first.practiceAreas?.slice(0, 1) || [],
          jurisdiction: first.blogDefaults?.defaultJurisdiction || first.jurisdictions?.[0] || "",
        };
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The editorial calendar could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const recordsBySlot = useMemo(() => {
    const map = new Map<string, TrackerRecord>();
    for (const record of records) if (record.editorialSlotId) map.set(record.editorialSlotId, record);
    for (const slot of slots) {
      const record = records.find(item => item.id === slot.contentRecordId);
      if (record) map.set(slot.id, record);
    }
    return map;
  }, [records, slots]);

  const decisionSlots = useMemo(() => slots.filter((slot) =>
    editorialActionGroup(slot, recordsBySlot.get(slot.id)) === "topic",
  ), [slots, recordsBySlot]);

  const writingSlots = useMemo(() => slots.filter(slot => editorialActionGroup(slot, recordsBySlot.get(slot.id)) === "writing"), [slots, recordsBySlot]);

  const upcomingSlots = useMemo(() => slots
    .filter((slot) => slot.status !== "skipped")
    .sort((left, right) => left.publishAt.localeCompare(right.publishAt)), [slots]);

  function selectClient(clientId: string) {
    const client = clients.find((item) => item.id === clientId);
    setForm((current) => ({
      ...current,
      id: "",
      clientId,
      practiceAreas: client?.practiceAreas?.slice(0, 1) || [],
      jurisdiction: client?.blogDefaults?.defaultJurisdiction || client?.jurisdictions?.[0] || "",
    }));
  }

  function editSchedule(schedule: EditorialSchedule) {
    setForm({
      id: schedule.id,
      clientId: schedule.clientId,
      cadence: schedule.cadence,
      weekday: schedule.weekday,
      dayOfMonth: schedule.dayOfMonth,
      publishHour: schedule.publishHour,
      timezone: schedule.timezone,
      leadDays: schedule.leadDays,
      practiceAreas: schedule.practiceAreas,
      jurisdiction: schedule.jurisdiction,
      candidateCount: schedule.candidateCount,
      enabled: schedule.enabled,
    });
    setShowScheduleForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetScheduleForm() {
    const first = clients[0];
    setForm({
      ...blankSchedule,
      clientId: first?.id || "",
      practiceAreas: first?.practiceAreas?.slice(0, 1) || [],
      jurisdiction: first?.blogDefaults?.defaultJurisdiction || first?.jurisdictions?.[0] || "",
    });
  }

  async function saveSchedule(event: FormEvent) {
    event.preventDefault();
    setWorking("save");
    setError(null);
    setMessage(null);
    try {
      await api({ action: "save_schedule", ...form });
      setMessage(form.id ? "The editorial schedule was updated." : "The editorial schedule was created.");
      setShowScheduleForm(false);
      resetScheduleForm();
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The schedule could not be saved.");
    } finally {
      setWorking(null);
    }
  }

  async function runAction(key: string, input: Record<string, unknown>, success: string) {
    setWorking(key);
    setError(null);
    setMessage(null);
    try {
      await api(input);
      setMessage(success);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The action could not be completed.");
    } finally {
      setWorking(null);
    }
  }

  async function chooseTopic(slot: EditorialSlot, candidateId?: string) {
    const customTopic = (customTopics[slot.id] || "").trim();
    setWorking(`select:${slot.id}`);
    setError(null);
    try {
      const result = await api({ action: "select_topic", slotId: slot.id, candidateId, customTopic: candidateId ? "" : customTopic });
      const updated = result.slot as EditorialSlot;
      const query = new URLSearchParams({
        workflow: "blog",
        editorialSlotId: updated.id,
        clientId: updated.clientId,
        practiceArea: updated.practiceArea,
        topic: updated.selectedTopic || "",
        jurisdiction: updated.jurisdiction,
        publishAt: updated.publishAt,
      });
      router.push(`/?${query.toString()}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The topic could not be selected.");
      setWorking(null);
    }
  }

  const activeClient = clients.find((client) => client.id === form.clientId);

  return (
    <div className="editorial-shell">
      <header className="topbar editorial-topbar">
        <Link className="brand" href="/">
          <span className="brand-mark">A</span>
          <span className="brand-word">AMPLIFY</span>
          <span className="brand-product">Editorial Calendar</span>
        </Link>
        <div className="topbar-actions"><Link className="secondary-button compact" href="/published">Published</Link>
          <Link className="secondary-button compact" href="/"><ArrowLeft size={15} /> Content</Link>
          <button className="primary-button compact" onClick={() => { resetScheduleForm(); setShowScheduleForm(true); }} disabled={configured !== true}>
            <Plus size={15} /> New schedule
          </button>
        </div>
      </header>

      <main className="editorial-page">
        <section className="editorial-hero">
          <div>
            <p className="eyebrow"><CalendarDays size={14} /> Human-approved publishing cadence</p>
            <h1>Keep blog production moving without putting publishing on autopilot.</h1>
            <p>The timer prepares researched topic choices before each publishing date. A person still chooses the question, reviews the article, approves the WordPress draft, and schedules it.</p>
          </div>
          <div className="editorial-summary">
            <span><b>{decisionSlots.length}</b> decisions needed</span>
            <span><b>{schedules.filter((item) => item.enabled).length}</b> active schedules</span>
            <span><b>{upcomingSlots.filter((item) => trackerStatus(item, recordsBySlot.get(item.id)) === "scheduled").length}</b> scheduled posts</span>
          </div>
        </section>

        {message && <div className="notice editorial-notice"><Check size={16} /><span>{message}</span></div>}
        {error && <div className="editorial-alert error"><CircleAlert size={17} /><span>{error}</span></div>}

        {loading ? (
          <div className="editorial-loading"><LoaderCircle className="spin" size={27} /><strong>Loading editorial calendar…</strong></div>
        ) : configured === false ? (
          <section className="editorial-setup-card">
            <span><CircleAlert size={22} /></span>
            <div>
              <h2>Connect the calendar’s server-side storage</h2>
              <p>The daily timer cannot use the browser’s Google session. Add an Upstash Redis integration to this Vercel project; the app will detect its environment variables automatically. Client credentials and the content tracker remain in their existing protected storage.</p>
            </div>
          </section>
        ) : <>
          {showScheduleForm && (
            <section className="editorial-panel schedule-editor">
              <div className="editorial-panel-heading">
                <div><span>Schedule</span><h2>{form.id ? "Edit publishing schedule" : "Create a publishing schedule"}</h2></div>
                <button className="text-button" type="button" onClick={() => setShowScheduleForm(false)}>Close</button>
              </div>
              <form className="editorial-form" onSubmit={saveSchedule}>
                <label className="field field-full"><span>Client</span>
                  <select required value={form.clientId} onChange={(event) => selectClient(event.target.value)}>
                    <option value="" disabled>Choose a client</option>
                    {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                  </select>
                </label>
                <label className="field"><span>Cadence</span>
                  <select value={form.cadence} onChange={(event) => setForm((current) => ({ ...current, cadence: event.target.value as EditorialCadence }))}>
                    <option value="weekly">Every week</option>
                    <option value="biweekly">Every other week</option>
                    <option value="monthly">Every month</option>
                  </select>
                </label>
                {form.cadence === "monthly" ? (
                  <label className="field"><span>Day of month</span><input type="number" min="1" max="28" value={form.dayOfMonth} onChange={(event) => setForm((current) => ({ ...current, dayOfMonth: Number(event.target.value) }))} /></label>
                ) : (
                  <label className="field"><span>Publishing day</span><select value={form.weekday} onChange={(event) => setForm((current) => ({ ...current, weekday: Number(event.target.value) }))}>{weekdays.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label>
                )}
                <label className="field"><span>Publishing time</span><select value={form.publishHour} onChange={(event) => setForm((current) => ({ ...current, publishHour: Number(event.target.value) }))}>{Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{new Intl.DateTimeFormat("en-US", { hour: "numeric" }).format(new Date(2020, 0, 1, hour))}</option>)}</select></label>
                <label className="field"><span>Time zone</span><select value={form.timezone} onChange={(event) => setForm((current) => ({ ...current, timezone: event.target.value }))}>{timezones.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label className="field"><span>Topic choices arrive</span><select value={form.leadDays} onChange={(event) => setForm((current) => ({ ...current, leadDays: Number(event.target.value) }))}><option value={7}>7 days before</option><option value={10}>10 days before</option><option value={14}>14 days before</option><option value={21}>21 days before</option></select></label>
                <label className="field"><span>Questions per slot</span><select value={form.candidateCount} onChange={(event) => setForm((current) => ({ ...current, candidateCount: Number(event.target.value) }))}><option value={5}>5 choices</option><option value={8}>8 choices</option><option value={10}>10 choices</option><option value={12}>12 choices</option></select></label>
                <label className="field field-full"><span>Jurisdiction or audience</span><input required value={form.jurisdiction} placeholder="e.g. New Jersey" onChange={(event) => setForm((current) => ({ ...current, jurisdiction: event.target.value }))} /></label>
                <fieldset className="editorial-practice-areas field-full">
                  <legend>Practice areas to rotate</legend>
                  {(activeClient?.practiceAreas || []).map((area) => {
                    const checked = form.practiceAreas.includes(area);
                    return <label key={area}><input type="checkbox" checked={checked} onChange={() => setForm((current) => ({ ...current, practiceAreas: checked ? current.practiceAreas.filter((item) => item !== area) : [...current.practiceAreas, area] }))} /><span>{checked && <Check size={12} />}</span>{area}</label>;
                  })}
                </fieldset>
                <label className="editorial-toggle field-full"><input type="checkbox" checked={form.enabled} onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))} /><span />Keep this schedule active</label>
                <div className="editorial-form-actions field-full"><button className="primary-button" disabled={working === "save"}>{working === "save" ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}{form.id ? "Save changes" : "Create schedule"}</button></div>
              </form>
            </section>
          )}

          <section className="editorial-panel">
            <div className="editorial-panel-heading">
              <div><span>Human checkpoint</span><h2>Topics waiting for a decision</h2><p>Select one question or enter a better topic. That opens the normal AMPLIFY blog builder with the client and brief filled in.</p></div>
            </div>
            {decisionSlots.length === 0 ? (
              <div className="editorial-empty"><Sparkles size={22} /><h3>No topic decisions are waiting</h3><p>Use “Prepare choices now” on a schedule to create the next slot immediately.</p></div>
            ) : <div className="decision-list">
              {decisionSlots.map((slot) => (
                <article className="decision-card" key={slot.id}>
                  <header><div><span>{slot.clientName}</span><h3>{(slot.practiceAreas?.length || 0) > 1 ? `${slot.practiceAreas!.length} selected practice areas` : slot.practiceArea}</h3><p>Planned for {formatDate(slot.publishAt)}</p></div><span className={`editorial-status status-${slot.status}`}>{statusLabels[slot.status]}</span></header>
                  {slot.selectedTopic && trackerStatus(slot, recordsBySlot.get(slot.id)) === "error" && <p><strong>{slot.selectedTopic}</strong><br />Drafting did not produce a saved review draft. <a href={`/editorial-calendar/recover?slot=${encodeURIComponent(slot.id)}`}>Check and recover draft →</a></p>}
                  {slot.error && <div className="editorial-inline-error"><CircleAlert size={15} />{slot.error}</div>}
                  {slot.candidates.length > 0 && <div className="candidate-list">
                    {slot.candidates.map((candidate) => (
                      <button key={candidate.id} disabled={Boolean(working)} onClick={() => void chooseTopic(slot, candidate.id)}>
                        <span>{candidate.question}</span><small>{candidate.practiceArea || slot.practiceArea} · {candidate.cluster || candidate.sourceTerm}</small><ArrowRight size={15} />
                      </button>
                    ))}
                  </div>}
                  <div className="custom-topic"><input value={customTopics[slot.id] || ""} onChange={(event) => setCustomTopics((current) => ({ ...current, [slot.id]: event.target.value }))} placeholder="Or enter a custom question…" /><button className="secondary-button compact" disabled={(customTopics[slot.id] || "").trim().length < 10 || Boolean(working)} onClick={() => void chooseTopic(slot)}>Use custom topic</button></div>
                  <footer><button className="text-button" disabled={Boolean(working)} onClick={() => void runAction(`refresh:${slot.id}`, { action: "refresh_candidates", slotId: slot.id }, "Fresh question choices are ready.")}>{working === `refresh:${slot.id}` ? <LoaderCircle className="spin" size={14} /> : <RefreshCcw size={14} />}Find different questions</button><button className="text-button editorial-skip" disabled={Boolean(working)} onClick={() => void runAction(`skip:${slot.id}`, { action: "skip_slot", slotId: slot.id }, "The publishing slot was skipped.")}>Skip this slot</button></footer>
                </article>
              ))}
            </div>}
          </section>

          {writingSlots.length > 0 && <section className="editorial-panel"><div className="editorial-panel-heading"><div><h2>Writing progress</h2><p>These topics are already selected. Continue the existing brief or check its writing job.</p></div></div><div className="decision-list">{writingSlots.map(slot => <article className="decision-card" key={slot.id}><header><div><span>{slot.clientName} · {slot.practiceArea}</span><h3>{slot.selectedTopic}</h3><p>Assigned: {formatDate(slot.publishAt)}</p></div><span className={`editorial-status status-${trackerStatus(slot, recordsBySlot.get(slot.id))}`}>{editorialStatusLabel(slot, recordsBySlot.get(slot.id))}</span></header>{slot.error && <p>{slot.error}</p>}<a href={`/editorial-calendar/recover?slot=${encodeURIComponent(slot.id)}`}>{trackerStatus(slot, recordsBySlot.get(slot.id)) === "drafting" ? "View writing progress →" : "Continue draft →"}</a></article>)}</div></section>}

          <section className="editorial-panel">
            <div className="editorial-panel-heading"><div><span>Cadence</span><h2>Client schedules</h2></div></div>
            {schedules.length === 0 ? <div className="editorial-empty"><CalendarDays size={22} /><h3>No schedules yet</h3><p>Create one to start receiving topic choices.</p></div> : <div className="schedule-list">
              {schedules.map((schedule) => (
                <article key={schedule.id}>
                  <div><span className="client-avatar">{schedule.clientName.slice(0, 1)}</span><div><h3>{schedule.clientName}</h3><p>{schedule.cadence === "monthly" ? `Monthly on day ${schedule.dayOfMonth}` : `${schedule.cadence === "weekly" ? "Weekly" : "Every other week"} on ${weekdays[schedule.weekday]}s`} · {schedule.practiceAreas.join(", ")}</p><small>{schedule.enabled ? "Active" : "Paused"} · {schedule.leadDays}-day review lead time · {schedule.timezone.replace("America/", "")}</small></div></div>
                  <div className="schedule-actions"><button className="secondary-button compact" onClick={() => editSchedule(schedule)}>Edit</button><button className="secondary-button compact" disabled={Boolean(working)} onClick={() => void runAction(`run:${schedule.id}`, { action: "generate_now", scheduleId: schedule.id, fresh: false }, "The next topic choices are ready.")}>{working === `run:${schedule.id}` ? <LoaderCircle className="spin" size={14} /> : <Sparkles size={14} />}Prepare choices now</button><button className="icon-button danger" aria-label={`Delete ${schedule.clientName} schedule`} onClick={() => { if (window.confirm(`Delete the editorial schedule for ${schedule.clientName}?`)) void runAction(`delete:${schedule.id}`, { action: "delete_schedule", scheduleId: schedule.id }, "The schedule was deleted."); }}><Trash2 size={15} /></button></div>
                </article>
              ))}
            </div>}
          </section>

          <section className="editorial-panel">
            <div className="editorial-panel-heading"><div><span>Pipeline</span><h2>Publishing calendar</h2><p>Every live step remains visible. Publishing only happens after final human approval.</p></div><button className="text-button" onClick={() => void load()}><RefreshCcw size={14} />Refresh</button></div>
            <div className="calendar-layout-switch" role="group" aria-label="Publishing view"><button type="button" aria-pressed={calendarLayout === "calendar"} onClick={() => setCalendarLayout("calendar")}>Calendar</button><button type="button" aria-pressed={calendarLayout === "list"} onClick={() => setCalendarLayout("list")}>List</button></div>
            {calendarLayout === "calendar" ? <CalendarView events={upcomingSlots.map(slot => {
              const record = recordsBySlot.get(slot.id);
              const status = trackerStatus(slot, record);
              return { id: slot.id, publishAt: slot.publishAt, client: slot.clientName, title: slot.selectedTopic || "Topic choice pending", statusKey: status, status: editorialStatusLabel(slot, record), url: ["error", "drafting", "selected"].includes(status) ? `/editorial-calendar/recover?slot=${encodeURIComponent(slot.id)}` : status === "wordpress_draft" && record ? `/final-review/${encodeURIComponent(record.id)}` : (record && wordPressPreviewUrl(record)) || record?.docUrl };
            })} /> : upcomingSlots.length === 0 ? <div className="editorial-empty"><Clock3 size={22} /><h3>No publishing slots yet</h3></div> : <div className="calendar-list">
              {upcomingSlots.map((slot) => {
                const record = recordsBySlot.get(slot.id);
                const status = trackerStatus(slot, record);
                const finalReady = Boolean(record && finalApprovalReady(record));
                const reviewUrl = ["error", "drafting", "selected"].includes(status) ? `/editorial-calendar/recover?slot=${encodeURIComponent(slot.id)}` : status === "wordpress_draft" && record ? `/final-review/${encodeURIComponent(record.id)}` : (record && wordPressPreviewUrl(record)) || record?.docUrl;
                return <article key={slot.id}><time>{formatDate(slot.publishAt)}</time><div><span>{slot.clientName} · {slot.practiceArea}</span><h3>{slot.selectedTopic || "Topic choice pending"}</h3><p>{slot.jurisdiction}</p></div><span className={`editorial-status status-${status}`}>{finalReady ? <a href={reviewUrl}>Ready for your approval →</a> : editorialStatusLabel(slot, record)}</span>{record?.wordpressStatusError && <p role="alert">{record.wordpressStatusError}</p>}{reviewUrl ? <a className="icon-button" href={reviewUrl} target="_blank" rel="noreferrer" aria-label={finalReady ? "Review and approve" : "Open review"}><ExternalLink size={15} /></a> : <span className="calendar-spacer" />}</article>;
              })}
            </div>}
          </section>
        </>}
      </main>
    </div>
  );
}
