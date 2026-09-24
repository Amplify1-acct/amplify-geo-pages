import type { ClientProfile } from "@/lib/clients";
import { enhancementCtaContext } from "@/lib/cta";
import { inferStateAbbreviation, stripStateSuffix } from "@/lib/location";

function escapedPattern(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function appendStateToLocation(value: string, location: string, state: string) {
  const city = stripStateSuffix(location);
  if (!city || !state) return value;
  const pattern = new RegExp(
    `\\b${escapedPattern(city)}\\b(?:\\s*,?\\s*(?:[A-Z]{2}\\b|New\\s+Jersey\\b|Pennsylvania\\b|New\\s+York\\b))?`,
    "i",
  );
  return pattern.test(value) ? value.replace(pattern, `${city} ${state}`) : value;
}

function normalizeHeadingLocations(content: string, location: string, state: string) {
  return content.replace(
    /(<h[1-6]\b[^>]*>)([\s\S]*?)(<\/h[1-6]>)/gi,
    (_match, open: string, inner: string, close: string) => {
      if (/<[^>]+>/.test(inner)) return `${open}${inner}${close}`;
      return `${open}${appendStateToLocation(inner, location, state)}${close}`;
    },
  );
}

export type NormalizedEnhancementLocation = {
  pageTitle: string;
  seoTitle: string;
  content: string;
  location: string;
  state: string;
  practiceArea: string;
};

export function normalizeEnhancementLocation(options: {
  pageTitle: string;
  seoTitle?: string;
  content: string;
  sourceContent?: string;
  pageUrl: string;
  client: ClientProfile;
}): NormalizedEnhancementLocation {
  const context = enhancementCtaContext(options.pageTitle, options.pageUrl, options.client);
  const city = stripStateSuffix(context.location);
  const state = inferStateAbbreviation(
    `${options.pageTitle}\n${options.seoTitle || ""}\n${options.content}\n${options.sourceContent || ""}`,
    options.client.jurisdictions,
    city,
  );
  if (!city || !state) {
    throw new Error(
      "AMPLIFY could not verify the city and state for this enhancement. Add the correct state to the approved H1, then rebuild the WordPress review copy.",
    );
  }
  const repeatedState = new RegExp(`\\b${state}\\s+(?:car|auto|truck)\\s+accidents?\\s+${state}\\b`, "i");
  if (repeatedState.test(`${options.pageTitle}\n${options.seoTitle || ""}\n${options.content}`)) {
    throw new Error("The page repeats the state after the accident type. Correct the approved title and headings before preparing or publishing it.");
  }
  const location = `${city} ${state}`;
  return {
    pageTitle: appendStateToLocation(options.pageTitle, city, state),
    seoTitle: appendStateToLocation(options.seoTitle || "", city, state),
    content: normalizeHeadingLocations(options.content, city, state),
    location,
    state,
    practiceArea: context.practiceArea,
  };
}
