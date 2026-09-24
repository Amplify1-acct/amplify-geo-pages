import { after, NextRequest, NextResponse } from "next/server";
import { getGoogleAccessToken, getGoogleEmail } from "@/lib/google";
import { getClientProfileAsync } from "@/lib/client-store";
import { getWordPressConfigAsync } from "@/lib/wordpress";
import { getPublicationJob, queuePublicationLinks, runPublicationLinks } from "@/lib/post-publication-worker";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
async function auth() {
  const token = await getGoogleAccessToken(), email = await getGoogleEmail(token);
  if (!email || !(process.env.WORDPRESS_ALLOWED_GOOGLE_EMAILS || "accounts@amplifylaw.ai").split(",").map(s=>s.trim().toLowerCase()).includes(email.toLowerCase())) throw new Error("Publisher access is required.");
  return token;
}
export async function GET(request: NextRequest) {
  try {
    await auth();
    return NextResponse.json({ job: await getPublicationJob(request.nextUrl.searchParams.get("clientId") || "", Number(request.nextUrl.searchParams.get("pageId")), request.nextUrl.searchParams.get("endpoint") === "posts" ? "posts" : "pages") });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Status unavailable." }, { status: 400 }); }
}
export async function POST(request: NextRequest) {
  try {
    const token = await auth();
    const input = await request.json() as { clientId?: string; pageId?: number; workflow?: string; reset?: boolean };
    if (!Number.isInteger(input.pageId) || Number(input.pageId) <= 0) throw new Error("A published WordPress page ID is required.");
    const client = await getClientProfileAsync(input.clientId, undefined, token);
    if (!client) throw new Error("Client not found.");
    const config = await getWordPressConfigAsync(client.id, undefined, token);
    const job = await queuePublicationLinks(config, { pageId: input.pageId!, workflow: input.workflow, practiceAreaUrls: client.practiceAreaUrls, reset: input.reset });
    after(() => runPublicationLinks(job.id));
    return NextResponse.json({ job }, { status: 202 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Link reconciliation could not be queued." }, { status: 400 }); }
}
