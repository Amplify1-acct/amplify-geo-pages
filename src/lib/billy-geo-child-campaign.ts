export type BillyGeoChildService = {
  key: "e-bike" | "car" | "slip-and-fall";
  practiceArea: string;
  directoryLabel: string;
  existingPageId?: number;
  existingUrl?: string;
};

export type BillyGeoChildParent = {
  county: string;
  location: string;
  pageId: number;
  pageUrl: string;
  services?: Partial<Record<BillyGeoChildService["key"], Pick<BillyGeoChildService, "existingPageId" | "existingUrl">>>;
};

export const BILLY_GEO_CHILD_SERVICE_TEMPLATES = [
  { key: "e-bike", practiceArea: "E-Bike Accident Lawyer", directoryLabel: "E-Bike Accidents" },
  { key: "car", practiceArea: "Car Accident Lawyer", directoryLabel: "Car Accidents" },
  { key: "slip-and-fall", practiceArea: "Slip and Fall Lawyer", directoryLabel: "Slip and Fall Accidents" },
] as const satisfies ReadonlyArray<Omit<BillyGeoChildService, "existingPageId" | "existingUrl">>;

// These are the first five English-language local markets listed on each live
// Billy Cooper county Personal Injury page. White Plains is the site's home page.
export const BILLY_GEO_CHILD_PARENTS: BillyGeoChildParent[] = [
  { county: "New York County", location: "Manhattan", pageId: 7582, pageUrl: "https://www.billycooperlaw.com/manhattan-ny-personal-injury/" },
  { county: "New York County", location: "Upper East Side", pageId: 7588, pageUrl: "https://www.billycooperlaw.com/upper-east-side-ny-personal-injury/" },
  { county: "New York County", location: "Upper West Side", pageId: 7585, pageUrl: "https://www.billycooperlaw.com/upper-west-side-ny-personal-injury/" },
  { county: "New York County", location: "Washington Heights", pageId: 7594, pageUrl: "https://www.billycooperlaw.com/washington-heights-ny-personal-injury/" },
  { county: "New York County", location: "Harlem", pageId: 7597, pageUrl: "https://www.billycooperlaw.com/harlem-ny-personal-injury/" },

  {
    county: "Westchester County",
    location: "Yonkers",
    pageId: 6649,
    pageUrl: "https://www.billycooperlaw.com/westchester-county/yonkers/",
    services: {
      "e-bike": { existingPageId: 7126, existingUrl: "https://www.billycooperlaw.com/yonkers-ny-e-bike-accident-lawyer/" },
      car: { existingPageId: 7117, existingUrl: "https://www.billycooperlaw.com/yonkers-ny-car-accident-lawyer/" },
      "slip-and-fall": { existingPageId: 7113, existingUrl: "https://www.billycooperlaw.com/yonkers-ny-slip-and-fall-lawyer/" },
    },
  },
  { county: "Westchester County", location: "Greenburgh", pageId: 6837, pageUrl: "https://www.billycooperlaw.com/westchester-county/greenburgh/" },
  {
    county: "Westchester County",
    location: "New Rochelle",
    pageId: 6654,
    pageUrl: "https://www.billycooperlaw.com/westchester-county/new-rochelle/",
    services: {
      car: { existingPageId: 5136, existingUrl: "https://www.billycooperlaw.com/motor-vehicle-accidents/new-rochelle-car-accident-lawyer/" },
    },
  },
  { county: "Westchester County", location: "Mount Vernon", pageId: 6657, pageUrl: "https://www.billycooperlaw.com/westchester-county/mount-vernon/" },
  {
    county: "Westchester County",
    location: "White Plains",
    pageId: 21,
    pageUrl: "https://www.billycooperlaw.com/",
    services: {
      "e-bike": { existingPageId: 3961, existingUrl: "https://www.billycooperlaw.com/motor-vehicle-accidents/e-bike-accidents/" },
      car: { existingPageId: 3940, existingUrl: "https://www.billycooperlaw.com/car-accident-lawyer/" },
    },
  },

  { county: "Bronx County", location: "Co-op City", pageId: 6700, pageUrl: "https://www.billycooperlaw.com/bronx-county/co-op-city/" },
  { county: "Bronx County", location: "Kingsbridge", pageId: 6703, pageUrl: "https://www.billycooperlaw.com/bronx-county/kingsbridge/" },
  { county: "Bronx County", location: "Soundview", pageId: 6706, pageUrl: "https://www.billycooperlaw.com/bronx-county/soundview/" },
  { county: "Bronx County", location: "Riverdale", pageId: 6709, pageUrl: "https://www.billycooperlaw.com/bronx-county/riverdale/" },
  { county: "Bronx County", location: "Fordham", pageId: 6712, pageUrl: "https://www.billycooperlaw.com/bronx-county/fordham/" },

  { county: "Rockland County", location: "Ramapo", pageId: 6728, pageUrl: "https://www.billycooperlaw.com/rockland-county/ramapo/" },
  { county: "Rockland County", location: "Clarkstown", pageId: 6730, pageUrl: "https://www.billycooperlaw.com/rockland-county/clarkstown/" },
  { county: "Rockland County", location: "Haverstraw", pageId: 6732, pageUrl: "https://www.billycooperlaw.com/rockland-county/haverstraw/" },
  { county: "Rockland County", location: "New City", pageId: 6734, pageUrl: "https://www.billycooperlaw.com/rockland-county/new-city/" },
  { county: "Rockland County", location: "Spring Valley", pageId: 6736, pageUrl: "https://www.billycooperlaw.com/rockland-county/spring-valley/" },

  { county: "Queens County", location: "Murray Hill–Broadway Flushing", pageId: 7177, pageUrl: "https://www.billycooperlaw.com/queens-county-ny-personal-injury-lawyer/personal-injury-lawyer-serving-murray-hill-broadway-flushing-ny-2/" },
  { county: "Queens County", location: "Jamaica", pageId: 7178, pageUrl: "https://www.billycooperlaw.com/queens-county-ny-personal-injury-lawyer/jamaica-ny-personal-injury-lawyer-2/" },
  { county: "Queens County", location: "Ridgewood", pageId: 7179, pageUrl: "https://www.billycooperlaw.com/queens-county-ny-personal-injury-lawyer/ridgewood-ny-personal-injury-lawyer-2/" },
  { county: "Queens County", location: "Flushing–Willets Point", pageId: 7180, pageUrl: "https://www.billycooperlaw.com/queens-county-ny-personal-injury-lawyer/flushing-willets-point-ny-personal-injury-lawyer-2/" },
  { county: "Queens County", location: "Corona", pageId: 7181, pageUrl: "https://www.billycooperlaw.com/queens-county-ny-personal-injury-lawyer/corona-ny-personal-injury-lawyers-2/" },

  { county: "Kings County (Brooklyn)", location: "Bedford-Stuyvesant", pageId: 6788, pageUrl: "https://www.billycooperlaw.com/kings-county-brooklyn/bedford-stuyvesant/" },
  { county: "Kings County (Brooklyn)", location: "Bushwick", pageId: 6790, pageUrl: "https://www.billycooperlaw.com/kings-county-brooklyn/bushwick/" },
  { county: "Kings County (Brooklyn)", location: "Crown Heights", pageId: 6792, pageUrl: "https://www.billycooperlaw.com/kings-county-brooklyn/crown-heights/" },
  { county: "Kings County (Brooklyn)", location: "Flatbush", pageId: 6794, pageUrl: "https://www.billycooperlaw.com/kings-county-brooklyn/flatbush/" },
  { county: "Kings County (Brooklyn)", location: "Williamsburg", pageId: 6796, pageUrl: "https://www.billycooperlaw.com/kings-county-brooklyn/williamsburg/" },
];

export const BILLY_GEO_CHILD_PARENT_IDS = new Set(BILLY_GEO_CHILD_PARENTS.map((parent) => parent.pageId));

export function billyGeoChildCampaignItems() {
  return BILLY_GEO_CHILD_PARENTS.flatMap((parent) => BILLY_GEO_CHILD_SERVICE_TEMPLATES.map((service) => {
    const existing = parent.services?.[service.key];
    return {
      ...parent,
      ...service,
      ...existing,
      primaryKeyword: `${parent.location} ${service.practiceArea}`,
      notes: [
        `This is a focused GEO child page beneath the existing ${parent.location} Personal Injury page in the ${parent.county} campaign.`,
        `Cover only ${service.directoryLabel.toLowerCase()} in ${parent.location}, New York; do not turn this into a broad personal-injury overview.`,
        `Recommend one natural internal link to the verified parent page: ${parent.pageUrl}`,
        "Do not include the broad county/city directory on this child page.",
        "Use local, person-centered guidance, verified legal rules and useful government or medical sources. Never invent local facts.",
      ].join(" "),
    };
  }));
}
