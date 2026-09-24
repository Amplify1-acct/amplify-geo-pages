import { NextResponse } from "next/server";
import { publicClientProfile } from "@/lib/clients";
import { clientProfilesAsync } from "@/lib/client-store";
import { getGoogleAccessToken } from "@/lib/google";

export const dynamic = "force-dynamic";

export async function GET() {
  let accessToken: string | undefined;
  try {
    accessToken = await getGoogleAccessToken();
  } catch {
    // The public baseline remains available before Google is connected.
  }
  const clients = (await clientProfilesAsync(accessToken)).map(publicClientProfile);
  return NextResponse.json({
    configured: clients.length > 0,
    clients,
    reviewerEmail: "aron@amplifylaw.ai",
  });
}
