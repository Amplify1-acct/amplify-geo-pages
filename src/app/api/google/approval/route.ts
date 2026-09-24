import { NextRequest, NextResponse } from "next/server";
import { getGoogleAccessToken } from "@/lib/google";

export const dynamic = "force-dynamic";

type GoogleError = {
  error?: { message?: string };
};

type DriveApproval = {
  approvalId?: string;
  createTime?: string;
  status?: string;
};

function validDocId(docId: string) {
  return /^[A-Za-z0-9_-]{10,200}$/.test(docId);
}

function latestApproval(items: DriveApproval[] = []) {
  return [...items].sort((a, b) =>
    (b.createTime || "").localeCompare(a.createTime || ""),
  )[0];
}

function approvalPayload(approval: DriveApproval) {
  return {
    supported: true,
    approvalId: approval.approvalId,
    status: approval.status || "IN_PROGRESS",
  };
}

async function verifyAmplifyDoc(accessToken: string, docId: string) {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${docId}?fields=id,mimeType,trashed,appProperties&supportsAllDrives=true`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    },
  );
  const file = (await response.json()) as GoogleError & {
    mimeType?: string;
    trashed?: boolean;
    appProperties?: Record<string, string>;
  };

  if (!response.ok) {
    throw new Error(file.error?.message || "The Google Doc could not be opened.");
  }
  if (
    file.trashed ||
    file.mimeType !== "application/vnd.google-apps.document" ||
    !file.appProperties?.amplifyResponseId
  ) {
    throw new Error("Only a Google Doc created by this app can use this approval workflow.");
  }
}

async function listApprovals(accessToken: string, docId: string) {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${docId}/approvals?pageSize=100`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    },
  );
  if (!response.ok) return { supported: false as const };
  const data = (await response.json()) as { items?: DriveApproval[] };
  return { supported: true as const, approval: latestApproval(data.items) };
}

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Approval status could not be checked.";
  const status = /not connected|reconnect|expired|authorized/i.test(message) ? 401 : 500;
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const docId = request.nextUrl.searchParams.get("docId")?.trim() || "";
    if (!validDocId(docId)) {
      return NextResponse.json({ error: "That Google Doc is not valid." }, { status: 400 });
    }

    const accessToken = await getGoogleAccessToken();
    await verifyAmplifyDoc(accessToken, docId);
    const result = await listApprovals(accessToken, docId);
    if (!result.supported || !result.approval?.approvalId) {
      return NextResponse.json({ supported: false });
    }
    return NextResponse.json(approvalPayload(result.approval));
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const input = (await request.json()) as { docId?: string };
    const docId = input.docId?.trim() || "";
    if (!validDocId(docId)) {
      return NextResponse.json({ error: "That Google Doc is not valid." }, { status: 400 });
    }

    const accessToken = await getGoogleAccessToken();
    const headers = { Authorization: `Bearer ${accessToken}` };
    await verifyAmplifyDoc(accessToken, docId);

    const listed = await listApprovals(accessToken, docId);
    if (listed.supported && listed.approval?.approvalId) {
      return NextResponse.json(approvalPayload(listed.approval));
    }

    const capabilityResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${docId}?fields=capabilities(canStartApproval)&supportsAllDrives=true`,
      { headers, cache: "no-store" },
    );
    const capability = (await capabilityResponse.json()) as GoogleError & {
      capabilities?: { canStartApproval?: boolean };
    };
    if (!capabilityResponse.ok) {
      throw new Error(capability.error?.message || "Google approval capability could not be checked.");
    }
    if (!capability.capabilities?.canStartApproval) {
      return NextResponse.json({ supported: false });
    }

    const startResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${docId}/approvals:start`,
      {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewerEmails: ["aron@amplifylaw.ai"],
          lockFile: false,
          message:
            "Please edit this geo page, then approve it when it is ready for the final page preview.",
          fileContentChangeBehavior: "RESET_APPROVAL",
        }),
      },
    );
    const approval = (await startResponse.json()) as DriveApproval & GoogleError;
    if (!startResponse.ok) {
      if (startResponse.status === 403) return NextResponse.json({ supported: false });
      throw new Error(approval.error?.message || "The approval request could not be started.");
    }
    return NextResponse.json(approvalPayload(approval));
  } catch (error) {
    return routeError(error);
  }
}
