import {publicationHistory} from "@/lib/publication-history";
import { refreshAronWordPressStatuses } from "@/lib/aron-wordpress-status";
import { after, NextRequest, NextResponse } from "next/server";
import {
  aronReviewStoreConfigured,
  listAronReviewItems,
  mergeAronApprovals,
  syncAronReviewQueue,
} from "@/lib/aron-review-queue";
import { cookies } from "next/headers";
import { isAronReviewer } from "@/lib/aron-review-queue";
import { recoverWordPressUploads } from "@/lib/wordpress-upload-recovery";
import { uploadRedis, uploadLease, publicUploadJobs } from "@/lib/wordpress-upload-store";
import { getGoogleAccessToken, getGoogleEmail, GOOGLE_REFRESH_COOKIE } from "@/lib/google";

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

export async function GET(request: NextRequest) {
  try {
    const accessToken = await getGoogleAccessToken();
    const file = await findTrackerFile(accessToken);
    const history = request?.nextUrl.searchParams.get("view") === "published";
    if (history && !isAronReviewer(await getGoogleEmail(accessToken))) {
      return NextResponse.json({error:"Publication history requires an approved AMPLIFY account."},{status:403});
    }
    if (!file) return NextResponse.json({ records: history && aronReviewStoreConfigured() ? publicationHistory([], await listAronReviewItems(true)) : [] });

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      },
    );
    if (!response.ok) throw new Error("The tracker could not be read.");
    const records = await response.json();
    const deletedIds = aronReviewStoreConfigured()
      ? Object.keys(await uploadRedis().hgetall(`amplify:tracker-deleted:v1:${file.id}`) || {}) : [];
    const deleted = new Set(deletedIds);
    const privateRecords = Array.isArray(records) ? records.filter(record => !deleted.has(record.id)) : [];
    let wordpressStatusErrors = new Map<string, string>();
    if (aronReviewStoreConfigured()) {
      // Pages and blogs share the same live status source; stale tracker labels
      // must not resurrect completed pages in the preparation queue.
      wordpressStatusErrors = await refreshAronWordPressStatuses(
        await listAronReviewItems(true), accessToken,
      );
    }
    const mergedRecords = aronReviewStoreConfigured()
      ? await mergeAronApprovals(privateRecords)
      : privateRecords;

    // Rebuild the shared Aron queue from the authoritative tracker whenever the
    // dashboard loads. This makes the queue self-healing without allowing an
    // empty per-account tracker to delete shared review items.
    if (aronReviewStoreConfigured()) {
      await syncAronReviewQueue(mergedRecords);
      const email = await getGoogleEmail(accessToken);
      const credential = (await cookies()).get(GOOGLE_REFRESH_COOKIE)?.value;
      if (email && credential && isAronReviewer(email)) {
        after(async () => {
          // Keep concurrent dashboard loads from running overlapping recovery.
          const release = await uploadLease(`recovery:${email}`);
          if (!release) return;
          try { await recoverWordPressUploads(accessToken, email, credential); }
          finally { await release(); }
        });
      }
    }
    if (history) return NextResponse.json({records:publicationHistory(mergedRecords, aronReviewStoreConfigured() ? await listAronReviewItems(true) : [])}, {headers:{"Cache-Control":"private, no-store"}});
    const jobs = aronReviewStoreConfigured() ? await publicUploadJobs(mergedRecords.map((r: {id?:string})=>r.id).filter((id:unknown):id is string=>typeof id === "string")) : new Map();
    return NextResponse.json({ records: mergedRecords.map((r: {id?:string})=>({...r,upload:r.id?jobs.get(r.id):undefined,wordpressStatusError:r.id?wordpressStatusErrors.get(r.id):undefined})), deletedIds });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The tracker could not be loaded.";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const inputRecords = await request.json();
    if (!Array.isArray(inputRecords) || inputRecords.length > 5000) {
      return NextResponse.json({ error: "Invalid tracker data." }, { status: 400 });
    }

    const accessToken = await getGoogleAccessToken();
    const file = await findTrackerFile(accessToken);
    const deletedIds = file && aronReviewStoreConfigured()
      ? Object.keys(await uploadRedis().hgetall(`amplify:tracker-deleted:v1:${file.id}`) || {}) : [];
    const deleted = new Set(deletedIds);
    const activeRecords = inputRecords.filter(record => !deleted.has(record.id));
    const records = aronReviewStoreConfigured()
      ? await mergeAronApprovals(activeRecords)
      : activeRecords;
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

    if (aronReviewStoreConfigured()) await syncAronReviewQueue(records);
    return NextResponse.json({ ok: true, records });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The tracker could not be saved.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// A per-tracker deletion marker prevents another device's old cache restoring it.
export async function DELETE(request: NextRequest) {
  try {
    const accessToken = await getGoogleAccessToken();
    const file = await findTrackerFile(accessToken);
    const input = await request.json();
    const ids = Array.isArray(input.ids) ? [...new Set(input.ids)] : [];
    if (!file || !ids.length || ids.length > 500 || ids.some(id => typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,200}$/.test(id))) {
      return NextResponse.json({ error: "Choose saved tracker records to remove." }, { status: 400 });
    }
    await uploadRedis().hset(`amplify:tracker-deleted:v1:${file.id}`,
      Object.fromEntries(ids.map(id => [String(id), new Date().toISOString()])));
    return NextResponse.json({ ok: true, deletedIds: ids });
  } catch {
    return NextResponse.json({ error: "The dashboard deletion could not be saved. Reconnect Google and try again." }, { status: 500 });
  }
}
