import {
  clientProfiles,
  getClientProfile,
  normalizeClientProfile,
  type ClientProfile,
} from "@/lib/clients";
import { decryptToken, encryptToken } from "@/lib/google";

const STORE_NAME = "amplify-client-connections-v1.enc";

type StoredClientPayload = {
  version: 1;
  updatedAt: string;
  profiles: unknown[];
};

function host(profile: ClientProfile) {
  return new URL(profile.website).hostname.replace(/^www\./, "").toLowerCase();
}

function mergeProfiles(base: ClientProfile[], stored: ClientProfile[]) {
  const merged = [...base];
  for (const profile of stored) {
    const index = merged.findIndex((candidate) =>
      candidate.id === profile.id || host(candidate) === host(profile),
    );
    if (index === -1) merged.push(profile);
    else merged[index] = profile;
  }
  return merged;
}

async function appDataFileId(accessToken: string) {
  const params = new URLSearchParams({
    spaces: "appDataFolder",
    q: `name = '${STORE_NAME}' and trashed = false`,
    fields: "files(id,name,modifiedTime)",
    pageSize: "10",
  });
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json() as {
      files?: Array<{ id?: string; modifiedTime?: string }>;
      error?: { message?: string };
    };
    if (!response.ok) {
      if ([429,500,502,503,504].includes(response.status) && attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
        continue;
      }
      throw new Error(`Google Drive could not load the saved client connection (HTTP ${response.status}): ${data.error?.message || "service unavailable"}. The draft has not been published.`);
    }
    return [...(data.files || [])]
      .sort((a, b) => (b.modifiedTime || "").localeCompare(a.modifiedTime || ""))[0]?.id || null;
  }
  throw new Error("Google Drive could not load the saved client connection after three attempts.");
}

async function storedProfiles(accessToken: string) {
  const fileId = await appDataFileId(accessToken);
  if (!fileId) return [];
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" },
  );
  if (!response.ok) throw new Error("The encrypted AMPLIFY client store could not be downloaded.");
  const encrypted = (await response.text()).trim();
  if (!encrypted) return [];
  let payload: StoredClientPayload;
  try {
    payload = JSON.parse(decryptToken(encrypted)) as StoredClientPayload;
  } catch {
    throw new Error("The AMPLIFY client store could not be decrypted. Check GOOGLE_TOKEN_SECRET.");
  }
  if (payload.version !== 1 || !Array.isArray(payload.profiles)) {
    throw new Error("The AMPLIFY client store uses an unsupported format.");
  }
  return payload.profiles
    .map((profile, index) => normalizeClientProfile(profile, index))
    .filter((profile): profile is ClientProfile => Boolean(profile));
}

export async function clientProfilesAsync(accessToken?: string) {
  const baseline = clientProfiles();
  if (!accessToken) return baseline;
  const stored = await storedProfiles(accessToken);
  return mergeProfiles(baseline, stored);
}

export async function getClientProfileAsync(
  clientId?: string,
  website?: string,
  accessToken?: string,
) {
  if (!accessToken) return getClientProfile(clientId, website);
  const profiles = await clientProfilesAsync(accessToken);
  const requestedId = clientId?.trim().toLowerCase();
  let requestedHost = "";
  if (website) {
    try {
      requestedHost = new URL(website).hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      return null;
    }
  }
  if (requestedId) {
    const exact = profiles.find((profile) => profile.id === requestedId);
    if (exact && (!requestedHost || host(exact) === requestedHost)) return exact;
    return null;
  }
  if (requestedHost) return profiles.find((profile) => host(profile) === requestedHost) || null;
  return profiles.length === 1 ? profiles[0] : null;
}

export async function saveClientProfiles(accessToken: string, profiles: ClientProfile[]) {
  const payload: StoredClientPayload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    profiles,
  };
  const encrypted = encryptToken(JSON.stringify(payload));
  let fileId = await appDataFileId(accessToken);
  if (!fileId) {
    const create = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: STORE_NAME,
        mimeType: "application/octet-stream",
        parents: ["appDataFolder"],
      }),
      cache: "no-store",
    });
    const created = await create.json() as { id?: string; error?: { message?: string } };
    if (!create.ok || !created.id) {
      throw new Error(created.error?.message || "The AMPLIFY client store could not be created.");
    }
    fileId = created.id;
  }
  const upload = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=media`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/octet-stream",
      },
      body: encrypted,
      cache: "no-store",
    },
  );
  if (!upload.ok) {
    const error = await upload.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(error.error?.message || "The AMPLIFY client store could not be saved.");
  }
}
