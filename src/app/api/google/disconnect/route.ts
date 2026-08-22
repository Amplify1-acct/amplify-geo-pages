import { NextResponse } from "next/server";
import { GOOGLE_REFRESH_COOKIE } from "@/lib/google";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(GOOGLE_REFRESH_COOKIE);
  return response;
}
