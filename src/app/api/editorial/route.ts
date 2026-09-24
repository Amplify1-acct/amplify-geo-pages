import { userActionRoute } from "../../../lib/ai-control.mjs";
import { aiFetch } from "../../../lib/ai-control.mjs";
import { isStorageLimitError, STORAGE_LIMIT_MESSAGE } from "@/lib/storage-error";
import OpenAI from 'openai';
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getClientProfileAsync } from "@/lib/client-store";
import {
  editorialSlotId,
  EDITORIAL_TIMEZONES,
  topicSelectionDueAt,
  upcomingPublishDates,
  type EditorialCadence,
  type EditorialSchedule,
  type EditorialSlot,
  type EditorialSlotStatus,
} from "@/lib/editorial";
import {
  deleteEditorialSchedule,
  deleteEditorialSlot,
  editorialStoreConfigured,
  getEditorialSlot,
  listEditorialSchedules,
  listEditorialSlots,
  saveEditorialSchedule,
  saveEditorialSlot,
} from "@/lib/editorial-store";
import { refreshEditorialSlotCandidates, runEditorialDispatcher } from "@/lib/editorial-dispatcher";
import { getGoogleAccessToken, getGoogleEmail } from "@/lib/google";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

function allowedEditor(email: string | null) {
  if (!email) return false;
  return (process.env.WORDPRESS_ALLOWED_GOOGLE_EMAILS || "accounts@amplifylaw.ai")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}

async function authenticatedAccessToken() {
  const accessToken = await getGoogleAccessToken();
  const email = await getGoogleEmail(accessToken);
  if (!allowedEditor(email)) throw new Error("This Google account is not allowed to manage editorial schedules.");
  return accessToken;
}

function cleanInteger(value: unknown, minimum: number, maximum: number, fallback: number) {
  const number = Number(value);
  return Number.isInteger(number) && number >= minimum && number <= maximum ? number : fallback;
}

function cleanString(value: unknown, maximum = 200) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maximum) : "";
}

export async function GET() {
  try {
    await authenticatedAccessToken();
    if (!editorialStoreConfigured()) {
      return NextResponse.json({ configured: false, schedules: [], slots: [] });
    }
    const [schedules, slots] = await Promise.all([
      listEditorialSchedules(),
      listEditorialSlots(),
    ]);
    return NextResponse.json({
      configured: true,
      schedules,
      slots,
      needsDecision: slots.filter((slot) => slot.status === "topic_selection").length,
    });
  } catch (error) {
    if (isStorageLimitError(error)) return NextResponse.json(
      { error: STORAGE_LIMIT_MESSAGE, code: "STORAGE_LIMIT" },
      { status: 503, headers: { "Retry-After": "300", "Cache-Control": "no-store" } },
    );
    return NextResponse.json({
      error: error instanceof Error ? error.message : "The editorial calendar could not be loaded.",
    }, { status: 401 });
  }
}

async function handlePOST(request: NextRequest) {
  try {
    const accessToken = await authenticatedAccessToken();
    if (!editorialStoreConfigured()) {
      return NextResponse.json({
        error: "Editorial scheduling storage is not connected. Add an Upstash Redis integration to this Vercel project.",
      }, { status: 503 });
    }
    const input = await request.json() as Record<string, unknown>;
    const action = cleanString(input.action, 60);
    if (action === "save_schedule") {
      const clientId = cleanString(input.clientId, 100);
      const client = await getClientProfileAsync(clientId, undefined, accessToken);
      if (!client) return NextResponse.json({ error: "Choose a configured client." }, { status: 400 });
      const cadence = (["weekly", "biweekly", "monthly"] as EditorialCadence[]).includes(input.cadence as EditorialCadence)
        ? input.cadence as EditorialCadence
        : "biweekly";
      const timezone = EDITORIAL_TIMEZONES.includes(input.timezone as typeof EDITORIAL_TIMEZONES[number])
        ? input.timezone as string
        : "America/New_York";
      const allowedAreas = new Map(client.practiceAreas.map((area) => [area.toLowerCase(), area]));
      const practiceAreas = (Array.isArray(input.practiceAreas) ? input.practiceAreas : [])
        .map((area) => cleanString(area, 140))
        .map((area) => allowedAreas.get(area.toLowerCase()) || "")
        .filter((area, index, areas) => Boolean(area) && areas.indexOf(area) === index)
        .slice(0, 20);
      if (!practiceAreas.length) {
        return NextResponse.json({ error: "Choose at least one verified client practice area." }, { status: 400 });
      }
      const now = new Date().toISOString();
      const id = cleanString(input.id, 120) || `editorial-${client.id}-${randomUUID().slice(0, 8)}`;
      const existing = (await listEditorialSchedules()).find((schedule) => schedule.id === id);
      const schedule: EditorialSchedule = {
        id,
        clientId: client.id,
        clientName: client.name,
        website: client.website,
        enabled: input.enabled !== false,
        cadence,
        weekday: cleanInteger(input.weekday, 0, 6, 2),
        dayOfMonth: cleanInteger(input.dayOfMonth, 1, 28, 15),
        publishHour: cleanInteger(input.publishHour, 0, 23, 9),
        timezone,
        leadDays: cleanInteger(input.leadDays, 5, 30, 10),
        practiceAreas,
        jurisdiction: cleanString(input.jurisdiction, 160)
          || client.blogDefaults.defaultJurisdiction
          || client.jurisdictions[0]
          || "",
        candidateCount: cleanInteger(input.candidateCount, 4, 12, 8),
        anchorDate: existing?.anchorDate || new Date().toISOString().slice(0, 10),
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };
      await saveEditorialSchedule(schedule);
      return NextResponse.json({ ok: true, schedule });
    }

    if (action === "delete_schedule") {
      const scheduleId = cleanString(input.scheduleId, 120);
      if (!scheduleId) return NextResponse.json({ error: "The schedule is missing." }, { status: 400 });
      const slots = await listEditorialSlots();
      await Promise.all(slots
        .filter((slot) => slot.scheduleId === scheduleId && !["scheduled", "published"].includes(slot.status))
        .map((slot) => deleteEditorialSlot(slot.id)));
      await deleteEditorialSchedule(scheduleId);
      return NextResponse.json({ ok: true });
    }

    if (action === "generate_now") {
      const scheduleId = cleanString(input.scheduleId, 120);
      const result = await runEditorialDispatcher({ scheduleId, force: true, fresh: input.fresh === true });
      if (result.errors.length) {
        return NextResponse.json({
          ok: false,
          ...result,
          error: result.errors[0].error,
        }, { status: 502 });
      }
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === "assign_existing_content") {
      const clientId = cleanString(input.clientId, 100);
      const contentRecordId = cleanString(input.contentRecordId, 100);
      const selectedTopic = cleanString(input.selectedTopic, 240);
      const practiceArea = cleanString(input.practiceArea, 140);
      if (!clientId || !contentRecordId || selectedTopic.length < 10) {
        return NextResponse.json({ error: "The client, approved blog, or blog title is missing." }, { status: 400 });
      }
      const schedules = (await listEditorialSchedules())
        .filter((schedule) => schedule.enabled && schedule.clientId === clientId);
      const schedule = schedules[0];
      if (!schedule) {
        return NextResponse.json({ error: "Create an active editorial schedule for this client first." }, { status: 409 });
      }
      const now = new Date();
      const slots = await listEditorialSlots();
      const existingForContent = slots.find((slot) => slot.contentRecordId === contentRecordId);
      if (existingForContent) {
        return NextResponse.json({ ok: true, slot: existingForContent, reused: true });
      }
      const reusable = slots
        .filter((slot) =>
          slot.scheduleId === schedule.id
          && !slot.contentRecordId
          && ["topic_selection", "selected", "error"].includes(slot.status)
          && new Date(slot.publishAt).getTime() > now.getTime() + 60_000)
        .sort((left, right) => left.publishAt.localeCompare(right.publishAt))[0];
      const publishAt = reusable
        ? new Date(reusable.publishAt)
        : upcomingPublishDates(schedule, now, 90).find((date) =>
            date.getTime() > now.getTime() + 60_000
            && !slots.some((slot) => slot.id === editorialSlotId(schedule.id, date)),
          );
      if (!publishAt) {
        return NextResponse.json({ error: "No open publishing date was found in this client’s schedule." }, { status: 409 });
      }
      const timestamp = now.toISOString();
      const slot: EditorialSlot = {
        ...(reusable || {
          id: editorialSlotId(schedule.id, publishAt),
          scheduleId: schedule.id,
          clientId: schedule.clientId,
          clientName: schedule.clientName,
          website: schedule.website,
          jurisdiction: schedule.jurisdiction,
          publishAt: publishAt.toISOString(),
          topicSelectionDueAt: topicSelectionDueAt(publishAt, schedule.leadDays).toISOString(),
          candidates: [],
          createdAt: timestamp,
        }),
        practiceArea: practiceArea || reusable?.practiceArea || schedule.practiceAreas[0] || "Blog",
        practiceAreas: schedule.practiceAreas,
        selectedCandidateId: undefined,
        selectedTopic,
        selectedAt: timestamp,
        contentRecordId,
        status: "wordpress_draft",
        error: undefined,
        updatedAt: timestamp,
      };
      await saveEditorialSlot(slot);
      return NextResponse.json({ ok: true, slot });
    }

    const slotId = cleanString(input.slotId, 180);
    const slot = slotId ? await getEditorialSlot(slotId) : null;
    if (!slot) return NextResponse.json({ error: "The editorial slot was not found." }, { status: 404 });

    if (["select_topic", "refresh_candidates"].includes(action) && slot.selectedTopic) {
      return NextResponse.json({ error: "This topic is already selected. Continue its existing writing job." }, { status: 409 });
    }
    if (action === "select_topic") {
      const candidateId = cleanString(input.candidateId, 80);
      const customTopic = cleanString(input.customTopic, 240);
      const candidate = slot.candidates.find((item) => item.id === candidateId);
      const selectedTopic = customTopic || candidate?.question || "";
      if (selectedTopic.length < 10) {
        return NextResponse.json({ error: "Choose a suggested question or enter a specific blog topic." }, { status: 400 });
      }
      const updated = await saveEditorialSlot({
        ...slot,
        practiceArea: candidate?.practiceArea || slot.practiceArea,
        selectedCandidateId: candidate?.id,
        selectedTopic,
        selectedAt: new Date().toISOString(),
        status: "selected",
        error: undefined,
        updatedAt: new Date().toISOString(),
      });
      return NextResponse.json({ ok: true, slot: updated });
    }

    if (action === "refresh_candidates") {
      const updated = await refreshEditorialSlotCandidates(slot);
      return NextResponse.json({ ok: true, slot: updated });
    }

    if (action === "skip_slot") {
      const updated = await saveEditorialSlot({
        ...slot,
        status: "skipped",
        updatedAt: new Date().toISOString(),
      });
      return NextResponse.json({ ok: true, slot: updated });
    }

    if (action === "link_content") {
      const contentRecordId = cleanString(input.contentRecordId, 100);
      const generationJobId = cleanString(input.generationJobId, 200);
      if (!contentRecordId) return NextResponse.json({ error: "The content record is missing." }, { status: 400 });
      if (!generationJobId) return NextResponse.json({error:"A saved writing job is required."},{status:400});
      const job=await new OpenAI({ fetch: aiFetch, maxRetries: 0, apiKey:process.env.OPENAI_API_KEY}).responses.retrieve(generationJobId);
      if(job.metadata?.client_id!==slot.clientId || job.metadata?.workflow!=="blog" || (job.metadata?.editorial_slot_id && job.metadata.editorial_slot_id!==slot.id))return NextResponse.json({error:"The writing job does not belong to this calendar client and brief."},{status:409});
      const updated = await saveEditorialSlot({
        ...slot,
        generationState: "running",
        generationCheckedAt: new Date().toISOString(),
        error: undefined,
        contentRecordId,
        generationJobId: generationJobId || undefined,
        status: "drafting",
        updatedAt: new Date().toISOString(),
      });
      return NextResponse.json({ ok: true, slot: updated });
    }

    if (action === "sync_status") {
      const allowed: EditorialSlotStatus[] = ["drafting", "review", "wordpress_draft", "scheduled", "published", "error"];
      const status = allowed.includes(input.status as EditorialSlotStatus)
        ? input.status as EditorialSlotStatus
        : slot.status;
      const updated = await saveEditorialSlot({ ...slot, status, error: status === "error" ? cleanString(input.error, 2000) || "Drafting needs attention." : undefined, updatedAt: new Date().toISOString() });
      return NextResponse.json({ ok: true, slot: updated });
    }

    return NextResponse.json({ error: "Unknown editorial action." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The editorial calendar could not be updated.";
    const status = /not allowed|connect Google|refresh token/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export const POST = userActionRoute("Manage editorial topics", handlePOST);
