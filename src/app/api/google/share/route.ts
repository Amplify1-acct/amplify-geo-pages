import { NextRequest, NextResponse } from "next/server";
import { getGoogleAccessToken } from "@/lib/google";

export const dynamic = "force-dynamic";

const HANDOFF_RECIPIENTS = ["will@amplifylaw.ai", "abigail@amplifylaw.ai"] as const;

type GoogleError = {
  error?: { message?: string };
};

type Permission = {
  id?: string;
  emailAddress?: string;
  role?: string;
  type?: string;
};

function driveError(value: unknown, fallback: string) {
  const error = value as GoogleError;
  return error.error?.message || fallback;
}

export async function POST(request: NextRequest) {
  try {
    const input = (await request.json()) as { docId?: string };
    const docId = input.docId?.trim() || "";

    if (!/^[A-Za-z0-9_-]{10,200}$/.test(docId)) {
      return NextResponse.json({ error: "That Google Doc is not valid." }, { status: 400 });
    }

    const accessToken = await getGoogleAccessToken();
    const headers = { Authorization: `Bearer ${accessToken}` };
    const fileResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${docId}?fields=id,mimeType,trashed,appProperties&supportsAllDrives=true`,
      { headers, cache: "no-store" },
    );
    const file = (await fileResponse.json()) as GoogleError & {
      mimeType?: string;
      trashed?: boolean;
      appProperties?: Record<string, string>;
    };

    if (!fileResponse.ok) {
      throw new Error(driveError(file, "The Google Doc could not be opened."));
    }

    if (
      file.trashed ||
      file.mimeType !== "application/vnd.google-apps.document" ||
      !file.appProperties?.amplifyResponseId
    ) {
      return NextResponse.json(
        { error: "Only a Google Doc created by this app can be shared." },
        { status: 400 },
      );
    }

    const permissionsResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${docId}/permissions?fields=permissions(id,emailAddress,role,type)&supportsAllDrives=true`,
      { headers, cache: "no-store" },
    );
    const permissionsData = (await permissionsResponse.json()) as GoogleError & {
      permissions?: Permission[];
    };

    if (!permissionsResponse.ok) {
      throw new Error(
        driveError(permissionsData, "The document permissions could not be checked."),
      );
    }

    const emailMessage = encodeURIComponent(
      "Aron's edits are complete. This AMPLIFY page is approved and ready for your review.",
    );
    const shareResults = [];

    for (const emailAddress of HANDOFF_RECIPIENTS) {
      const existing = permissionsData.permissions?.find(
        (permission) => permission.emailAddress?.toLowerCase() === emailAddress,
      );

      if (existing?.role === "writer" || existing?.role === "owner") {
        shareResults.push({ emailAddress, alreadyShared: true });
        continue;
      }

      const permissionUrl = existing?.id
        ? `https://www.googleapis.com/drive/v3/files/${docId}/permissions/${existing.id}?supportsAllDrives=true`
        : `https://www.googleapis.com/drive/v3/files/${docId}/permissions?sendNotificationEmail=true&emailMessage=${emailMessage}&supportsAllDrives=true`;
      const shareResponse = await fetch(permissionUrl, {
        method: existing?.id ? "PATCH" : "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          existing?.id
            ? { role: "writer" }
            : { type: "user", role: "writer", emailAddress },
        ),
      });
      const shareData = (await shareResponse.json()) as GoogleError;

      if (!shareResponse.ok) {
        throw new Error(
          driveError(shareData, `The Google Doc could not be shared with ${emailAddress}.`),
        );
      }

      shareResults.push({ emailAddress, alreadyShared: false });
    }

    return NextResponse.json({
      shared: true,
      alreadyShared: shareResults.every((result) => result.alreadyShared),
      sharedWith: HANDOFF_RECIPIENTS,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "The Google Doc could not be shared with Will and Abigail.";
    const status = /not connected|reconnect|expired|authorized/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
