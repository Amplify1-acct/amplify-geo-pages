import { userActionRoute } from "../../../../lib/ai-control.mjs";
import { NextRequest, NextResponse } from "next/server";
import { generateClientBlogQuestions } from "@/lib/blog-topic-questions";
import { getClientProfileAsync } from "@/lib/client-store";
import { getGoogleAccessToken } from "@/lib/google";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function handlePOST(request: NextRequest) {
  const startedAt = Date.now();
  try {
    const input = await request.json() as {
      clientId?: string;
      practiceArea?: string;
      jurisdiction?: string;
      previousTopics?: string[];
      fresh?: boolean;
    };
    const accessToken = await getGoogleAccessToken();
    const client = await getClientProfileAsync(input.clientId, undefined, accessToken);
    if (!client) {
      return NextResponse.json({ error: "Choose a configured client first." }, { status: 400 });
    }
    const result = await generateClientBlogQuestions({
      client,
      practiceAreas: [input.practiceArea || ""],
      jurisdiction: input.jurisdiction,
      previousTopics: Array.isArray(input.previousTopics) ? input.previousTopics : [],
      count: 18,
      fresh: input.fresh,
    });
    console.info("[blog-topics] ChatGPT question generation complete", {
      clientId: client.id,
      practiceArea: result.practiceAreas[0],
      durationMs: Date.now() - startedAt,
      questionCount: result.questions.length,
      model: result.model,
    });
    return NextResponse.json({
      ok: true,
      clientId: client.id,
      clientName: client.name,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "ChatGPT topic generation failed.";
    const status = /not configured/i.test(message) ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export const POST = userActionRoute("Generate blog topic questions", handlePOST);
