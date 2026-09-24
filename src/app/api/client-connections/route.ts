import { NextRequest, NextResponse } from "next/server";
import {
  normalizeClientProfile,
  publicClientProfile,
  type ClientProfile,
} from "@/lib/clients";
import {
  clientProfilesAsync,
  saveClientProfiles,
} from "@/lib/client-store";
import { authorizedAmplifyUser } from "@/lib/permissions";
import { discoverClientIdentity } from "@/lib/client-site-discovery";

export const dynamic = "force-dynamic";

function sameClient(left: ClientProfile, right: ClientProfile) {
  const leftHost = new URL(left.website).hostname.replace(/^www\./, "").toLowerCase();
  const rightHost = new URL(right.website).hostname.replace(/^www\./, "").toLowerCase();
  return left.id === right.id || leftHost === rightHost;
}

function messageStatus(message: string) {
  return /not allowed/i.test(message)
    ? 403
    : /not configured|not connected|reconnect|expired/i.test(message)
      ? 401
      : 500;
}

export async function GET() {
  try {
    const { accessToken, email } = await authorizedAmplifyUser();
    const profiles = await clientProfilesAsync(accessToken);
    return NextResponse.json({
      ok: true,
      email,
      storage: "Encrypted Google Drive app data",
      clients: profiles.map(publicClientProfile),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Client connections could not be loaded.";
    return NextResponse.json({ error: message }, { status: messageStatus(message) });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { accessToken } = await authorizedAmplifyUser();
    const input = await request.json() as Record<string, unknown>;
    const current = await clientProfilesAsync(accessToken);
    const inputId = typeof input.id === "string" ? input.id.trim().toLowerCase() : "";
    const inputWebsite = typeof input.website === "string" ? input.website.trim() : "";
    let inputHost = "";
    try {
      inputHost = new URL(inputWebsite).hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      // Normalization below returns a useful validation error.
    }
    const existing = current.find((profile) =>
      profile.id === inputId || (inputHost && new URL(profile.website).hostname.replace(/^www\./, "").toLowerCase() === inputHost),
    );
    let discovery: Awaited<ReturnType<typeof discoverClientIdentity>> | null = null;
    const refreshWebsiteIdentity = input.refreshWebsiteIdentity === true;
    if ((!existing || refreshWebsiteIdentity) && inputWebsite) {
      try {
        discovery = await discoverClientIdentity(inputWebsite);
      } catch {
        // The user can still save a manually completed profile when a site blocks inspection.
      }
    }
    const wordpressInput = input.wordpress && typeof input.wordpress === "object"
      ? input.wordpress as Record<string, unknown>
      : undefined;
    const applicationPassword = typeof wordpressInput?.applicationPassword === "string"
      ? wordpressInput.applicationPassword.replace(/\s+/g, "")
      : "";
    const suppliedBrand = input.brand && typeof input.brand === "object"
      ? input.brand as Record<string, unknown>
      : {};
    const starterBrand = suppliedBrand.primary === "#151515"
      && suppliedBrand.secondary === "#353535"
      && suppliedBrand.accent === "#d2b052"
      && suppliedBrand.surface === "#f7f7f7";
    const suppliedCta = input.cta && typeof input.cta === "object"
      ? input.cta as Record<string, unknown>
      : {};
    const suppliedPracticeAreas = Array.isArray(input.practiceAreas)
      ? input.practiceAreas.filter((value): value is string => typeof value === "string")
      : [];
    const suppliedPracticeAreaUrls = input.practiceAreaUrls && typeof input.practiceAreaUrls === "object" && !Array.isArray(input.practiceAreaUrls)
      ? input.practiceAreaUrls as Record<string, unknown>
      : {};
    const candidate = {
      ...input,
      name: typeof input.name === "string" && input.name.trim() ? input.name : discovery?.name,
      phoneDisplay: typeof input.phoneDisplay === "string" && input.phoneDisplay.trim()
        ? input.phoneDisplay
        : discovery?.phoneDisplay,
      phoneHref: typeof input.phoneHref === "string" && input.phoneHref.trim()
        ? input.phoneHref
        : discovery?.phoneHref,
      contactUrl: typeof input.contactUrl === "string" && input.contactUrl.trim()
        ? input.contactUrl
        : discovery?.contactUrl,
      jurisdictions: Array.isArray(input.jurisdictions) && input.jurisdictions.length
        ? input.jurisdictions
        : discovery?.jurisdictions,
      practiceAreas: [...suppliedPracticeAreas, ...(discovery?.practiceAreas || [])],
      practiceAreaUrls: {
        ...(discovery?.practiceAreaUrls || {}),
        ...suppliedPracticeAreaUrls,
      },
      brand: {
        ...(starterBrand ? discovery?.brand : suppliedBrand),
        logoUrl: typeof suppliedBrand.logoUrl === "string" && suppliedBrand.logoUrl.trim()
          ? suppliedBrand.logoUrl
          : discovery?.brand?.logoUrl,
      },
      cta: {
        consultationText: typeof suppliedCta.consultationText === "string" && suppliedCta.consultationText.trim()
          ? suppliedCta.consultationText
          : discovery?.cta?.consultationText,
        linkLabel: typeof suppliedCta.linkLabel === "string" && suppliedCta.linkLabel.trim()
          ? suppliedCta.linkLabel
          : discovery?.cta?.linkLabel,
      },
      wordpress: wordpressInput ? {
        ...wordpressInput,
        applicationPassword: applicationPassword || existing?.wordpress?.applicationPassword || "",
      } : undefined,
    };
    const normalized = normalizeClientProfile(candidate);
    if (!normalized) {
      return NextResponse.json({ error: "Client name, HTTPS website, and a valid client profile are required." }, { status: 400 });
    }
    if (wordpressInput && !normalized.wordpress) {
      return NextResponse.json({
        error: "WordPress needs an HTTPS site URL, username, and Application Password.",
      }, { status: 400 });
    }
    const next = existing
      ? current.map((profile) => sameClient(profile, existing) ? normalized : profile)
      : [...current, normalized];
    await saveClientProfiles(accessToken, next);
    return NextResponse.json({
      ok: true,
      client: publicClientProfile(normalized),
      websiteIdentityImported: Boolean(discovery),
      practiceAreaCount: normalized.practiceAreas.length,
      practiceAreaUrlCount: Object.keys(normalized.practiceAreaUrls).length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The client connection could not be saved.";
    return NextResponse.json({ error: message }, { status: messageStatus(message) });
  }
}
