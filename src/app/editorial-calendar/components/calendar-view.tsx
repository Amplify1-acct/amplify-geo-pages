"use client";

import { useState } from "react";

type Event = { id: string; publishAt: string; client: string; title: string; status: string; statusKey: string; url?: string };
type View = "day" | "week" | "month";
const zone = "America/New_York";
function key(date: Date) { return date.toISOString().slice(0, 10); }
function localKey(value: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  return ["year", "month", "day"].map(type => parts.find(p => p.type === type)!.value).join("-");
}
function date(value: string) { return new Date(`${value}T12:00:00Z`); }
function add(value: Date, days: number) { const next = new Date(value); next.setUTCDate(next.getUTCDate() + days); return next; }
const label = (value: Date, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(value);

export default function CalendarView({ events }: { events: Event[] }) {
  const [view, setView] = useState<View>("month");
  const [focus, setFocus] = useState(() => localKey(new Date().toISOString()));
  const current = date(focus);
  const today = localKey(new Date().toISOString());
  let start = current;
  let count = 1;
  if (view === "week") { start = add(current, -current.getUTCDay()); count = 7; }
  if (view === "month") {
    const first = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 1, 12));
    start = add(first, -first.getUTCDay());
    const last = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 0, 12));
    count = Math.ceil((first.getUTCDay() + last.getUTCDate()) / 7) * 7;
  }
  function move(direction: number) {
    if (view === "month") setFocus(key(new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + direction, 1, 12))));
    else setFocus(key(add(current, direction * (view === "week" ? 7 : 1))));
  }
  const heading = view === "month" ? label(current, { month: "long", year: "numeric" }) : view === "day" ? label(current, { weekday: "long", month: "long", day: "numeric", year: "numeric" }) : `${label(start, { month: "short", day: "numeric" })} – ${label(add(start, 6), { month: "short", day: "numeric", year: "numeric" })}`;
  return <div className="publishing-calendar">
    <div className="calendar-controls">
      <div className="calendar-range"><button type="button" aria-label={`Previous ${view}`} onClick={() => move(-1)}>‹</button><button type="button" onClick={() => setFocus(today)}>Today</button><button type="button" aria-label={`Next ${view}`} onClick={() => move(1)}>›</button><h3 aria-live="polite">{heading}</h3></div>
      <div className="calendar-view-switch" role="group" aria-label="Calendar period">{(["day", "week", "month"] as View[]).map(value => <button type="button" key={value} aria-pressed={view === value} onClick={() => setView(value)}>{value[0].toUpperCase() + value.slice(1)}</button>)}</div>
    </div>
    <p className="calendar-zone">All times Eastern · Select a date to open its day view. Preview links open the saved content.</p>
    <div className="calendar-scroll"><div className={`publishing-grid view-${view}`}>
      {view !== "day" && ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => <div className="calendar-weekday" key={day}>{day}</div>)}
      {Array.from({ length: count }, (_, i) => {
        const day = add(start, i); const dayKey = key(day);
        const items = events.filter(event => localKey(event.publishAt) === dayKey).sort((a, b) => a.publishAt.localeCompare(b.publishAt) || a.client.localeCompare(b.client));
        return <section aria-label={label(day, { dateStyle: "full" })} key={dayKey} className={`calendar-day ${dayKey === today ? "is-today" : ""} ${view === "month" && day.getUTCMonth() !== current.getUTCMonth() ? "outside-month" : ""}`}>
          <button className="calendar-date" type="button" aria-label={`View ${label(day, { dateStyle: "full" })}`} onClick={() => { setFocus(dayKey); setView("day"); }}>{label(day, view === "month" ? { day: "numeric" } : { month: "short", day: "numeric" })}{dayKey === today && <span>Today</span>}</button>
          {items.length === 0 ? <p className="calendar-no-events">No posts</p> : items.map(event => <article key={event.id} className={`calendar-event event-${event.statusKey}`}>
            <time dateTime={event.publishAt}>{new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric", minute: "2-digit" }).format(new Date(event.publishAt))}</time>
            <strong>{event.client}</strong><p>{event.title}</p><span className="calendar-event-status">{event.status}</span>
            {event.url && <a href={event.url} target="_blank" rel="noreferrer">{event.status === "Ready for final approval" ? "Review & approve" : event.statusKey === "published" ? "View published page" : "Preview / review"} ↗</a>}
          </article>)}
        </section>;
      })}
    </div></div>
  </div>;
}
