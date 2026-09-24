import { verifiedPracticeAreaUrls } from "@/lib/practice-area-directory";

export type LawyerProfile = {
  name: string;
  imageUrl: string;
};

export type ClientBrand = {
  primary: string;
  secondary: string;
  accent: string;
  surface: string;
  logoUrl?: string;
};

export type ClientBlogDefaults = {
  authorId?: number;
  categoryId?: number;
  defaultJurisdiction?: string;
};

export type ClientCtaDefaults = {
  consultationText?: string;
  linkLabel?: string;
};

export type ClientProfile = {
  id: string;
  name: string;
  website: string;
  reviewerEmail: string;
  phoneDisplay: string;
  phoneHref: string;
  locale: "en" | "es";
  jurisdictions: string[];
  contactUrl?: string;
  practiceAreaUrls: Record<string, string>;
  practiceAreas: string[];
  lawyers: LawyerProfile[];
  brand: ClientBrand;
  blogDefaults: ClientBlogDefaults;
  cta: ClientCtaDefaults;
  wordpress?: {
    siteUrl: string;
    username: string;
    applicationPassword: string;
    pageTemplate?: string;
  };
};

export type PublicClientProfile = Omit<ClientProfile, "wordpress"> & {
  wordpress?: {
    siteUrl: string;
    username: string;
    pageTemplate?: string;
    passwordConfigured: boolean;
  };
  wordpressReady: boolean;
  assetsReady: boolean;
};

function cleanPhoneHref(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

function cleanHex(value: unknown, fallback: string) {
  const color = typeof value === "string" ? value.trim() : "";
  return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
}

function validUrl(value: unknown) {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url.toString().replace(/\/$/, "") : "";
  } catch {
    return "";
  }
}

function verifiedClientDefaults(website: string) {
  let host = "";
  try {
    host = new URL(website).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
  // Verified against the firm's live header, contact page, and theme colors.
  if (host === "myfloridainjurylaw.com") {
    return {
      name: "Drazen Mancini, P.A.",
      phoneDisplay: "561.783.4534",
      phoneHref: "+15617834534",
      jurisdictions: ["Florida"],
      contactUrl: "https://www.myfloridainjurylaw.com/contact-us/",
      brand: {
        primary: "#132819",
        secondary: "#000000",
        accent: "#d4f0cd",
        surface: "#ffffff",
        logoUrl: "https://www.myfloridainjurylaw.com/wp-content/uploads/2026/03/home-hero-logo.svg",
      },
      cta: {
        consultationText: "Get the Answers You Need",
        linkLabel: "Contact Drazen Mancini",
      },
    };
  }
  if (host === "fulginiti-law.com") {
    return {
      name: "Fulginiti Law",
      phoneDisplay: "215-774-5162",
      phoneHref: "+12157745162",
      jurisdictions: ["Pennsylvania", "New Jersey"],
      contactUrl: "https://www.fulginiti-law.com/contact/",
      brand: {
        primary: "#000000",
        secondary: "#171717",
        accent: "#ffffff",
        surface: "#f4f4f4",
        logoUrl: "https://www.fulginiti-law.com/wp-content/uploads/2025/07/small-logo.svg",
      },
      cta: {
        consultationText: "Free consultation",
        linkLabel: "Contact Fulginiti Law",
      },
    };
  }
  if (host === "theepsteinlawfirm.com") {
    return {
      name: "The Epstein Law Firm",
      phoneDisplay: "(201) 231-7847",
      phoneHref: "+12012317847",
      jurisdictions: ["New Jersey"],
      contactUrl: "https://www.theepsteinlawfirm.com/contact/",
      brand: {
        primary: "#0e0e0e",
        secondary: "#414141",
        accent: "#d2b052",
        surface: "#f7f7f7",
        logoUrl: "https://www.theepsteinlawfirm.com/wp-content/uploads/2023/12/Logo-1.svg",
      },
      cta: {
        consultationText: "Tell us what happened. The Epstein Law Firm will listen, explain your options, and help you understand the next step.",
        linkLabel: "Schedule your free case evaluation",
      },
    };
  }
  return null;
}

function verifiedPracticeAreas(website: string) {
  let host = "";
  try {
    host = new URL(website).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return [];
  }
  if (host === "myfloridainjurylaw.com") {
    return [
      "Personal Injury",
      "Auto Accidents",
      "Truck Accidents",
      "Motorcycle Accidents",
      "Rideshare Accidents",
      "Premises Liability",
      "Slip and Fall",
      "Trip and Fall",
      "Big Box Retailer Accidents",
      "Commercial Property Accidents",
      "Wrongful Death",
    ];
  }
  if (host === "fulginiti-law.com") {
    return [
      "Catastrophic Injury",
      "Sports Injury",
      "Amputation",
      "Child Injury",
      "Burn Injuries",
      "Spinal Cord Injuries",
      "Traumatic Brain Injuries",
      "Construction Accidents",
      "Medical Malpractice",
      "Birth Injuries",
      "Misdiagnosis and Delayed Diagnosis",
      "Surgical Errors",
      "Personal Injury",
      "Premises Liability",
      "Negligent Security",
      "Slip and Fall",
      "Product Liability",
      "Defective Medical Devices",
      "Motor Vehicle Accidents",
      "Car Accidents",
      "Truck Accidents",
      "Motorcycle Accidents",
      "Pedestrian Accidents",
      "Rideshare and Taxi Accidents",
    ];
  }
  if (host === "theepsteinlawfirm.com") {
    return [
      "Personal Injury",
      "Auto Accidents",
      "Truck Accidents",
      "Uber and Lyft Accidents",
      "Medical Malpractice",
      "Workers’ Compensation",
      "Workplace Accidents",
      "Nursing Home Negligence",
      "Premises Liability",
      "Product Liability",
      "Construction Accidents",
      "Birth Injuries",
      "Employment Litigation",
      "Civil Litigation",
      "Business Litigation",
      "Real Estate Litigation",
      "Estate Litigation",
      "Professional Malpractice",
    ];
  }
  return Object.keys(verifiedPracticeAreaUrls(website));
}

function mergePracticeAreas(configured: string[], website: string) {
  const merged = [...configured, ...verifiedPracticeAreas(website)];
  return merged.filter((value, index, values) =>
    values.findIndex((item) => item.toLowerCase() === value.toLowerCase()) === index,
  ).slice(0, 200);
}

function cleanStringList(value: unknown, limit: number) {
  return (Array.isArray(value) ? value : [])
    .map((item) => typeof item === "string" ? item.replace(/\s+/g, " ").trim() : "")
    .filter((item, itemIndex, items) =>
      item && items.findIndex((candidate) => candidate.toLowerCase() === item.toLowerCase()) === itemIndex,
    )
    .slice(0, limit);
}

function cleanPositiveInteger(value: unknown) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
}

function cleanPracticeAreaUrls(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([label, url]) => [label.replace(/\s+/g, " ").trim(), validUrl(url)] as const)
      .filter(([label, url]) => Boolean(label && url))
      .slice(0, 200),
  );
}

export function normalizeClientProfile(value: unknown, index = 0): ClientProfile | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const website = validUrl(source.website);
  const verifiedDefaults = verifiedClientDefaults(website);
  const suppliedName = typeof source.name === "string" ? source.name.trim() : "";
  const name = verifiedDefaults?.name || suppliedName;
  const rawId = typeof source.id === "string" ? source.id.trim() : "";
  const id = (rawId || name || `client-${index + 1}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  if (!id || !name || !website) return null;

  const rawLawyers = Array.isArray(source.lawyers) ? source.lawyers : [];
  const lawyers = rawLawyers
    .map((lawyer) => {
      if (!lawyer || typeof lawyer !== "object") return null;
      const item = lawyer as Record<string, unknown>;
      const lawyerName = typeof item.name === "string" ? item.name.trim() : "";
      const imageUrl = validUrl(item.imageUrl);
      return lawyerName && imageUrl ? { name: lawyerName, imageUrl } : null;
    })
    .filter((lawyer): lawyer is LawyerProfile => Boolean(lawyer))
    .slice(0, 3);
  const configuredPracticeAreas = cleanStringList(source.practiceAreas, 200);
  const practiceAreas = mergePracticeAreas(configuredPracticeAreas, website);

  const brandSource = source.brand && typeof source.brand === "object"
    ? source.brand as Record<string, unknown>
    : {};
  const wordpressSource = source.wordpress && typeof source.wordpress === "object"
    ? source.wordpress as Record<string, unknown>
    : null;
  const blogSource = source.blogDefaults && typeof source.blogDefaults === "object"
    ? source.blogDefaults as Record<string, unknown>
    : {};
  const ctaSource = source.cta && typeof source.cta === "object"
    ? source.cta as Record<string, unknown>
    : {};
  const configuredPhoneDisplay = typeof source.phoneDisplay === "string"
    ? source.phoneDisplay.trim()
    : "";
  const phoneDisplay = verifiedDefaults?.phoneDisplay || configuredPhoneDisplay;
  const phoneHrefInput = typeof source.phoneHref === "string"
    ? source.phoneHref.trim()
    : phoneDisplay;
  const wordpressSiteUrl = validUrl(wordpressSource?.siteUrl);
  const username = typeof wordpressSource?.username === "string"
    ? wordpressSource.username.trim()
    : "";
  const applicationPassword = typeof wordpressSource?.applicationPassword === "string"
    ? wordpressSource.applicationPassword.replace(/\s+/g, "")
    : "";

  return {
    id,
    name,
    website,
    reviewerEmail:
      typeof source.reviewerEmail === "string" && source.reviewerEmail.includes("@")
        ? source.reviewerEmail.trim().toLowerCase()
        : "aron@amplifylaw.ai",
    phoneDisplay,
    phoneHref: verifiedDefaults?.phoneHref || cleanPhoneHref(phoneHrefInput),
    locale: source.locale === "es" ? "es" : "en",
    jurisdictions: cleanStringList([
      ...cleanStringList(source.jurisdictions, 80),
      ...(verifiedDefaults?.jurisdictions || []),
    ], 80),
    contactUrl: verifiedDefaults?.contactUrl || validUrl(source.contactUrl) || undefined,
    practiceAreaUrls: {
      ...verifiedPracticeAreaUrls(website),
      ...cleanPracticeAreaUrls(source.practiceAreaUrls),
    },
    practiceAreas,
    lawyers,
    brand: {
      primary: verifiedDefaults?.brand.primary || cleanHex(brandSource.primary, "#151515"),
      secondary: verifiedDefaults?.brand.secondary || cleanHex(brandSource.secondary, "#353535"),
      accent: verifiedDefaults?.brand.accent || cleanHex(brandSource.accent, "#d2b052"),
      surface: verifiedDefaults?.brand.surface || cleanHex(brandSource.surface, "#f7f7f7"),
      logoUrl: verifiedDefaults?.brand.logoUrl || validUrl(brandSource.logoUrl) || undefined,
    },
    blogDefaults: {
      authorId: cleanPositiveInteger(blogSource.authorId),
      categoryId: cleanPositiveInteger(blogSource.categoryId),
      defaultJurisdiction:
        typeof blogSource.defaultJurisdiction === "string"
          ? blogSource.defaultJurisdiction.replace(/\s+/g, " ").trim().slice(0, 160) || undefined
          : undefined,
    },
    cta: {
      consultationText:
        verifiedDefaults?.cta.consultationText || (typeof ctaSource.consultationText === "string"
          ? ctaSource.consultationText.replace(/\s+/g, " ").trim().slice(0, 240) || undefined
          : undefined),
      linkLabel:
        verifiedDefaults?.cta.linkLabel || (typeof ctaSource.linkLabel === "string"
          ? ctaSource.linkLabel.replace(/\s+/g, " ").trim().slice(0, 100) || undefined
          : undefined),
    },
    wordpress: wordpressSiteUrl && username && applicationPassword
      ? {
          siteUrl: wordpressSiteUrl,
          username,
          applicationPassword,
          pageTemplate:
            typeof wordpressSource?.pageTemplate === "string"
              ? wordpressSource.pageTemplate.trim()
              : undefined,
        }
      : undefined,
  };
}

function legacyProfile(): ClientProfile | null {
  const website = validUrl(process.env.WORDPRESS_SITE_URL);
  if (!website) return null;
  const verifiedDefaults = verifiedClientDefaults(website);
  const phoneDisplay = verifiedDefaults?.phoneDisplay || process.env.CTA_PHONE?.trim() || "";
  const lawyerName = process.env.CLIENT_PRIMARY_LAWYER_NAME?.trim() || "";
  const lawyerImageUrl = validUrl(process.env.CLIENT_PRIMARY_LAWYER_IMAGE_URL);
  return {
    id: "default-client",
    name: verifiedDefaults?.name || process.env.CLIENT_NAME?.trim() || new URL(website).hostname.replace(/^www\./, ""),
    website,
    reviewerEmail: process.env.CLIENT_REVIEWER_EMAIL?.trim().toLowerCase() || "aron@amplifylaw.ai",
    phoneDisplay,
    phoneHref: verifiedDefaults?.phoneHref || cleanPhoneHref(process.env.CTA_PHONE_HREF?.trim() || phoneDisplay),
    locale: "en",
    jurisdictions: verifiedDefaults?.jurisdictions || [],
    contactUrl: verifiedDefaults?.contactUrl,
    practiceAreaUrls: {},
    practiceAreas: mergePracticeAreas([], website),
    lawyers: lawyerName && lawyerImageUrl ? [{ name: lawyerName, imageUrl: lawyerImageUrl }] : [],
    brand: {
      primary: verifiedDefaults?.brand.primary || cleanHex(process.env.CLIENT_BRAND_PRIMARY, "#151515"),
      secondary: verifiedDefaults?.brand.secondary || cleanHex(process.env.CLIENT_BRAND_SECONDARY, "#353535"),
      accent: verifiedDefaults?.brand.accent || cleanHex(process.env.CLIENT_BRAND_ACCENT, "#d2b052"),
      surface: verifiedDefaults?.brand.surface || cleanHex(process.env.CLIENT_BRAND_SURFACE, "#f7f7f7"),
      logoUrl: verifiedDefaults?.brand.logoUrl || validUrl(process.env.CLIENT_LOGO_URL) || undefined,
    },
    blogDefaults: {},
    cta: verifiedDefaults?.cta || {},
    wordpress:
      process.env.WORDPRESS_USERNAME && process.env.WORDPRESS_APPLICATION_PASSWORD
        ? {
            siteUrl: website,
            username: process.env.WORDPRESS_USERNAME.trim(),
            applicationPassword: process.env.WORDPRESS_APPLICATION_PASSWORD.replace(/\s+/g, ""),
            pageTemplate: process.env.WORDPRESS_PAGE_TEMPLATE?.trim() || undefined,
          }
        : undefined,
  };
}

function builtInProfiles(): ClientProfile[] {
  const billyWordPressUsername = process.env.BILLY_COOPER_WORDPRESS_USERNAME?.trim() || "";
  const billyWordPressApplicationPassword =
    process.env.BILLY_COOPER_WORDPRESS_APPLICATION_PASSWORD?.replace(/\s+/g, "") || "";
  return [
    {
      id: "billy-cooper-law",
      name: "Billy Cooper Law",
      website: "https://www.billycooperlaw.com",
      reviewerEmail: "aron@amplifylaw.ai",
      phoneDisplay: "(914) 730-5789",
      phoneHref: "+19147305789",
      locale: "en",
      jurisdictions: [
        "New York State",
        "New York City",
        "New York County",
        "Bronx County",
        "Queens County",
        "Kings County",
        "Westchester County",
        "Rockland County",
      ],
      contactUrl: "https://www.billycooperlaw.com/contact-us/",
      practiceAreaUrls: {
        "Personal Injury": "https://www.billycooperlaw.com/practice-areas/",
      },
      practiceAreas: [
        "Personal Injury",
        "Car Accidents",
        "Construction Accidents",
        "Nursing Home Abuse",
        "Medical Malpractice",
        "E-Bike Accidents",
        "Slip and Fall",
        "Uber and Lyft Accidents",
        "Pedestrian Accidents",
        "Premises Liability",
        "Wrongful Death",
        "Birth Injuries",
        "Defective Products",
      ],
      lawyers: [],
      brand: {
        primary: "#17312d",
        secondary: "#244e45",
        accent: "#d5f443",
        surface: "#f2f6f3",
      },
      blogDefaults: {
        defaultJurisdiction: "New York State",
      },
      cta: {
        consultationText: "Tell us what happened. Billy Cooper Law will listen, explain the issues, and help you understand your options.",
        linkLabel: "Learn about personal injury cases",
      },
      wordpress: billyWordPressUsername && billyWordPressApplicationPassword
        ? {
            siteUrl: "https://www.billycooperlaw.com",
            username: billyWordPressUsername,
            applicationPassword: billyWordPressApplicationPassword,
          }
        : undefined,
    },
  ];
}

export function clientProfiles() {
  const profiles: ClientProfile[] = [];
  const raw = process.env.AMPLIFY_CLIENTS_JSON?.trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        profiles.push(...parsed
          .map(normalizeClientProfile)
          .filter((profile): profile is ClientProfile => Boolean(profile)));
      }
    } catch {
      // The status endpoint reports an empty client list when configuration is invalid.
    }
  }
  const legacy = legacyProfile();
  if (legacy) {
    const legacyHost = new URL(legacy.website).hostname.replace(/^www\./, "").toLowerCase();
    const existingIndex = profiles.findIndex((profile) => {
      const host = new URL(profile.website).hostname.replace(/^www\./, "").toLowerCase();
      return host === legacyHost;
    });
    if (existingIndex === -1) {
      profiles.push(legacy);
    } else if (!profiles[existingIndex].wordpress && legacy.wordpress) {
      profiles[existingIndex] = {
        ...profiles[existingIndex],
        wordpress: legacy.wordpress,
      };
    }
  }
  for (const builtIn of builtInProfiles()) {
    const builtInHost = new URL(builtIn.website).hostname.replace(/^www\./, "").toLowerCase();
    const existingIndex = profiles.findIndex((profile) => {
      const host = new URL(profile.website).hostname.replace(/^www\./, "").toLowerCase();
      return profile.id === builtIn.id || host === builtInHost;
    });
    if (existingIndex === -1) {
      profiles.push(builtIn);
    } else if (
      (!profiles[existingIndex].wordpress && builtIn.wordpress) ||
      (!profiles[existingIndex].practiceAreas.length && builtIn.practiceAreas.length)
    ) {
      profiles[existingIndex] = {
        ...profiles[existingIndex],
        wordpress: profiles[existingIndex].wordpress || builtIn.wordpress,
        practiceAreas: profiles[existingIndex].practiceAreas.length
          ? profiles[existingIndex].practiceAreas
          : builtIn.practiceAreas,
      };
    }
  }
  return profiles;
}

export function getClientProfile(clientId?: string, website?: string) {
  const profiles = clientProfiles();
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
    if (exact) {
      const exactHost = new URL(exact.website).hostname.replace(/^www\./, "").toLowerCase();
      if (!requestedHost || exactHost === requestedHost) return exact;
      return null;
    }
    return null;
  }
  if (requestedHost) {
    return profiles.find(
      (profile) => new URL(profile.website).hostname.replace(/^www\./, "").toLowerCase() === requestedHost,
    ) || null;
  }
  return profiles.length === 1 ? profiles[0] : null;
}

export function publicClientProfile(profile: ClientProfile): PublicClientProfile {
  const { wordpress, ...safe } = profile;
  return {
    ...safe,
    wordpress: wordpress ? {
      siteUrl: wordpress.siteUrl,
      username: wordpress.username,
      pageTemplate: wordpress.pageTemplate,
      passwordConfigured: Boolean(wordpress.applicationPassword),
    } : undefined,
    wordpressReady: Boolean(wordpress),
    assetsReady: Boolean(profile.phoneDisplay && profile.phoneHref && profile.lawyers.length),
  };
}
