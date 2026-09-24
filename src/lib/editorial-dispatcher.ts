import { createHash } from "node:crypto";
import {
  generateClientBlogQuestions,
  type BlogTopicQuestion,
} from "@/lib/blog-topic-questions";
import {
  editorialSlotId,
  normalizeEditorialQuestion,
  questionSimilarity,
  topicSelectionDueAt,
  upcomingPublishDates,
  type EditorialCandidate,
  type EditorialSchedule,
  type EditorialSlot,
} from "@/lib/editorial";
import {
  getEditorialSchedule,
  listEditorialSchedules,
  listEditorialSlots,
  saveEditorialSlot,
} from "@/lib/editorial-store";

function candidateId(question: string, practiceArea: string) {
  return createHash("sha256")
    .update(`${normalizeEditorialQuestion(practiceArea)}:${normalizeEditorialQuestion(question)}`)
    .digest("hex")
    .slice(0, 18);
}

function candidateScore(question: { question: string; depth: number; answerExcerpt?: string }) {
  const length = question.question.length;
  let score = question.depth === 1 ? 100 : question.depth === 2 ? 80 : 65;
  if (length >= 35 && length <= 105) score += 16;
  if (/^(how|what|when|who|can|do|does|is|are|should|why)\b/i.test(question.question)) score += 8;
  if (question.answerExcerpt) score += 4;
  if (length > 150) score -= 20;
  return score;
}

function selectCandidates(
  questions: BlogTopicQuestion[],
  previousTopics: string[],
  practiceAreas: string[],
  limit: number,
) {
  const selected: EditorialCandidate[] = [];
  const byArea = new Map(practiceAreas.map((area) => [area, questions
    .filter((question) => question.practiceArea === area)
    .sort((left, right) => candidateScore(right) - candidateScore(left))]));
  const cursors = new Map(practiceAreas.map((area) => [area, 0]));
  const target = Math.max(limit, practiceAreas.length);

  while (selected.length < target) {
    let added = false;
    for (const practiceArea of practiceAreas) {
      const areaQuestions = byArea.get(practiceArea) || [];
      let cursor = cursors.get(practiceArea) || 0;
      while (cursor < areaQuestions.length) {
        const question = areaQuestions[cursor];
        cursor += 1;
        cursors.set(practiceArea, cursor);
        if (previousTopics.some((topic) => questionSimilarity(topic, question.question) >= 0.68)) continue;
        if (selected.some((candidate) => questionSimilarity(candidate.question, question.question) >= 0.76)) continue;
        selected.push({
          id: candidateId(question.question, practiceArea),
          question: question.question,
          practiceArea,
          cluster: question.cluster,
          sourceTerm: question.sourceTerm,
          depth: question.depth,
          score: candidateScore(question),
          answerExcerpt: question.answerExcerpt,
          answerUrl: question.answerUrl,
        });
        added = true;
        break;
      }
      if (selected.length >= target) break;
    }
    if (!added) break;
  }
  return selected;
}

async function researchPracticeAreas(options: {
  clientId: string;
  clientName: string;
  website: string;
  practiceAreas: string[];
  jurisdiction: string;
  previousTopics: string[];
  candidateCount: number;
  fresh?: boolean;
}) {
  const result = await generateClientBlogQuestions({
    client: {
      id: options.clientId,
      name: options.clientName,
      website: options.website,
      practiceAreas: options.practiceAreas,
      jurisdictions: options.jurisdiction ? [options.jurisdiction] : [],
    },
    practiceAreas: options.practiceAreas,
    jurisdiction: options.jurisdiction,
    previousTopics: options.previousTopics,
    count: Math.max(18, options.candidateCount * 3),
    fresh: options.fresh,
  });
  return result.questions;
}

export async function createNextEditorialSlot(
  schedule: EditorialSchedule,
  options: { now?: Date; force?: boolean; fresh?: boolean } = {},
) {
  const now = options.now || new Date();
  const allSlots = await listEditorialSlots();
  const publishDates = upcomingPublishDates(schedule, now, 75);
  const publishAt = publishDates.find((date) => {
    const id = editorialSlotId(schedule.id, date);
    if (allSlots.some((slot) => slot.id === id)) return false;
    return options.force || topicSelectionDueAt(date, schedule.leadDays).getTime() <= now.getTime() + 86_400_000;
  });
  if (!publishAt) return null;
  const practiceAreas = schedule.practiceAreas.filter(Boolean);
  if (!practiceAreas.length) throw new Error(`${schedule.clientName} needs at least one practice area in its editorial schedule.`);
  const previousTopics = allSlots
    .filter((slot) => slot.clientId === schedule.clientId)
    .flatMap((slot) => [slot.selectedTopic || "", ...slot.candidates.map((candidate) => candidate.question)])
    .filter(Boolean);
  const timestamp = now.toISOString();
  const slot: EditorialSlot = {
    id: editorialSlotId(schedule.id, publishAt),
    scheduleId: schedule.id,
    clientId: schedule.clientId,
    clientName: schedule.clientName,
    website: schedule.website,
    practiceArea: practiceAreas[0],
    practiceAreas,
    jurisdiction: schedule.jurisdiction,
    publishAt: publishAt.toISOString(),
    topicSelectionDueAt: topicSelectionDueAt(publishAt, schedule.leadDays).toISOString(),
    status: "topic_selection",
    candidates: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  try {
    const questions = await researchPracticeAreas({
      clientId: schedule.clientId,
      clientName: schedule.clientName,
      website: schedule.website,
      practiceAreas,
      jurisdiction: schedule.jurisdiction,
      previousTopics,
      candidateCount: schedule.candidateCount,
      fresh: options.fresh,
    });
    slot.candidates = selectCandidates(questions, previousTopics, practiceAreas, schedule.candidateCount);
    if (!slot.candidates.length) throw new Error("ChatGPT did not return enough distinct questions for this slot.");
  } catch (error) {
    slot.status = "error";
    slot.error = error instanceof Error ? error.message : "Topic research failed.";
  }
  await saveEditorialSlot(slot);
  return slot;
}

export async function refreshEditorialSlotCandidates(slot: EditorialSlot) {
  const schedule = await getEditorialSchedule(slot.scheduleId);
  if (!schedule) throw new Error("The editorial schedule for this slot no longer exists.");
  const allSlots = await listEditorialSlots();
  const previousTopics = allSlots
    .filter((candidate) => candidate.clientId === slot.clientId && candidate.id !== slot.id)
    .flatMap((candidate) => [candidate.selectedTopic || "", ...candidate.candidates.map((item) => item.question)])
    .filter(Boolean);
  const practiceAreas = schedule.practiceAreas.filter(Boolean);
  const questions = await researchPracticeAreas({
    clientId: schedule.clientId,
    clientName: schedule.clientName,
    website: schedule.website,
    practiceAreas,
    jurisdiction: schedule.jurisdiction,
    previousTopics,
    candidateCount: schedule.candidateCount,
    fresh: true,
  });
  const candidates = selectCandidates(questions, previousTopics, practiceAreas, schedule.candidateCount);
  if (!candidates.length) throw new Error("ChatGPT did not return enough new questions for this slot.");
  return saveEditorialSlot({
    ...slot,
    candidates,
    practiceAreas,
    practiceArea: practiceAreas[0],
    selectedCandidateId: undefined,
    selectedTopic: undefined,
    selectedAt: undefined,
    status: "topic_selection",
    error: undefined,
    updatedAt: new Date().toISOString(),
  });
}

export async function runEditorialDispatcher(options: {
  scheduleId?: string;
  force?: boolean;
  fresh?: boolean;
} = {}) {
  const schedules = options.scheduleId
    ? [await getEditorialSchedule(options.scheduleId)].filter((schedule): schedule is EditorialSchedule => Boolean(schedule))
    : (await listEditorialSchedules()).filter((schedule) => schedule.enabled);
  const created: EditorialSlot[] = [];
  const errors: Array<{ scheduleId: string; error: string }> = [];
  for (const schedule of schedules) {
    try {
      const slot = await createNextEditorialSlot(schedule, options);
      if (slot?.status === "error") {
        errors.push({ scheduleId: schedule.id, error: slot.error || "Topic research failed." });
      } else if (slot) {
        created.push(slot);
      }
    } catch (error) {
      errors.push({
        scheduleId: schedule.id,
        error: error instanceof Error ? error.message : "The editorial slot could not be created.",
      });
    }
  }
  return { created, errors, checked: schedules.length };
}
