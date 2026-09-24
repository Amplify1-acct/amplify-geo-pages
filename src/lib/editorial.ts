export type EditorialCadence = "weekly" | "biweekly" | "monthly";

export type EditorialSchedule = {
  id: string;
  clientId: string;
  clientName: string;
  website: string;
  enabled: boolean;
  cadence: EditorialCadence;
  weekday: number;
  dayOfMonth: number;
  publishHour: number;
  timezone: string;
  leadDays: number;
  practiceAreas: string[];
  jurisdiction: string;
  candidateCount: number;
  anchorDate: string;
  createdAt: string;
  updatedAt: string;
};

export type EditorialCandidate = {
  id: string;
  question: string;
  practiceArea?: string;
  cluster: string;
  sourceTerm: string;
  depth: number;
  score: number;
  answerExcerpt?: string;
  answerUrl?: string;
};

export type EditorialSlotStatus =
  | "topic_selection"
  | "selected"
  | "drafting"
  | "review"
  | "wordpress_draft"
  | "scheduled"
  | "published"
  | "skipped"
  | "error";

export type EditorialSlot = {
  id: string;
  scheduleId: string;
  clientId: string;
  clientName: string;
  website: string;
  practiceArea: string;
  practiceAreas?: string[];
  jurisdiction: string;
  publishAt: string;
  topicSelectionDueAt: string;
  status: EditorialSlotStatus;
  candidates: EditorialCandidate[];
  selectedCandidateId?: string;
  selectedTopic?: string;
  selectedAt?: string;
  contentRecordId?: string;
  generationJobId?: string;
  generationState?: "running" | "failed" | "completed";
  generationCheckedAt?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function daysBetween(left: string, right: string) {
  const leftDate = Date.parse(`${left}T00:00:00Z`);
  const rightDate = Date.parse(`${right}T00:00:00Z`);
  return Math.floor((rightDate - leftDate) / 86_400_000);
}

function timezoneParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function localDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  timezone: string,
) {
  const target = Date.UTC(year, month - 1, day, hour, 0, 0);
  let guess = target;
  for (let iteration = 0; iteration < 2; iteration += 1) {
    const parts = timezoneParts(new Date(guess), timezone);
    const represented = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    guess += target - represented;
  }
  return new Date(guess);
}

function isPublishDay(schedule: EditorialSchedule, date: Date) {
  const key = dateKey(date);
  if (schedule.cadence === "monthly") return date.getUTCDate() === schedule.dayOfMonth;
  if (date.getUTCDay() !== schedule.weekday) return false;
  if (schedule.cadence === "weekly") return true;
  const elapsedWeeks = Math.floor(daysBetween(schedule.anchorDate, key) / 7);
  return elapsedWeeks >= 0 && elapsedWeeks % 2 === 0;
}

export function upcomingPublishDates(
  schedule: EditorialSchedule,
  from = new Date(),
  horizonDays = 60,
) {
  const dates: Date[] = [];
  const start = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  for (let offset = 0; offset <= horizonDays; offset += 1) {
    const candidate = new Date(start.getTime() + (offset * 86_400_000));
    if (!isPublishDay(schedule, candidate)) continue;
    dates.push(localDateTimeToUtc(
      candidate.getUTCFullYear(),
      candidate.getUTCMonth() + 1,
      candidate.getUTCDate(),
      schedule.publishHour,
      schedule.timezone,
    ));
  }
  return dates;
}

export function editorialSlotId(scheduleId: string, publishAt: Date) {
  return `${scheduleId}:${dateKey(publishAt)}`;
}

export function topicSelectionDueAt(publishAt: Date, leadDays: number) {
  return new Date(publishAt.getTime() - (Math.max(3, leadDays) * 86_400_000));
}

export function normalizeEditorialQuestion(value: string) {
  return value
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function questionSimilarity(left: string, right: string) {
  const leftWords = new Set(normalizeEditorialQuestion(left).split(" ").filter(Boolean));
  const rightWords = new Set(normalizeEditorialQuestion(right).split(" ").filter(Boolean));
  if (!leftWords.size || !rightWords.size) return 0;
  const intersection = [...leftWords].filter((word) => rightWords.has(word)).length;
  const union = new Set([...leftWords, ...rightWords]).size;
  return intersection / union;
}

export const EDITORIAL_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "Pacific/Honolulu",
] as const;
