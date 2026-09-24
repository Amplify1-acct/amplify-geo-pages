import { NextRequest, NextResponse } from "next/server";
import { getGoogleAccessToken } from "@/lib/google";
import { prepareApprovedGoogleDoc } from "@/lib/google-doc-content";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    const docId = request.nextUrl.searchParams.get("docId")?.trim() || "";
    const fallbackTitle =
      request.nextUrl.searchParams.get("fallbackTitle")?.trim().slice(0, 300) || "New GEO page";
    if (!/^[A-Za-z0-9_-]{10,200}$/.test(docId)) {
      return NextResponse.json({ error: "The approved Google Doc is missing." }, { status: 400 });
    }

    const accessToken = await getGoogleAccessToken();
    const preview = await prepareApprovedGoogleDoc(accessToken, docId, fallbackTitle);
    return NextResponse.json(preview);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The page preview could not be prepared.";
    const status = /not connected|reconnect|expired/i.test(message)
      ? 401
      : /AMPLIFY FAQ standard/i.test(message)
        ? 422
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
