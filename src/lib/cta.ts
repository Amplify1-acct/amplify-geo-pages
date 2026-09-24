import type { ClientProfile } from "@/lib/clients";

export type CtaSlot = "opening" | "middle" | "closing";
export type CtaLocale = "en" | "es";

export const BILLY_CTA_WIDTH = 1200;
export const BILLY_CTA_HEIGHT = 800;
export const BILLY_CTA_VERSION = "billy-card-v4-html-r2";
export const CLIENT_CTA_VERSION = "amplify-client-cta-v4-verified-contact";
export const FULGINITI_CTA_VERSION = "fulginiti-card-v4-grammar";

export type CtaContact = {
  display: string;
  href: string;
};

const BILLY_NYC_PHONE: CtaContact = {
  display: "(718) 866-3311",
  href: "+17188663311",
};

const BILLY_WESTCHESTER_PHONE: CtaContact = {
  display: "(914) 730-5789",
  href: "+19147305789",
};

const BILLY_LOCATION_BACKGROUNDS = [
  ["midtown manhattan", "https://www.billycooperlaw.com/wp-content/uploads/2026/08/amplify-midtown-manhattan-ny-personal-injury-local-ai-banner-v6-visual-brief-reviewed-jpeg.jpg"],
  ["washington heights", "https://www.billycooperlaw.com/wp-content/uploads/2026/08/amplify-washington-heights-ny-personal-injury-local-ai-banner-v6-visual-brief-reviewed-jpeg.jpg"],
  ["upper west side", "https://www.billycooperlaw.com/wp-content/uploads/2026/08/amplify-upper-west-side-ny-personal-injury-local-ai-banner-v6-visual-brief-reviewed-jpeg.jpg"],
  ["upper east side", "https://www.billycooperlaw.com/wp-content/uploads/2026/08/amplify-upper-east-side-ny-personal-injury-local-ai-banner-v6-visual-brief-reviewed-jpeg.jpg"],
  ["new york county", "https://www.billycooperlaw.com/wp-content/uploads/2026/08/amplify-new-york-county-ny-personal-injury-local-ai-banner-v6-visual-brief-reviewed-jpeg.jpg"],
  ["harlem", "https://www.billycooperlaw.com/wp-content/uploads/2026/08/amplify-harlem-ny-personal-injury-local-ai-banner-v6-visual-brief-reviewed-jpeg.jpg"],
  ["manhattan", "https://www.billycooperlaw.com/wp-content/uploads/2026/08/amplify-manhattan-ny-personal-injury-local-ai-banner-v6-visual-brief-reviewed-jpeg.jpg"],
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
  ["queens county", "https://www.billycooperlaw.com/wp-content/uploads/2026/08/queens-county-ny-v2.jpg"],
  ["condado de queens", "https://www.billycooperlaw.com/wp-content/uploads/2026/08/queens-county-ny-v2.jpg"],
  ["south ozone park", "https://www.billycooperlaw.com/wp-content/uploads/2026/08/south-ozone-park.jpg"],
  ["flushing willets point", "https://www.billycooperlaw.com/wp-content/uploads/2026/08/flushing-willets-point-1.jpg"],
  ["willets point", "https://www.billycooperlaw.com/wp-content/uploads/2026/08/flushing-willets-point-1.jpg"],
  ["murray hill", "https://www.billycooperlaw.com/wp-content/uploads/2026/08/murray-hill-broadway-flushing.jpg"],
  ["queens village", "https://www.billycooperlaw.com/wp-content/uploads/2026/08/queens-village.jpg"],
  ["jackson heights", "https://www.billycooperlaw.com/wp-content/uploads/2026/08/jackson-heights.jpg"],
  ["forest hills", "https://www.billycooperlaw.com/wp-content/uploads/2026/08/forest-hills.jpg"],
  ["ridgewood", "https://www.billycooperlaw.com/wp-content/uploads/2026/08/ridgewood.jpg"],
  ["elmhurst", "https://www.billycooperlaw.com/wp-content/uploads/2026/08/elmhurst.jpg"],
  ["corona", "https://www.billycooperlaw.com/wp-content/uploads/2026/08/corona.jpg"],
  ["jamaica", "https://www.billycooperlaw.com/wp-content/uploads/2026/08/jamaica.jpg"],
  ["flushing", "https://www.billycooperlaw.com/wp-content/uploads/2026/08/flushing-willets-point-1.jpg"],
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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function isBillyNycLocation(location: string) {
  return /\b(?:bronx|brooklyn|queens|manhattan|staten island|kings county|new york county|richmond county|new york city|nyc|upper west side|upper east side|washington heights|harlem|midtown|south ozone park|willets point|murray hill|queens village|jackson heights|forest hills|ridgewood|elmhurst|corona|jamaica|flushing)\b/i.test(location)
    || /^new york\s*,\s*ny\b/i.test(location.trim());
}

export function ctaContact(client: ClientProfile, location: string): CtaContact {
  if (client.id === "billy-cooper-law") {
    return isBillyNycLocation(location) ? BILLY_NYC_PHONE : BILLY_WESTCHESTER_PHONE;
  }
  const configuredDisplay = client.phoneDisplay.trim();
  const compactDigits = configuredDisplay.replace(/\D/g, "");
  const nationalDigits = compactDigits.length === 11 && compactDigits.startsWith("1")
    ? compactDigits.slice(1)
    : compactDigits;
  const display = /^\+?\d{10,11}$/.test(configuredDisplay) && nationalDigits.length === 10
    ? `(${nationalDigits.slice(0, 3)}) ${nationalDigits.slice(3, 6)}-${nationalDigits.slice(6)}`
    : configuredDisplay;
  const hrefDigits = client.phoneHref.replace(/\D/g, "");
  const displayDigits = compactDigits.length === 10 ? `1${compactDigits}` : compactDigits;
  if (!display || !/^\+[1-9]\d{7,14}$/.test(client.phoneHref) || displayDigits !== hrefDigits) {
    throw new Error(`${client.name} needs a verified phone number and matching call link before a WordPress CTA can be created. Update the client's contact details; no placeholder CTA was saved.`);
  }
  return {
    display,
    href: client.phoneHref,
  };
}

export function isMotorVehiclePracticeArea(practiceArea: string) {
  return /\b(?:car|auto|automobile|motor vehicle|truck|motorcycle|pedestrian|bicycle|rideshare|uber|lyft|traffic|crash)\b/i.test(practiceArea);
}

function ctaMatchText(value: string) {
  return value
    .toLowerCase()
    .replace(/injuries\b/g, "injury")
    .replace(/accidents\b/g, "accident")
    .replace(/lawyers?\b|attorneys?\b|law\s+firm\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function enhancementCtaContext(
  pageTitle: string,
  pageUrl: string,
  client: ClientProfile,
) {
  const normalizedTitle = ctaMatchText(pageTitle);
  const practiceArea = /\bcar accident\b/.test(normalizedTitle) ? "Car Accidents" : [...client.practiceAreas]
    .sort((a, b) => b.length - a.length)
    .find((candidate) => normalizedTitle.includes(ctaMatchText(candidate)))
    || "Personal Injury";
  let slug = "";
  try {
    slug = decodeURIComponent(new URL(pageUrl).pathname.split("/").filter(Boolean).at(-1) || "");
  } catch {
    // Fall back to the page title below.
  }
  const slugTokens = ctaMatchText(slug).split(" ").filter(Boolean);
  const practiceTokens = ctaMatchText(practiceArea).split(" ").filter(Boolean);
  const firstPracticeToken = practiceTokens[0];
  const practiceStart = firstPracticeToken ? slugTokens.indexOf(firstPracticeToken) : -1;
  const fromSlug = practiceStart > 0 ? slugTokens.slice(0, practiceStart).join(" ") : "";
  const matchedPractice = ctaMatchText(practiceArea);
  const titlePracticeStart = normalizedTitle.indexOf(matchedPractice);
  const fromTitle = (titlePracticeStart > 0 ? normalizedTitle.slice(0, titlePracticeStart) : normalizedTitle.replace(matchedPractice, ""))
    .replace(/\s+/g, " ")
    .trim();
  const rawLocation = fromSlug || fromTitle || client.jurisdictions[0] || "your area";
  const location = rawLocation
    .replace(/\b\w/g, (character) => character.toUpperCase())
    .replace(/\b(?:Of|And|The|De|Del)\b/g, (word, offset) => offset === 0 ? word : word.toLowerCase())
    .replace(/\b(?:Nj|Ny|Pa|Fl)$/, (state) => state.toUpperCase());
  return { location, practiceArea };
}

function billyLocationLabel(location: string) {
  const shortened = location.replace(/,?\s*(?:NY|New York)$/i, "").trim();
  return shortened || location.trim();
}

function billyBackgroundUrl(origin: string, location: string, practiceArea: string) {
  if (isMotorVehiclePracticeArea(practiceArea)) {
    return new URL("/cta/car-accident-background.webp", origin).toString();
  }
  const normalized = location.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return BILLY_LOCATION_BACKGROUNDS.find(([name]) => normalized.includes(name))?.[1]
    || "https://www.billycooperlaw.com/wp-content/uploads/2026/08/amplify-new-york-county-ny-personal-injury-local-ai-banner-v6-visual-brief-reviewed-jpeg.jpg";
}

function billyHeadline(slot: CtaSlot, location: string, practiceArea: string, locale: CtaLocale) {
  const place = billyLocationLabel(location);
  if (locale === "es") {
    if (slot === "middle") return `¿Preguntas Sobre una Lesión en ${place}?`;
    if (slot === "closing") return "¿Listo Para Contarnos Qué Pasó?";
    return `¿Sufrió una Lesión en ${place}?`;
  }
  if (slot === "middle") return `Questions About a ${place} Injury Claim?`;
  if (slot === "closing") return "Ready to Discuss What Happened?";
  if (isMotorVehiclePracticeArea(practiceArea)) return `${practiceArea} in ${place}?`;
  if (/^personal injury$/i.test(practiceArea.trim())) return `Injured in ${place}?`;
  return `Need Help With ${practiceArea} in ${place}?`;
}

function billySupportingMessage(slot: CtaSlot, practiceArea: string, locale: CtaLocale) {
  if (locale === "es") {
    if (slot === "middle") return "Una lesión grave puede plantear preguntas sobre las pruebas, el seguro y los plazos. Obtenga orientación clara antes de seguir adelante.";
    if (slot === "closing") return "Cuéntenos qué pasó. Billy Cooper Law escuchará, explicará los asuntos importantes y le ayudará a entender sus opciones.";
    return "Obtenga respuestas antes de hablar con una aseguradora. Billy Cooper Law puede explicarle las pruebas, los plazos y los próximos pasos.";
  }
  if (slot === "middle") {
    return isMotorVehiclePracticeArea(practiceArea)
      ? "A serious crash can raise questions about evidence, insurance, and filing deadlines. Get clear guidance before moving forward."
      : "A serious injury can raise questions about evidence, insurance, and filing deadlines. Get clear guidance before moving forward.";
  }
  if (slot === "closing") return "Tell us what happened. Billy Cooper Law will listen, explain the issues, and help you understand your options.";
  return isMotorVehiclePracticeArea(practiceArea)
    ? "Get answers before speaking with an insurance company. Billy Cooper Law can investigate the crash, preserve evidence, and explain the deadlines that apply."
    : "Get answers before speaking with an insurance company. Billy Cooper Law can explain the evidence, deadlines, and next steps that may apply.";
}

function billyHtmlCtaBlock(
  origin: string,
  client: ClientProfile,
  location: string,
  practiceArea: string,
  slot: CtaSlot,
  locale: CtaLocale,
) {
  const contact = ctaContact(client, location);
  const background = billyBackgroundUrl(origin, location, practiceArea);
  const portrait = new URL("/cta/billy-cooper-cutout-v4.webp", origin).toString();
  const practiceHref = `${client.website}${locale === "es" ? "/areas-de-practica/" : "/practice-areas/"}`;
  const eyebrow = "BILLY COOPER LAW";
  const headline = billyHeadline(slot, location, practiceArea, locale);
  const message = billySupportingMessage(slot, practiceArea, locale);
  const phoneLabel = locale === "es" ? `Llame al ${contact.display}` : `Call ${contact.display}`;
  const practiceLabel = locale === "es"
    ? "Conozca los casos de lesiones personales"
    : `Learn about ${practiceArea.toLowerCase()} cases`;
  const className = `amplify-geo-cta amplify-geo-cta-${slot} ${BILLY_CTA_VERSION}`;
  const accessibleLabel = locale === "es"
    ? `${client.name}: ayuda con ${practiceArea.toLowerCase()} en ${location}. Llame al ${contact.display}.`
    : `${client.name} ${practiceArea} help in ${location}. Call ${contact.display}.`;
  return `<!-- amplify-geo-cta:${slot} -->
<!-- wp:html -->
<style data-amplify-cta-style="${BILLY_CTA_VERSION}">
.amplify-geo-cta.${BILLY_CTA_VERSION}{position:relative;isolation:isolate;box-sizing:border-box;width:100%;max-width:1200px;aspect-ratio:3/2;margin:32px 0!important;overflow:hidden;border-radius:30px;background-color:#082536;background-image:var(--bcl-card-background);background-position:center;background-size:cover;color:#fff;box-shadow:0 18px 46px rgba(3,35,52,.18);container-type:inline-size}
.amplify-geo-cta.${BILLY_CTA_VERSION} *{box-sizing:border-box}
.amplify-geo-cta.${BILLY_CTA_VERSION} .bcl-v4__copy{position:relative;z-index:2;display:flex;flex-direction:column;align-items:flex-start;width:70%;height:100%;padding:7.5% 5.3% 4.8% 6.5%;font-family:Arial,Helvetica,sans-serif}
.amplify-geo-cta.${BILLY_CTA_VERSION} .bcl-v4__eyebrow{margin:0;color:#e6c274;font-size:2cqw;font-weight:800;line-height:1;letter-spacing:.2em;text-transform:uppercase}
.amplify-geo-cta.${BILLY_CTA_VERSION} .bcl-v4__title{max-width:740px;margin:3.4% 0 0;color:#fff;font-family:"IvyPresto Display","Cormorant Garamond",Georgia,serif;font-size:5.5cqw;font-weight:400;line-height:1.02;letter-spacing:-.04em}
.amplify-geo-cta.${BILLY_CTA_VERSION} .bcl-v4__message{max-width:620px;margin:4% 0 0;color:rgba(255,255,255,.95);font-size:2.17cqw;line-height:1.48}
.amplify-geo-cta.${BILLY_CTA_VERSION} .bcl-v4__actions{display:flex;flex-direction:column;align-items:flex-start;margin-top:4.75%}
.amplify-geo-cta.${BILLY_CTA_VERSION} .bcl-v4__phone{display:inline-flex;padding:2.4cqw 4.25cqw;border-radius:999px;background:#e6c274;color:#082536!important;font-size:2.25cqw;font-weight:900;line-height:1;text-decoration:none!important;box-shadow:0 10px 24px rgba(0,0,0,.16)}
.amplify-geo-cta.${BILLY_CTA_VERSION} .bcl-v4__practice{display:inline-block;margin-top:3.75cqw;color:#fff!important;font-size:2.1cqw;font-weight:800;text-decoration:underline!important;text-decoration-thickness:1px!important;text-underline-offset:7px}
.amplify-geo-cta.${BILLY_CTA_VERSION} .bcl-v4__portrait{position:absolute;z-index:1;right:-2%;bottom:0;width:49%;height:82%;object-fit:contain;object-position:right bottom;filter:drop-shadow(-16px 14px 22px rgba(0,0,0,.22))}
@container(max-width:500px){.amplify-geo-cta.${BILLY_CTA_VERSION}{aspect-ratio:auto;min-height:640px;border-radius:22px;background-position:center}.amplify-geo-cta.${BILLY_CTA_VERSION} .bcl-v4__copy{width:100%;padding:38px 24px 285px}.amplify-geo-cta.${BILLY_CTA_VERSION} .bcl-v4__eyebrow{font-size:14px}.amplify-geo-cta.${BILLY_CTA_VERSION} .bcl-v4__title{margin-top:20px;font-size:39px}.amplify-geo-cta.${BILLY_CTA_VERSION} .bcl-v4__message{margin-top:22px;font-size:18px}.amplify-geo-cta.${BILLY_CTA_VERSION} .bcl-v4__actions{margin-top:26px}.amplify-geo-cta.${BILLY_CTA_VERSION} .bcl-v4__phone{padding:16px 22px;font-size:19px}.amplify-geo-cta.${BILLY_CTA_VERSION} .bcl-v4__practice{margin-top:22px;font-size:17px}.amplify-geo-cta.${BILLY_CTA_VERSION} .bcl-v4__portrait{right:-8%;width:72%;height:305px}}
</style>
<section class="${className}" style="margin:32px 0;--bcl-card-background:linear-gradient(90deg,rgba(8,37,54,.98) 0%,rgba(8,37,54,.95) 48%,rgba(8,37,54,.82) 72%,rgba(8,37,54,.54) 100%),url('${escapeHtml(background)}')" aria-label="${escapeHtml(accessibleLabel)}">
  <div class="bcl-v4__copy">
    <p class="bcl-v4__eyebrow">${eyebrow}</p>
    <div class="bcl-v4__title" role="heading" aria-level="2">${escapeHtml(headline)}</div>
    <p class="bcl-v4__message">${escapeHtml(message)}</p>
    <div class="bcl-v4__actions">
      <a class="bcl-v4__phone" href="tel:${escapeHtml(contact.href)}">${escapeHtml(phoneLabel)}</a>
      <a class="bcl-v4__practice" href="${escapeHtml(practiceHref)}">${escapeHtml(practiceLabel)}</a>
    </div>
  </div>
  <img class="bcl-v4__portrait skip-lazy" data-no-lazy="1" src="${escapeHtml(portrait)}" alt="Billy Cooper" width="768" height="833" loading="eager" fetchpriority="${slot === "opening" ? "high" : "auto"}" decoding="async"/>
</section>
<!-- /wp:html -->`;
}

function genericLawyerTopic(practiceArea: string) {
  return practiceArea
    .replace(/\baccidents\b/gi, "accident")
    .replace(/\binjuries\b/gi, "injury")
    .replace(/\bclaims\b/gi, "claim")
    .replace(/\blawyers?\b|\battorneys?\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function indefiniteArticle(value: string) {
  return /^[aeiou]/i.test(value.trim()) ? "an" : "a";
}

type GenericCtaTopicKind = "injury" | "family" | "medical" | "probate" | "employment" | "business" | "criminal" | "immigration" | "general";

function genericCtaTopic(practiceArea: string, articleTopic = "") {
  const combined = `${articleTopic} ${practiceArea}`.toLowerCase();
  const kind: GenericCtaTopicKind = /\b(?:medical malpractice|med mal|birth injury|failure to diagnose|misdiagnosis|surgical error|hospital negligence|medical negligence)\b/.test(combined)
    ? "medical"
    : /\b(?:personal injury|accidents?|crashes?|injury|injuries|injured|slip and fall|premises liability|wrongful death)\b/.test(combined)
      ? "injury"
      : /\b(?:divorce|family law|matrimonial|marital|child custody|child support|alimony|equitable distribution)\b/.test(combined)
        ? "family"
        : /\b(?:probate|estate administration|executor|administrator|will contest)\b/.test(combined)
          ? "probate"
          : /\b(?:employment|workplace discrimination|wrongful termination|wage|harassment)\b/.test(combined)
            ? "employment"
            : /\b(?:business|commercial|contract|corporate|partnership)\b/.test(combined)
              ? "business"
              : /\b(?:criminal|dui|dwi|arrest|felony|misdemeanor)\b/.test(combined)
                ? "criminal"
                : /\b(?:immigration|visa|citizenship|green card|deportation)\b/.test(combined)
                  ? "immigration"
                  : "general";
  const label = /\b(?:marital debt|debts? accumulated during marriage|credit cards?,? tax debt)\b/.test(combined)
    ? "Marital Debt"
    : /\bchild custody\b/.test(combined)
      ? "Child Custody"
      : /\bchild support\b/.test(combined)
        ? "Child Support"
        : /\balimony\b/.test(combined)
          ? "Alimony"
          : /\bdivorce\b/.test(combined)
            ? "Divorce"
            : /\bfailure to diagnose\b/.test(combined)
              ? "Failure to Diagnose"
              : /\bmisdiagnosis\b/.test(combined)
                ? "Misdiagnosis"
                : /\bsurgical error\b/.test(combined)
                  ? "Surgical Errors"
                  : /\bbirth injury\b/.test(combined)
                    ? "Birth Injury"
                    : (genericLawyerTopic(practiceArea) || "legal matter")
                        .replace(/\b\w/g, (letter) => letter.toUpperCase());
  return { kind, label };
}

function genericClientHeadline(
  slot: CtaSlot,
  location: string,
  practiceArea: string,
  articleTopic = "",
) {
  const place = /^(?:your area|general)$/i.test(location.trim()) ? "" : location.trim();
  const topic = genericCtaTopic(practiceArea, articleTopic);
  if (/^car accidents?$/i.test(practiceArea.trim())) {
    if (slot === "middle") return `Questions About a ${place ? `${place} ` : ""}Car Accident Claim?`;
    if (slot === "closing") return `Discuss Your ${place ? `${place} ` : ""}Car Accident`;
    return place ? `Injured in a ${place} Car Accident?` : "Injured in a Car Accident?";
  }
  if (topic.kind !== "injury") {
    if (slot === "middle") return `Questions About ${topic.label}?`;
    if (slot === "closing") return `Ready to Discuss Your ${topic.label} Matter?`;
    return place ? `Need Help With ${topic.label} in ${place}?` : `Need Help With ${topic.label}?`;
  }
  if (slot === "middle") {
    return place
      ? `Questions About a ${place} ${topic.label} Claim?`
      : `Questions About a ${topic.label} Claim?`;
  }
  if (slot === "closing") return place ? `Ready to Talk About What Happened in ${place}?` : "Ready to Talk About What Happened?";
  return place ? `Injured in ${place}?` : "Injured?";
}

function genericClientMessage(
  slot: CtaSlot,
  client: ClientProfile,
  practiceArea: string,
  articleTopic = "",
) {
  const topic = genericCtaTopic(practiceArea, articleTopic);
  const lowerLabel = topic.label.toLowerCase();
  if (topic.kind === "injury") {
    if (slot === "middle") return `${client.name} can review the evidence, insurance issues, and next steps that may matter in your ${lowerLabel} claim.`;
    if (slot === "closing") return `Tell ${client.name} what happened and get clear guidance about your injury claim and legal options.`;
    return `${client.name} can review your ${lowerLabel} claim and explain the evidence, deadlines, and next steps that may apply.`;
  }
  if (topic.kind === "family") {
    return `${client.name} can explain how ${lowerLabel} may affect your rights, finances, and next steps.`;
  }
  if (topic.kind === "medical") {
    return `${client.name} can review the medical issues, responsible providers, deadlines, and legal options that may apply.`;
  }
  if (topic.kind === "probate") {
    return `${client.name} can explain the probate process, fiduciary responsibilities, and the next steps that may apply.`;
  }
  if (topic.kind === "employment") {
    return `${client.name} can review the workplace facts, available records, deadlines, and your legal options.`;
  }
  return `${client.name} can explain the issues involved in your ${lowerLabel} matter and help you understand the next step.`;
}

function hexRgb(value: string) {
  const match = /^#([0-9a-f]{6})$/i.exec(value.trim());
  if (!match) return null;
  return {
    red: Number.parseInt(match[1].slice(0, 2), 16),
    green: Number.parseInt(match[1].slice(2, 4), 16),
    blue: Number.parseInt(match[1].slice(4, 6), 16),
  };
}

function readableTextColor(background: string) {
  const rgb = hexRgb(background);
  if (!rgb) return "#ffffff";
  const linear = [rgb.red, rgb.green, rgb.blue].map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  return luminance > 0.43 ? "#111111" : "#ffffff";
}

function clientHost(client: ClientProfile) {
  try {
    return new URL(client.website).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function isFulginitiClient(client: ClientProfile) {
  return clientHost(client) === "fulginiti-law.com";
}

function fulginitiHeadline(slot: CtaSlot, location: string, practiceArea: string) {
  const place = /^(?:your area|general)$/i.test(location.trim()) ? "" : location.trim();
  const topic = genericLawyerTopic(practiceArea) || "personal injury";
  const titleCaseTopic = topic.replace(/\b\w/g, (letter) => letter.toUpperCase());
  if (slot === "middle") {
    return place
      ? `Questions About ${indefiniteArticle(place)} ${place} ${titleCaseTopic} Claim?`
      : `Questions About ${indefiniteArticle(topic)} ${titleCaseTopic} Claim?`;
  }
  if (slot === "closing") {
    return place
      ? `Injured in ${place}? Talk With ${indefiniteArticle(topic)} ${titleCaseTopic} Lawyer.`
      : `Injured? Talk With ${indefiniteArticle(topic)} ${titleCaseTopic} Lawyer.`;
  }
  return place
    ? `Injured in ${place}? Get a Free Consultation With ${indefiniteArticle(topic)} ${titleCaseTopic} Lawyer.`
    : `Injured? Get a Free Consultation With ${indefiniteArticle(topic)} ${titleCaseTopic} Lawyer.`;
}

function fulginitiHtmlCtaBlock(
  client: ClientProfile,
  location: string,
  practiceArea: string,
  slot: CtaSlot,
  imageUrl?: string,
) {
  const contact = ctaContact(client, location);
  const safeImageUrl = (() => {
    try {
      const url = new URL(imageUrl || "");
      return url.protocol === "https:" ? url.toString() : "";
    } catch {
      return "";
    }
  })();
  const headline = fulginitiHeadline(slot, location, practiceArea);
  const className = `amplify-geo-cta amplify-geo-cta-${slot} ${FULGINITI_CTA_VERSION}`;
  const imageAlt = `${practiceArea} legal help in ${location}`;
  const accessibleLabel = `Fulginiti Law: ${practiceArea} help in ${location}. Call ${contact.display}.`;
  return `<!-- amplify-geo-cta:${slot} -->
<!-- wp:html -->
<style data-amplify-cta-style="${FULGINITI_CTA_VERSION}">
.amplify-geo-cta.${FULGINITI_CTA_VERSION}{box-sizing:border-box;width:100%;max-width:760px;margin:32px 0!important;padding:27px 29px 30px;background:#000;color:#fff;overflow:hidden;font-family:Arial,Helvetica,sans-serif}
.amplify-geo-cta.${FULGINITI_CTA_VERSION} *{box-sizing:border-box}.amplify-geo-cta.${FULGINITI_CTA_VERSION} .flcta__title{max-width:650px;margin:0;color:#fff;font-size:clamp(25px,3vw,34px);font-weight:800;line-height:1.02;letter-spacing:-.025em;text-transform:uppercase}.amplify-geo-cta.${FULGINITI_CTA_VERSION} .flcta__grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(200px,.75fr);gap:36px;align-items:center;margin-top:22px}.amplify-geo-cta.${FULGINITI_CTA_VERSION} .flcta__image{display:block;width:100%;height:160px;object-fit:cover;object-position:center;border-radius:4px;background:#171717}.amplify-geo-cta.${FULGINITI_CTA_VERSION} .flcta__action{text-align:center}.amplify-geo-cta.${FULGINITI_CTA_VERSION} .flcta__call-label{margin:0 0 12px;color:#fff;font-size:18px;font-weight:400;line-height:1;text-transform:uppercase}.amplify-geo-cta.${FULGINITI_CTA_VERSION} .flcta__phone{display:inline-flex;align-items:center;justify-content:center;width:100%;max-width:230px;padding:12px 20px;border:2px solid #fff;border-radius:999px;color:#fff!important;font-size:18px;font-weight:400;line-height:1;text-decoration:none!important}.amplify-geo-cta.${FULGINITI_CTA_VERSION} .flcta__phone:hover,.amplify-geo-cta.${FULGINITI_CTA_VERSION} .flcta__phone:focus{background:#fff;color:#000!important}@media(max-width:700px){.amplify-geo-cta.${FULGINITI_CTA_VERSION}{padding:26px 20px}.amplify-geo-cta.${FULGINITI_CTA_VERSION} .flcta__title{font-size:28px}.amplify-geo-cta.${FULGINITI_CTA_VERSION} .flcta__grid{grid-template-columns:1fr;gap:22px;margin-top:20px}.amplify-geo-cta.${FULGINITI_CTA_VERSION} .flcta__image{height:180px}.amplify-geo-cta.${FULGINITI_CTA_VERSION} .flcta__phone{max-width:none}}
</style>
<section class="${className}" style="margin:32px 0;background:#000" aria-label="${escapeHtml(accessibleLabel)}">
  <div class="flcta__title" role="heading" aria-level="2">${escapeHtml(headline)}</div>
  <div class="flcta__grid">
    <div>${safeImageUrl ? `<img class="flcta__image skip-lazy" data-no-lazy="1" src="${escapeHtml(safeImageUrl)}" alt="${escapeHtml(imageAlt)}" width="720" height="430" loading="eager" fetchpriority="${slot === "opening" ? "high" : "auto"}" decoding="async"/>` : ""}</div>
    <div class="flcta__action"><p class="flcta__call-label">Call now</p><a class="flcta__phone" href="tel:${escapeHtml(contact.href)}">${escapeHtml(contact.display)}</a></div>
  </div>
</section>
<!-- /wp:html -->`;
}

function genericHtmlCtaBlock(
  client: ClientProfile,
  location: string,
  practiceArea: string,
  slot: CtaSlot,
  locale: CtaLocale,
  imageUrl?: string,
  articleTopic?: string,
) {
  const contact = ctaContact(client, location);
  const headline = locale === "es"
    ? (slot === "closing" ? "¿Listo Para Hablar de lo Que Pasó?" : `¿Sufrió una Lesión en ${location}? Hable Con un Abogado.`)
    : genericClientHeadline(slot, location, practiceArea, articleTopic);
  const message = locale === "es"
    ? `${client.name} puede escuchar lo ocurrido y explicarle los próximos pasos que podrían corresponder.`
    : genericClientMessage(slot, client, practiceArea, articleTopic);
  const phoneLabel = locale === "es" ? "Llame ahora" : "Call now";
  const safeImageUrl = (() => {
    try {
      const url = new URL(imageUrl || "");
      return url.protocol === "https:" ? url.toString() : "";
    } catch {
      return "";
    }
  })();
  const className = `amplify-geo-cta amplify-geo-cta-${slot} ${CLIENT_CTA_VERSION}`;
  const imageAlt = `${practiceArea} legal help in ${location} from ${client.name}`;
  const accessibleLabel = `${client.name}: ${practiceArea} help in ${location}. ${phoneLabel} ${contact.display}.`;
  const topicLabel = `${genericLawyerTopic(practiceArea).replace(/^\w/, (letter) => letter.toUpperCase()) || "Personal injury"} legal help`;
  const textColor = readableTextColor(client.brand.primary);
  const mutedTextColor = textColor === "#ffffff" ? "rgba(255,255,255,.84)" : "rgba(17,17,17,.78)";
  const accentTextColor = readableTextColor(client.brand.accent);
  const contactHref = client.contactUrl || client.website;
  const secondaryLabel = client.cta.linkLabel || `Contact ${client.name}`;
  return `<!-- amplify-geo-cta:${slot} -->
<!-- wp:html -->
<style data-amplify-cta-style="${CLIENT_CTA_VERSION}">
.amplify-geo-cta.${CLIENT_CTA_VERSION}{box-sizing:border-box;width:100%;max-width:900px;margin:32px 0!important;padding:34px 36px 36px;border-radius:16px;background:${escapeHtml(client.brand.primary)};color:${textColor};overflow:hidden;box-shadow:0 14px 34px rgba(0,0,0,.12);font-family:Arial,Helvetica,sans-serif}
.amplify-geo-cta.${CLIENT_CTA_VERSION} *{box-sizing:border-box}.amplify-geo-cta.${CLIENT_CTA_VERSION} .acta__eyebrow{margin:0 0 13px;color:${escapeHtml(client.brand.accent)};font-size:14px;font-weight:800;line-height:1.15;letter-spacing:.14em;text-transform:uppercase}.amplify-geo-cta.${CLIENT_CTA_VERSION} .acta__title{max-width:700px;margin:0;color:${textColor};font-size:clamp(30px,4.2vw,43px);font-weight:800;line-height:1.02;letter-spacing:-.025em;text-transform:none}.amplify-geo-cta.${CLIENT_CTA_VERSION} .acta__topic{margin:10px 0 0;color:${mutedTextColor};font-size:17px;font-weight:700;line-height:1.3}.amplify-geo-cta.${CLIENT_CTA_VERSION} .acta__grid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(225px,.85fr);gap:30px;align-items:center;margin-top:25px}.amplify-geo-cta.${CLIENT_CTA_VERSION} .acta__image{width:100%;height:190px;display:block;object-fit:cover;object-position:center;border-radius:8px;background:${escapeHtml(client.brand.secondary)}}.amplify-geo-cta.${CLIENT_CTA_VERSION} .acta__message{margin:0 0 19px;color:${mutedTextColor};font-size:16px;line-height:1.45}.amplify-geo-cta.${CLIENT_CTA_VERSION} .acta__call-label{margin:0 0 9px;color:${textColor};font-size:15px;font-weight:700;line-height:1;text-transform:uppercase;letter-spacing:.04em}.amplify-geo-cta.${CLIENT_CTA_VERSION} .acta__phone{display:inline-flex;align-items:center;justify-content:center;width:100%;max-width:240px;padding:13px 20px;border:0;border-radius:999px;background:${escapeHtml(client.brand.accent)};color:${accentTextColor}!important;font-size:19px;font-weight:800;line-height:1;text-decoration:none!important}.amplify-geo-cta.${CLIENT_CTA_VERSION} .acta__secondary{display:inline-block;margin-top:14px;color:${textColor}!important;font-size:14px;font-weight:700;line-height:1.3;text-underline-offset:4px}.amplify-geo-cta.${CLIENT_CTA_VERSION} .acta__phone:hover,.amplify-geo-cta.${CLIENT_CTA_VERSION} .acta__phone:focus{filter:brightness(.94)}@media(max-width:700px){.amplify-geo-cta.${CLIENT_CTA_VERSION}{padding:27px 22px 29px;border-radius:12px}.amplify-geo-cta.${CLIENT_CTA_VERSION} .acta__title{font-size:34px}.amplify-geo-cta.${CLIENT_CTA_VERSION} .acta__grid{grid-template-columns:1fr;gap:21px;margin-top:21px}.amplify-geo-cta.${CLIENT_CTA_VERSION} .acta__image{height:190px}.amplify-geo-cta.${CLIENT_CTA_VERSION} .acta__phone{max-width:none}.amplify-geo-cta.${CLIENT_CTA_VERSION} .acta__message{font-size:16px}}
</style>
<section class="${className}" style="margin:32px 0;background:${escapeHtml(client.brand.primary)};color:${textColor}" aria-label="${escapeHtml(accessibleLabel)}">
  <p class="acta__eyebrow">${escapeHtml(client.name)}</p>
  <div class="acta__title" role="heading" aria-level="2">${escapeHtml(headline)}</div>
  <p class="acta__topic">${escapeHtml(topicLabel)}</p>
  <div class="acta__grid">
    <div>${safeImageUrl ? `<img class="acta__image skip-lazy" data-no-lazy="1" src="${escapeHtml(safeImageUrl)}" alt="${escapeHtml(imageAlt)}" width="720" height="430" loading="eager" fetchpriority="${slot === "opening" ? "high" : "auto"}" decoding="async"/>` : ""}</div>
    <div class="acta__action"><p class="acta__message">${escapeHtml(message)}</p><p class="acta__call-label">${phoneLabel}</p><a class="acta__phone" href="tel:${escapeHtml(contact.href)}">${escapeHtml(contact.display)}</a><br/><a class="acta__secondary" href="${escapeHtml(contactHref)}">${escapeHtml(secondaryLabel)}</a></div>
  </div>
</section>
<!-- /wp:html -->`;
}

function ctaBlock(
  origin: string,
  client: ClientProfile,
  location: string,
  practiceArea: string,
  slot: CtaSlot,
  locale: CtaLocale,
  imageUrl?: string,
  articleTopic?: string,
) {
  if (client.id === "billy-cooper-law") {
    return billyHtmlCtaBlock(origin, client, location, practiceArea, slot, locale);
  }
  if (isFulginitiClient(client)) {
    return fulginitiHtmlCtaBlock(client, location, practiceArea, slot, imageUrl);
  }
  return genericHtmlCtaBlock(client, location, practiceArea, slot, locale, imageUrl, articleTopic);
}

function ctaVersionForClient(client: ClientProfile) {
  if (client.id === "billy-cooper-law") return BILLY_CTA_VERSION;
  if (isFulginitiClient(client)) return FULGINITI_CTA_VERSION;
  return CLIENT_CTA_VERSION;
}

function h2SectionBoundaries(content: string) {
  const blockHeadingPattern = /<!--\s*wp:heading\b[^>]*-->\s*<h2\b[^>]*>/gi;
  const blockBoundaries = [...content.matchAll(blockHeadingPattern)]
    .map((match) => match.index ?? 0);
  const rawBoundaries = [...content.matchAll(/<h2\b[^>]*>/gi)]
    .map((match) => match.index ?? 0)
    .filter((position) => !blockBoundaries.some((blockPosition) => {
      const blockPrefix = content.slice(blockPosition, position);
      return blockPosition <= position
        && position - blockPosition < 500
        && /<!--\s*wp:heading\b/i.test(blockPrefix)
        && !/<!--\s*\/wp:heading\s*-->/i.test(blockPrefix);
    }));
  return [...new Set([...blockBoundaries, ...rawBoundaries])].sort((a, b) => a - b);
}

/** Keep theme mobile paragraph rules from shrinking article copy below lists. */
export function normalizeEpsteinTypography(content: string, client: Pick<ClientProfile, "website">) {
  let host = "";
  try { host = new URL(client.website).hostname.replace(/^www\./, ""); } catch { return content; }
  if (host !== "theepsteinlawfirm.com") return content;
  const clean = content.replace(/<!-- wp:html -->\s*<style data-amplify-epstein-typography="[^"]*">[\s\S]*?<\/style>\s*<!-- \/wp:html -->/g, "");
  return `${clean.trim()}\n<!-- wp:html -->
<style data-amplify-epstein-typography="v1">
.default-content .entry__content p.wp-block-paragraph,
.default-content .entry__content ul.wp-block-list,
.default-content .entry__content ol.wp-block-list,
.default-content .entry__content .wp-block-list li{font-size:16px;line-height:1.6}
.default-content .entry__content .wp-block-paragraph :is(a,strong,em,span),
.default-content .entry__content .wp-block-list :is(a,strong,em,span){font-size:inherit;line-height:inherit}
</style>
<!-- /wp:html -->`;
}

export function insertCtaBlocks(
  content: string,
  options: {
    origin: string;
    client: ClientProfile;
    location: string;
    practiceArea: string;
    locale?: CtaLocale;
    imageUrl?: string;
    articleTopic?: string;
    forceRefresh?: boolean;
  },
) {
  if (/\b(?:car|auto|truck)\s+accidents?\b/i.test(options.location)) {
    throw new Error("The CTA location contains an accident type. Resolve the city and state before preparing this page.");
  }
  content = normalizeEpsteinTypography(content, options.client);
  ctaContact(options.client, options.location);
  const expectedVersion = ctaVersionForClient(options.client);
  if (!options.forceRefresh && content.includes("amplify-geo-cta:") && content.includes(expectedVersion)) return content;
  const workingContent = content.replace(
    /<!--\s*amplify-geo-cta:(?:opening|middle|closing)\s*-->\s*<!--\s*wp:(image|html)\b[^>]*-->[\s\S]*?<!--\s*\/wp:\1\s*-->/gi,
    "",
  );

  const locale = options.locale || "en";
  // A paragraph is a WordPress block, but it can still be part of a larger
  // semantic content section. Place CTAs only at section boundaries: directly
  // before the next H2, never after an arbitrary paragraph or list. Match the
  // actual H2 tags so mixed classic/Gutenberg content remains safe even after
  // Amplify adds its own managed block comments.
  const headingBoundaries = h2SectionBoundaries(workingContent);
  const openingPosition = headingBoundaries[0];
  const laterBoundaries = headingBoundaries.filter((position) => position > openingPosition);
  const midpoint = workingContent.length / 2;
  const middlePosition = laterBoundaries.reduce<number | undefined>((closest, position) => {
    if (closest === undefined) return position;
    return Math.abs(position - midpoint) < Math.abs(closest - midpoint) ? position : closest;
  }, undefined);
  const placements = [
    ...(openingPosition === undefined ? [] : [{ position: openingPosition, slot: "opening" as const }]),
    ...(middlePosition === undefined ? [] : [{ position: middlePosition, slot: "middle" as const }]),
    { position: workingContent.length, slot: "closing" as const },
  ];

  let result = workingContent;
  placements
    .sort((a, b) => b.position - a.position)
    .forEach(({ position, slot }) => {
      const block = ctaBlock(
        options.origin,
        options.client,
        options.location,
        options.practiceArea,
        slot,
        locale,
        options.imageUrl,
        options.articleTopic,
      );
      result = `${result.slice(0, position)}\n${block}\n${result.slice(position)}`;
    });
  return result;
}

/** New shared featured/CTA photography is an Epstein policy, not a global default. */
export function usesNewEnhancementImage(client: Pick<ClientProfile, "website">) {
  try { return new URL(client.website).hostname.replace(/^www\./, "") === "theepsteinlawfirm.com"; }
  catch { return false; }
}
