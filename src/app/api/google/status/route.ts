import { NextResponse } from "next/server";
import {
  getGoogleAccessToken,
  getGoogleEmail,
  googleConfigured,
} from "@/lib/google";

export const dynamic = "force-dynamic";

export async function GET() {
  const configured = googleConfigured();
  const openaiConfigured = Boolean(process.env.OPENAI_API_KEY);

  if (!configured) {
    return NextResponse.json({ configured, openaiConfigured, connected: false });
  }

  try {
    const accessToken = await getGoogleAccessToken();
    const email = await getGoogleEmail(accessToken);
    return NextResponse.json({
      configured,
      openaiConfigured,
      connected: true,
      email,
    });
  } catch {
    return NextResponse.json({ configured, openaiConfigured, connected: false });
  }
}

