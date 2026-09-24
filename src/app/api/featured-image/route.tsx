import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { getClientProfile, normalizeClientProfile } from "@/lib/clients";
import { ctaContact, isMotorVehiclePracticeArea } from "@/lib/cta";

export const runtime = "edge";

const BILLY_LOCATION_HEROES = [
  ["harlem", "/generated/featured/harlem-personal-injury-banner-photo-v2.png"],
  ["washington heights", "/generated/featured/washington-heights-personal-injury-banner-photo-v1.png"],
  ["upper west side", "/generated/featured/upper-west-side-personal-injury-banner-photo-v2.png"],
  ["upper east side", "/generated/featured/upper-east-side-personal-injury-featured.jpg"],
  ["new york county", "/generated/featured/manhattan-personal-injury-featured.jpg"],
  ["manhattan", "/generated/featured/manhattan-personal-injury-featured.jpg"],
  ["south ozone park", "/queens-city-heroes/south-ozone-park.jpg"],
  ["flushing willets point", "/queens-city-heroes/flushing-willets-point.jpg"],
  ["willets point", "/queens-city-heroes/flushing-willets-point.jpg"],
  ["murray hill", "/queens-city-heroes/murray-hill-broadway-flushing.jpg"],
  ["queens village", "/queens-city-heroes/queens-village.jpg"],
  ["jackson heights", "/queens-city-heroes/jackson-heights.jpg"],
  ["forest hills", "/queens-city-heroes/forest-hills.jpg"],
  ["ridgewood", "/queens-city-heroes/ridgewood.jpg"],
  ["elmhurst", "/queens-city-heroes/elmhurst.jpg"],
  ["corona", "/queens-city-heroes/corona.jpg"],
  ["jamaica", "/queens-city-heroes/jamaica.jpg"],
  ["flushing", "/queens-city-heroes/flushing-willets-point.jpg"],
] as const;

function billyLocationHero(location: string) {
  const normalized = location.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const match = BILLY_LOCATION_HEROES.find(([name]) => normalized.includes(name));
  return match?.[1] || "";
}

export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get("clientId") || "";
  const location = (request.nextUrl.searchParams.get("location") || "Local").slice(0, 90);
  const practiceArea = (request.nextUrl.searchParams.get("practiceArea") || "Legal Services").slice(0, 100);
  const client = getClientProfile(clientId) || normalizeClientProfile({
    id: clientId,
    name: request.nextUrl.searchParams.get("clientName"),
    website: request.nextUrl.searchParams.get("website"),
    reviewerEmail: "aron@amplifylaw.ai",
    phoneDisplay: request.nextUrl.searchParams.get("phoneDisplay"),
    phoneHref: request.nextUrl.searchParams.get("phoneHref"),
    practiceAreas: [practiceArea],
    brand: {
      primary: request.nextUrl.searchParams.get("primary"),
      secondary: request.nextUrl.searchParams.get("secondary"),
      accent: request.nextUrl.searchParams.get("accent"),
      surface: request.nextUrl.searchParams.get("surface"),
    },
  });
  if (!client) return new Response("Client not found", { status: 404 });

  const isBilly = client.id === "billy-cooper-law";
  if (isBilly) {
    const locationHero = billyLocationHero(location);
    const backgroundPath = locationHero || (isMotorVehiclePracticeArea(practiceArea)
      ? "/cta/car-accident-background.jpg"
      : "/generated/featured/manhattan-personal-injury-featured.jpg");
    const backgroundUrl = new URL(backgroundPath, request.nextUrl.origin).toString();
    return new ImageResponse(
      (
        <div style={{ width: "1200px", height: "800px", display: "flex", position: "relative", overflow: "hidden", background: "#082536" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={backgroundUrl} alt="" width={1200} height={800} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }} />
        </div>
      ),
      { width: 1200, height: 800 },
    );
  }

  const contact = ctaContact(client, location);
  const primary = isBilly ? "#082536" : client.brand.primary;
  const secondary = isBilly ? "#164052" : client.brand.secondary;
  const accent = isBilly ? "#dfbd72" : client.brand.accent;
  const locationHero = isBilly ? billyLocationHero(location) : "";
  const backgroundPath = locationHero || (isBilly && isMotorVehiclePracticeArea(practiceArea)
    ? "/cta/car-accident-background.jpg"
    : "");
  const backgroundUrl = backgroundPath
    ? new URL(backgroundPath, request.nextUrl.origin).toString()
    : "";
  const billyCutoutUrl = new URL("/cta/billy-cooper-cutout-v4.png", request.nextUrl.origin).toString();

  return new ImageResponse(
    (
      <div style={{ width: "1200px", height: "630px", display: "flex", position: "relative", overflow: "hidden", background: primary, color: "white", fontFamily: "Arial, Helvetica, sans-serif" }}>
        {backgroundUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={backgroundUrl} alt="" width={1200} height={630} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        )}
        <div style={{ position: "absolute", inset: 0, display: "flex", background: backgroundUrl ? "linear-gradient(90deg, #082536 0%, rgba(8,37,54,.93) 56%, rgba(8,37,54,.42) 100%)" : `linear-gradient(135deg, ${primary} 0%, ${secondary} 62%, ${accent} 180%)` }} />
        <div style={{ position: "absolute", width: "760px", height: "760px", right: "-210px", top: "-210px", borderRadius: "50%", border: "2px solid rgba(255,255,255,.18)", display: "flex" }} />
        <div style={{ position: "absolute", width: "520px", height: "520px", right: "-90px", top: "-85px", borderRadius: "50%", border: "2px solid rgba(255,255,255,.13)", display: "flex" }} />
        <div style={{ position: "absolute", left: "70px", right: "70px", top: "70px", bottom: "70px", border: "1px solid rgba(255,255,255,.18)", display: "flex" }} />
        <div style={{ padding: "92px 96px", display: "flex", flexDirection: "column", justifyContent: "space-between", position: "relative", width: isBilly ? "76%" : "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px", textTransform: "uppercase", letterSpacing: "5px", fontSize: "21px", color: accent, fontWeight: 800 }}>
            {client.name}<span style={{ color: "rgba(255,255,255,.45)" }}>•</span>Local Legal Guide
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: "68px", lineHeight: 1, fontWeight: 800, letterSpacing: "-3px", maxWidth: "790px" }}>{location}</div>
            <div style={{ fontSize: "37px", lineHeight: 1.15, marginTop: "22px", color: "rgba(255,255,255,.84)", maxWidth: "780px" }}>{practiceArea}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "18px", fontSize: "21px" }}>
            <span style={{ width: "74px", height: "5px", background: accent, display: "flex" }} />
            {isBilly ? `Free consultation: ${contact.display}` : `Clear guidance for people in ${location}`}
          </div>
        </div>
        {isBilly && (
          <div style={{ width: "34%", height: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center", position: "absolute", right: 0, bottom: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={billyCutoutUrl} alt="Billy Cooper" width={420} height={610} style={{ width: "420px", height: "610px", objectFit: "contain", objectPosition: "bottom center" }} />
          </div>
        )}
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
