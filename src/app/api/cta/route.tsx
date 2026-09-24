import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { getClientProfile, normalizeClientProfile } from "@/lib/clients";
import {
  BILLY_CTA_HEIGHT,
  BILLY_CTA_VERSION,
  BILLY_CTA_WIDTH,
  ctaContact,
  isMotorVehiclePracticeArea,
  type CtaSlot,
} from "@/lib/cta";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const BILLY_LOCATION_BACKGROUNDS = [
  ["westchester county", "https://www.billycooperlaw.com/wp-content/uploads/2026/08/westchester-county-hero.png"],
  ["condado de westchester", "https://www.billycooperlaw.com/wp-content/uploads/2026/08/westchester-county-hero.png"],
  ["mount vernon", "https://www.billycooperlaw.com/wp-content/uploads/2026/08/04_Mount_Vernon_NY.png"],
  ["new rochelle", "https://www.billycooperlaw.com/wp-content/uploads/2026/08/03_New_Rochelle_NY.png"],
  ["greenburgh", "https://www.billycooperlaw.com/wp-content/uploads/2026/08/02_Greenburgh_NY.png"],
  ["yonkers", "https://www.billycooperlaw.com/wp-content/uploads/2026/08/01_Yonkers_NY.png"],
  ["bronx county", "https://www.billycooperlaw.com/wp-content/uploads/2026/08/15-bronx-county.png"],
  ["el bronx", "https://www.billycooperlaw.com/wp-content/uploads/2026/08/15-bronx-county.png"],
  ["co op city", "https://www.billycooperlaw.com/wp-content/uploads/2026/08/14-co-op-city-bronx.png"],
  ["kingsbridge", "https://www.billycooperlaw.com/wp-content/uploads/2026/08/13-kingsbridge-bronx.png"],
  ["soundview", "https://www.billycooperlaw.com/wp-content/uploads/2026/08/12-soundview-bronx.png"],
  ["riverdale", "https://www.billycooperlaw.com/wp-content/uploads/2026/08/11-riverdale-bronx.png"],
  ["fordham", "https://www.billycooperlaw.com/wp-content/uploads/2026/08/10-fordham-bronx.png"],
  ["rockland county", "https://www.billycooperlaw.com/wp-content/uploads/2026/08/21-rockland-county.png"],
  ["condado de rockland", "https://www.billycooperlaw.com/wp-content/uploads/2026/08/21-rockland-county.png"],
  ["spring valley", "https://www.billycooperlaw.com/wp-content/uploads/2026/08/16-spring-valley-rockland-county.png"],
  ["new city", "https://www.billycooperlaw.com/wp-content/uploads/2026/08/17-new-city-rockland-county.png"],
  ["haverstraw", "https://www.billycooperlaw.com/wp-content/uploads/2026/08/18-haverstraw-rockland-county.png"],
  ["clarkstown", "https://www.billycooperlaw.com/wp-content/uploads/2026/08/19-clarkstown-rockland-county.png"],
  ["ramapo", "https://www.billycooperlaw.com/wp-content/uploads/2026/08/20-ramapo-rockland-county.png"],
  ["queens county", "/geo-heroes/queens-county-ny-v2.jpg"],
  ["condado de queens", "/geo-heroes/queens-county-ny-v2.jpg"],
  ["manhattan", "/cta/manhattan-streetscape.jpg"],
  ["new york county", "/cta/manhattan-streetscape.jpg"],
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
  ["kings county", "https://www.billycooperlaw.com/wp-content/uploads/2026/08/09-kings-county-brooklyn.png"],
  ["condado de kings", "https://www.billycooperlaw.com/wp-content/uploads/2026/08/09-kings-county-brooklyn.png"],
  ["bedford stuyvesant", "https://www.billycooperlaw.com/wp-content/uploads/2026/08/08-bedford-stuyvesant-brooklyn.png"],
  ["bushwick", "https://www.billycooperlaw.com/wp-content/uploads/2026/08/07-bushwick-brooklyn-1.png"],
  ["crown heights", "https://www.billycooperlaw.com/wp-content/uploads/2026/08/02-crown-heights-brooklyn.png"],
  ["flatbush", "https://www.billycooperlaw.com/wp-content/uploads/2026/08/06-flatbush-brooklyn-1.png"],
  ["williamsburg", "https://www.billycooperlaw.com/wp-content/uploads/2026/08/03-williamsburg-brooklyn.png"],
  ["borough park", "https://www.billycooperlaw.com/wp-content/uploads/2026/08/05-borough-park-brooklyn.png"],
  ["bensonhurst", "https://www.billycooperlaw.com/wp-content/uploads/2026/08/04-bensonhurst-brooklyn.png"],
  ["sunset park", "https://www.billycooperlaw.com/wp-content/uploads/2026/08/01-sunset-park-brooklyn.png"],
  ["bay ridge", "https://www.billycooperlaw.com/wp-content/uploads/2026/08/05_Bay_Ridge_NY.png"],
  ["east new york", "https://www.billycooperlaw.com/wp-content/uploads/2026/08/06_East_New_York_NY.png"],
] as const;

function locationLabel(location: string) {
  const shortened = location.replace(/,?\s*(?:NY|New York)$/i, "").trim();
  return shortened || location.trim();
}

function locationBackground(location: string) {
  const normalized = location.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return BILLY_LOCATION_BACKGROUNDS.find(([name]) => normalized.includes(name))?.[1] || "";
}

function billyHeadline(slot: CtaSlot, location: string, practiceArea: string) {
  const place = locationLabel(location);
  const isPersonalInjury = /^personal injury$/i.test(practiceArea.trim());
  const isMotorVehicle = isMotorVehiclePracticeArea(practiceArea);

  if (slot === "middle") return `Questions About a ${place} Injury Claim?`;
  if (slot === "closing") return "Ready to Discuss What Happened?";
  if (isMotorVehicle) return `${practiceArea} in ${place}?`;
  if (isPersonalInjury) return `Injured in ${place}?`;
  return `Need Help With ${practiceArea} in ${place}?`;
}

function billySupportingMessage(slot: CtaSlot, practiceArea: string) {
  const isMotorVehicle = isMotorVehiclePracticeArea(practiceArea);
  if (slot === "middle") {
    return isMotorVehicle
      ? "A serious crash can raise questions about evidence, insurance, and filing deadlines. Get clear guidance before moving forward."
      : "A serious injury can raise questions about evidence, insurance, and filing deadlines. Get clear guidance before moving forward.";
  }
  if (slot === "closing") {
    return "Tell us what happened. Billy Cooper Law will listen, explain the issues, and help you understand your options.";
  }
  return isMotorVehicle
    ? "Get answers before speaking with an insurance company. Billy Cooper Law can investigate the crash, preserve evidence, and explain the deadlines that apply."
    : "Get answers before speaking with an insurance company. Billy Cooper Law can explain the evidence, deadlines, and next steps that may apply.";
}

function billySpanishHeadline(slot: CtaSlot, location: string) {
  const place = locationLabel(location);
  if (slot === "middle") return `¿Preguntas Sobre una Lesión en ${place}?`;
  if (slot === "closing") return "¿Listo Para Contarnos Qué Pasó?";
  return `¿Sufrió una Lesión en ${place}?`;
}

function billySpanishSupportingMessage(slot: CtaSlot) {
  if (slot === "middle") {
    return "Una lesión grave puede plantear preguntas sobre las pruebas, el seguro y los plazos. Obtenga orientación clara antes de seguir adelante.";
  }
  if (slot === "closing") {
    return "Cuéntenos qué pasó. Billy Cooper Law escuchará, explicará los asuntos importantes y le ayudará a entender sus opciones.";
  }
  return "Obtenga respuestas antes de hablar con una aseguradora. Billy Cooper Law puede explicarle las pruebas, los plazos y los próximos pasos.";
}

function genericHeadline(slot: CtaSlot, location: string, practiceArea: string) {
  const place = /^(?:your area|general)$/i.test(location.trim()) ? "" : ` in ${location}`;
  if (slot === "middle") return `Questions about a ${practiceArea.toLowerCase()} claim${place}?`;
  if (slot === "closing") return `Ready to discuss what happened${place}?`;
  return place ? `Injured${place}?` : "Injured?";
}

export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get("clientId") || "";
  const location = (request.nextUrl.searchParams.get("location") || "Your Area").slice(0, 90);
  const practiceArea = (request.nextUrl.searchParams.get("practiceArea") || "Your Legal Matter").slice(0, 100);
  const slotParam = request.nextUrl.searchParams.get("slot");
  const slot: CtaSlot = slotParam === "middle" || slotParam === "closing" ? slotParam : "opening";
  const locale = request.nextUrl.searchParams.get("lang") === "es" ? "es" : "en";
  const configuredClient = getClientProfile(clientId);
  const client = configuredClient || normalizeClientProfile({
    id: clientId,
    name: request.nextUrl.searchParams.get("clientName"),
    website: request.nextUrl.searchParams.get("website"),
    reviewerEmail: "aron@amplifylaw.ai",
    phoneDisplay: request.nextUrl.searchParams.get("phoneDisplay"),
    phoneHref: request.nextUrl.searchParams.get("phoneHref"),
    practiceAreas: [practiceArea],
    lawyers: request.nextUrl.searchParams.get("lawyerName") && request.nextUrl.searchParams.get("lawyerImageUrl") ? [{
      name: request.nextUrl.searchParams.get("lawyerName"),
      imageUrl: request.nextUrl.searchParams.get("lawyerImageUrl"),
    }] : [],
    brand: {
      primary: request.nextUrl.searchParams.get("primary"),
      secondary: request.nextUrl.searchParams.get("secondary"),
      accent: request.nextUrl.searchParams.get("accent"),
      surface: request.nextUrl.searchParams.get("surface"),
      logoUrl: request.nextUrl.searchParams.get("logoUrl"),
    },
    cta: {
      consultationText: request.nextUrl.searchParams.get("consultationText"),
      linkLabel: request.nextUrl.searchParams.get("linkLabel"),
    },
  });
  if (!client) return new Response("Client not found", { status: 404 });

  const contact = ctaContact(client, location);
  const isBilly = client.id === "billy-cooper-law";

  if (isBilly) {
    const primary = "#082536";
    const accent = "#e6c274";
    const backgroundPath = isMotorVehiclePracticeArea(practiceArea)
      ? "/cta/car-accident-background.jpg"
      : locationBackground(location);
    const backgroundUrl = backgroundPath
      ? new URL(backgroundPath, request.nextUrl.origin).toString()
      : "";
    const billyCutoutUrl = new URL("/cta/billy-cooper-cutout-v4.png", request.nextUrl.origin).toString();
    const serifFont = await fetch(
      new URL("/cta/BillySerif.otf", request.nextUrl.origin),
    ).then((response) => response.arrayBuffer());
    const sansFont = await fetch(
      new URL("/cta/BillySans.ttf", request.nextUrl.origin),
    ).then((response) => response.arrayBuffer());

    // Canonical Billy Cooper Law CTA. Keep this layout aligned with the approved
    // navy/gold card reference; page-specific inputs should change content only.
    return new ImageResponse(
      (
        <div
          style={{
            width: `${BILLY_CTA_WIDTH}px`,
            height: `${BILLY_CTA_HEIGHT}px`,
            display: "flex",
            position: "relative",
            overflow: "hidden",
            borderRadius: "30px",
            backgroundColor: primary,
            backgroundImage: backgroundUrl
              ? `linear-gradient(90deg, rgba(8,37,54,0.98) 0%, rgba(8,37,54,0.95) 48%, rgba(8,37,54,0.82) 72%, rgba(8,37,54,0.54) 100%), url("${backgroundUrl}")`
              : "linear-gradient(128deg, #082536 0%, #123b4d 68%, #07171f 100%)",
            backgroundSize: "cover",
            backgroundPosition: "center",
            color: "white",
            fontFamily: "Billy Sans",
          }}
        >
          <div style={{ width: "70%", padding: "90px 64px 58px 78px", display: "flex", flexDirection: "column", justifyContent: "flex-start", position: "relative" }}>
            <div style={{ display: "flex", textTransform: "uppercase", letterSpacing: "5px", fontSize: "24px", lineHeight: 1, color: accent, fontWeight: 800 }}>
              BILLY COOPER LAW
            </div>
            <div style={{ maxWidth: "740px", marginTop: "27px", fontFamily: "Billy Serif", fontSize: "66px", fontWeight: 400, lineHeight: 1.02, letterSpacing: "-2.8px" }}>
              {locale === "es" ? billySpanishHeadline(slot, location) : billyHeadline(slot, location, practiceArea)}
            </div>
            <div style={{ maxWidth: "620px", marginTop: "32px", fontSize: "26px", lineHeight: 1.48, color: "rgba(255,255,255,.94)" }}>
              {locale === "es" ? billySpanishSupportingMessage(slot) : billySupportingMessage(slot, practiceArea)}
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", marginTop: "38px" }}>
              <div style={{ display: "flex", padding: "19px 34px", borderRadius: "999px", background: accent, color: primary, fontSize: "27px", fontWeight: 900 }}>
                {locale === "es" ? `Llame al ${contact.display}` : `Call ${contact.display}`}
              </div>
              <div style={{ marginTop: "30px", color: "white", fontSize: "25px", fontWeight: 800, textDecoration: "underline", textUnderlineOffset: "8px" }}>
                {locale === "es" ? "Conozca los casos de lesiones personales" : `Learn about ${practiceArea.toLowerCase()} cases`}
              </div>
            </div>
          </div>
          <div style={{ width: "52%", height: "100%", display: "flex", alignItems: "flex-end", justifyContent: "flex-end", position: "absolute", right: "-20px", bottom: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={billyCutoutUrl} alt="Billy Cooper" width={575} height={620} style={{ width: "575px", height: "620px", objectFit: "contain", objectPosition: "bottom right" }} />
          </div>
        </div>
      ),
      {
        width: BILLY_CTA_WIDTH,
        height: BILLY_CTA_HEIGHT,
        headers: {
          "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
          "CDN-Cache-Control": "public, s-maxage=31536000, stale-while-revalidate=86400",
          "Vercel-CDN-Cache-Control": "public, s-maxage=31536000, stale-while-revalidate=86400",
          "X-Amplify-CTA-Style": BILLY_CTA_VERSION,
        },
        fonts: [
          { name: "Billy Serif", data: serifFont, weight: 400, style: "normal" },
          { name: "Billy Sans", data: sansFont, weight: 400, style: "normal" },
        ],
      },
    );
  }

  const lawyers = client.lawyers.slice(0, 2);
  return new ImageResponse(
    (
      <div style={{ width: "1200px", height: "420px", display: "flex", position: "relative", overflow: "hidden", borderRadius: "20px", background: `linear-gradient(120deg, ${client.brand.primary} 0%, ${client.brand.secondary} 78%, ${client.brand.primary} 100%)`, color: "white", fontFamily: "Arial, Helvetica, sans-serif" }}>
        <div style={{ width: lawyers.length ? "70%" : "100%", padding: "44px 56px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ display: "flex", textTransform: "uppercase", letterSpacing: "3px", fontSize: "17px", color: client.brand.accent, fontWeight: 700 }}>{client.name}</div>
          <div style={{ maxWidth: "735px", marginTop: "17px", fontSize: "40px", lineHeight: 1.04, fontWeight: 760, letterSpacing: "-1.2px" }}>{genericHeadline(slot, location, practiceArea)}</div>
          <div style={{ display: "flex", marginTop: "13px", color: "rgba(255,255,255,.82)", fontSize: "19px", fontWeight: 650 }}>{practiceArea} legal help</div>
          <div style={{ display: "flex", alignItems: "center", marginTop: "27px", gap: "24px" }}>
            <div style={{ display: "flex", padding: "13px 20px", borderRadius: "999px", background: client.brand.accent, color: client.brand.primary, fontWeight: 800, fontSize: "19px" }}>{`CALL ${contact.display.toUpperCase()}`}</div>
            <div style={{ fontSize: "18px", color: "rgba(255,255,255,.78)" }}>{client.cta.linkLabel || "Contact the firm"}</div>
          </div>
        </div>
        {lawyers.length > 0 && (
          <div style={{ width: "31%", height: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            {lawyers.map((lawyer, index) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={lawyer.imageUrl} src={lawyer.imageUrl} alt={lawyer.name} width={330} height={400} style={{ objectFit: "contain", objectPosition: "bottom center", marginLeft: index ? "-95px" : 0 }} />
            ))}
          </div>
        )}
      </div>
    ),
    { width: 1200, height: 420 },
  );
}
