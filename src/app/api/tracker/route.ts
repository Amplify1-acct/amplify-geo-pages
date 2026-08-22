import { NextRequest, NextResponse } from "next/server";
import { getGoogleAccessToken } from "@/lib/google";

export const dynamic = "force-dynamic";

const TRACKER_NAME = "amplify-geo-pages.json";

type DriveFile = { id: string; modifiedTime?: string };

async function findTrackerFile(accessToken: string): Promise<DriveFile | null> {
  const params = new URLSearchParams({
    spaces: "appDataFolder",
    q: `name = '${TRACKER_NAME}' and trashed = false`,
    fields: "files(id,modifiedTime)",
    orderBy: "modifiedTime desc",
    pageSize: "1",
  });
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const data = (await response.json()) as {
    files?: DriveFile[];
    error?: { message?: string };
  };
  if (!response.ok) throw new Error(data.error?.message || "The tracker could not be opened.");
  return data.files?.[0] || null;
}

export async function GET() {
  try {
    const accessToken = await getGoogleAccessToken();
    const file = await findTrackerFile(accessToken);
    if (!file) return NextResponse.json({ records: [] });

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      },
    );
    if (!response.ok) throw new Error("The tracker could not be read.");
    const records = await response.json();
    return NextResponse.json({ records: Array.isArray(records) ? records : [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The tracker could not be loaded.";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const records = await request.json();
    if (!Array.isArray(records) || records.length > 5000) {
      return NextResponse.json({ error: "Invalid tracker data." }, { status: 400 });
    }

    const accessToken = await getGoogleAccessToken();
    const file = await findTrackerFile(accessToken);
    const content = JSON.stringify(records);

    if (file) {
      const response = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${file.id}?uploadType=media`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: content,
        },
      );
      if (!response.ok) throw new Error("The tracker could not be saved.");
    } else {
      const form = new FormData();
      form.append(
        "metadata",
        new Blob(
          [JSON.stringify({ name: TRACKER_NAME, parents: ["appDataFolder"] })],
          { type: "application/json" },
        ),
      );
      form.append("file", new Blob([content], { type: "application/json" }), TRACKER_NAME);
      const response = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
          body: form,
        },
      );
      if (!response.ok) throw new Error("The tracker could not be created.");
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The tracker could not be saved.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
