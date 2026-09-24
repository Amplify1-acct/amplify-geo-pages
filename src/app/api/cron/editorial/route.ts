import { NextRequest, NextResponse } from "next/server";
import { editorialStoreConfigured } from "@/lib/editorial-store";


export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!editorialStoreConfigured()) {
    return NextResponse.json({ error: "Editorial storage is not configured." }, { status: 503 });
  }
  return NextResponse.json({ ok: true, status: "awaiting-user-action", message: "Use Generate now in the editorial calendar to research topics." });
}
