import { Redis } from "@upstash/redis";
import type { EditorialSchedule, EditorialSlot } from "@/lib/editorial";

const SCHEDULES_KEY = "amplify:editorial:schedules:v1";
const SLOTS_KEY = "amplify:editorial:slots:v1";

function redisCredentials() {
  return {
    url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "",
    token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "",
  };
}

export function editorialStoreConfigured() {
  const credentials = redisCredentials();
  return Boolean(credentials.url && credentials.token);
}

function editorialRedis() {
  const credentials = redisCredentials();
  if (!credentials.url || !credentials.token) {
    throw new Error("Editorial scheduling storage is not connected. Add an Upstash Redis integration to this Vercel project.");
  }
  return new Redis({ url: credentials.url, token: credentials.token });
}

function decodeStored<T>(value: unknown): T | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
  return typeof value === "object" ? value as T : null;
}

async function hashValues<T>(key: string) {
  const stored = await editorialRedis().hgetall<Record<string, unknown>>(key);
  return Object.values(stored || {})
    .map((value) => decodeStored<T>(value))
    .filter((value): value is T => Boolean(value));
}

export async function listEditorialSchedules() {
  return (await hashValues<EditorialSchedule>(SCHEDULES_KEY))
    .sort((a, b) => a.clientName.localeCompare(b.clientName));
}

export async function getEditorialSchedule(id: string) {
  return decodeStored<EditorialSchedule>(await editorialRedis().hget(SCHEDULES_KEY, id));
}

export async function saveEditorialSchedule(schedule: EditorialSchedule) {
  await editorialRedis().hset(SCHEDULES_KEY, { [schedule.id]: JSON.stringify(schedule) });
  return schedule;
}

export async function deleteEditorialSchedule(id: string) {
  await editorialRedis().hdel(SCHEDULES_KEY, id);
}

export async function listEditorialSlots() {
  return (await hashValues<EditorialSlot>(SLOTS_KEY))
    .sort((a, b) => a.publishAt.localeCompare(b.publishAt));
}

export async function getEditorialSlot(id: string) {
  return decodeStored<EditorialSlot>(await editorialRedis().hget(SLOTS_KEY, id));
}

export async function saveEditorialSlot(slot: EditorialSlot) {
  await editorialRedis().hset(SLOTS_KEY, { [slot.id]: JSON.stringify(slot) });
  return slot;
}

export async function deleteEditorialSlot(id: string) {
  await editorialRedis().hdel(SLOTS_KEY, id);
}
