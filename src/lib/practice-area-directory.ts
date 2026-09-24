export type PracticeAreaUrls = Record<string, string>;

const VERIFIED_PRACTICE_AREA_URLS: Record<string, PracticeAreaUrls> = {
  "pbglaw.com": {
    "Mass Torts": "https://www.pbglaw.com/mass-tort-lawyer/",
    "Medical Malpractice": "https://www.pbglaw.com/florida-medical-malpractice-lawyer/",
    "Birth Injury": "https://www.pbglaw.com/florida-birth-injury-lawyer/",
    "Nursing Home Abuse": "https://www.pbglaw.com/florida-nursing-home-abuse-lawyer/",
    "Trucking Accident Litigation": "https://www.pbglaw.com/florida-truck-accident-lawyer/",
    "Insurance/Bad Faith Litigation": "https://www.pbglaw.com/florida-insurance-litigation-lawyer/",
    "Personal Injury": "https://www.pbglaw.com/florida-personal-injury-lawyer/",
    "Commercial Litigation": "https://www.pbglaw.com/florida-commercial-litigation-lawyer/",
  },
};

function websiteHost(website: string) {
  try {
    return new URL(website).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export function verifiedPracticeAreaUrls(website: string): PracticeAreaUrls {
  return { ...(VERIFIED_PRACTICE_AREA_URLS[websiteHost(website)] || {}) };
}
