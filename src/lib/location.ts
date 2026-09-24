export const STATE_ABBREVIATIONS: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
  "district of columbia": "DC",
  "washington dc": "DC",
  "puerto rico": "PR",
  guam: "GU",
  "u.s. virgin islands": "VI",
  "us virgin islands": "VI",
  "american samoa": "AS",
  "northern mariana islands": "MP",
};

export function stateAbbreviation(state: string) {
  const cleaned = state.trim().replace(/\./g, "");
  if (/^[A-Za-z]{2}$/.test(cleaned)) return cleaned.toUpperCase();
  return STATE_ABBREVIATIONS[cleaned.toLowerCase()] || cleaned;
}

export function formatLocation(city: string, state: string) {
  return `${city.trim()} ${stateAbbreviation(state)}`.trim();
}

const STATE_NAME_BY_ABBREVIATION = Object.fromEntries(
  Object.entries(STATE_ABBREVIATIONS).map(([name, abbreviation]) => [abbreviation, name]),
) as Record<string, string>;

function escapedPattern(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function visibleText(value: string) {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function countMatches(value: string, pattern: RegExp) {
  return [...value.matchAll(pattern)].length;
}

export function inferStateAbbreviation(
  value: string,
  jurisdictions: string[] = [],
  location = "",
) {
  const text = visibleText(value);
  const locationPattern = location.trim() ? escapedPattern(location.trim()) : "";
  const scores = Object.entries(STATE_NAME_BY_ABBREVIATION).map(([abbreviation, canonicalName]) => {
    const names = Object.entries(STATE_ABBREVIATIONS)
      .filter(([, candidate]) => candidate === abbreviation)
      .map(([name]) => name)
      .sort((a, b) => b.length - a.length);
    const namePattern = names.map(escapedPattern).join("|");
    const fullNameMatches = namePattern
      ? countMatches(text, new RegExp(`\\b(?:${namePattern})\\b`, "gi"))
      : 0;
    const abbreviationMatches = countMatches(
      text,
      new RegExp(`(?:^|[^A-Za-z])${escapedPattern(abbreviation)}(?:$|[^A-Za-z])`, "g"),
    );
    const locationMatches = locationPattern
      ? countMatches(
          text,
          new RegExp(
            `\\b${locationPattern}\\s*,?\\s*(?:${escapedPattern(abbreviation)}|${namePattern})\\b`,
            "gi",
          ),
        )
      : 0;
    return {
      abbreviation,
      canonicalName,
      score: (locationMatches * 12) + (fullNameMatches * 4) + abbreviationMatches,
    };
  }).sort((a, b) => b.score - a.score);

  if (scores[0]?.score >= 4 && scores[0].score > (scores[1]?.score || 0)) {
    return scores[0].abbreviation;
  }

  const jurisdictionStates = new Set(
    jurisdictions
      .map((jurisdiction) => {
        const normalized = jurisdiction
          .replace(/\b(?:state|county|city)\b/gi, " ")
          .replace(/\s+/g, " ")
          .trim();
        const abbreviation = stateAbbreviation(normalized);
        return /^[A-Z]{2}$/.test(abbreviation) ? abbreviation : "";
      })
      .filter(Boolean),
  );
  return jurisdictionStates.size === 1 ? [...jurisdictionStates][0] : "";
}

export function stripStateSuffix(location: string) {
  const stateNames = Object.keys(STATE_ABBREVIATIONS)
    .sort((a, b) => b.length - a.length)
    .map(escapedPattern)
    .join("|");
  const abbreviations = [...new Set(Object.values(STATE_ABBREVIATIONS))]
    .map(escapedPattern)
    .join("|");
  return location
    .replace(new RegExp(`(?:\\s*,\\s*|\\s+)(?:${stateNames}|${abbreviations})$`, "i"), "")
    .replace(/\s+/g, " ")
    .trim();
}
