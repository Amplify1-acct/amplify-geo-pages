// Selection intent does not replace the actual practice-area subject.
// Generation and image review must receive this same scene.
export function contentImagePlan(primarySignals: string, topicSignals = primarySignals) {
  primarySignals = primarySignals.toLowerCase();
  topicSignals = topicSignals.toLowerCase();
  const visualPlans = [
    {
      matches: /\b(truck(?:ing)? evidence|evidence after (?:a )?(?:truck|trucking)|black box|event data recorder|electronic logging|driver logs?|dashcam|crash reconstruction)\b/,
      scene: "a full-size unbranded commercial tractor-trailer stopped safely on a roadway shoulder while a crash-reconstruction investigator photographs tire marks from a distance; use a solid featureless trailer and frame the bumper, plate area, cab door, road signs, paperwork, and screens completely out of view",
      alt: "Commercial truck and crash-reconstruction investigator documenting roadway evidence",
    },
    {
      matches: /\b(e-?bike|bicycle|cyclist|bike crash)\b/,
      scene: "a realistic cyclist or e-bike rider traveling through an ordinary street environment with nearby vehicles, without depicting a collision",
      alt: "Cyclist sharing a street with nearby vehicles",
    },
    {
      matches: /\b(semi|tractor[- ]trailer|18[- ]wheeler|truck accident|commercial truck)\b/,
      scene: "a commercial truck and passenger vehicles sharing a realistic roadway, with safe spacing and no collision",
      alt: "Commercial truck and passenger vehicles sharing a roadway",
    },
    {
      matches: /\b(uber|lyft|rideshare|ride[- ]share)\b/,
      scene: "a passenger meeting a rideshare vehicle at a curb in a recognizable everyday streetscape, with no logos or readable app screens",
      alt: "Passenger meeting a rideshare vehicle at a curb",
    },
    {
      matches: /\b(motorcycle|motorcyclist)\b/,
      scene: "a helmeted motorcyclist riding near passenger vehicles on a realistic roadway, without depicting a collision",
      alt: "Motorcyclist riding near passenger vehicles",
    },
    {
      matches: /\b(pedestrian|crosswalk|walking)\b/,
      scene: "a pedestrian using a marked crosswalk while vehicles wait at a realistic intersection, with no identifiable face",
      alt: "Pedestrian crossing at a marked intersection",
    },
    {
      matches: /\b(car accident|auto accident|vehicle accident|motor vehicle|traffic collision|car crash)\b/,
      scene: "a close perpendicular side view of a plain passenger sedan with a modest dent in its middle door panel, stopped in a quiet roadside pull-off. Frame only the middle side panel and side windows, with every bumper, grille, wheel hub, manufacturer emblem and license plate entirely outside the frame. No people or moving traffic. Locally plausible buildings and vegetation softly out of focus, with no signs or lettering",
      alt: "Passenger-car door panel with a modest dent after a collision",
    },
    {
      matches: /\b(slip|trip|premises|property hazard|fall accident)\b/,
      scene: "a realistic walkway, store aisle, or property entrance with one clearly visible maintenance hazard and no injured person",
      alt: "Property walkway with a visible maintenance hazard",
    },
    {
      matches: /\b(medical malpractice|birth injury|hospital negligence|surgical error|misdiagnosis)\b/,
      scene: "a calm modern clinical environment with medical professionals reviewing care information, with no readable records and no identifiable patient",
      alt: "Medical professionals reviewing information in a clinical setting",
    },
    {
      matches: /\b(nursing home|bed sore|elder abuse|assisted living)\b/,
      scene: "a bright, well-maintained long-term care environment with a caregiver in the distance and no identifiable resident or visible injury",
      alt: "Caregiver in a long-term care environment",
    },
    {
      matches: /\b(construction|scaffold|worksite|jobsite)\b/,
      scene: "an active construction site with clearly visible safety equipment and workers shown only at a distance",
      alt: "Construction site with safety equipment",
    },
    {
      matches: /\b(defective product|product liability|dangerous product|product recall)\b/,
      scene: "a neutral product-inspection workspace where a technician examines an unbranded mechanical component",
      alt: "Technician examining a mechanical component",
    },
    {
      matches: /\b(dog bite|dog attack)\b/,
      scene: "a leashed dog and owner in an ordinary public setting, calm and separated from other people, without depicting an attack",
      alt: "Leashed dog and owner in a public setting",
    },
    {
      matches: /\b(wrongful death|fatal accident|fatal crash)\b/,
      scene: "a quiet, respectful consultation setting with two empty chairs and warm natural light, suggesting support without depicting grief",
      alt: "Quiet consultation setting with two chairs",
    },
    {
      matches: /\bpersonal injury\b/,
      scene: "a close documentary photograph of a damaged concrete pedestrian walkway with one clearly raised, broken slab edge as the central subject, in an ordinary locally plausible residential setting. Show the uneven walking surface and a small amount of surrounding building frontage and vegetation; keep all vehicles, people, signs, building numbers and branded objects entirely outside the frame. Natural daylight, realistic materials, no staged accident",
      alt: "Uneven concrete pedestrian walkway with a raised broken slab edge",
    },
    {
      matches: /\b(insurance claim|insurance company|claim denied|adjuster)\b/,
      scene: "a realistic claim-review workspace with a phone, vehicle key, and unbranded paperwork whose text is not visible",
      alt: "Claim review workspace with a phone and vehicle key",
    },
  ];
  return visualPlans.find(candidate => candidate.matches.test(primarySignals))
    || visualPlans.find(candidate => candidate.matches.test(topicSignals))
    || { scene: "one realistic, ordinary environment or object that directly represents the article's specific practical problem, chosen from the title and article context", alt: "Editorial scene representing the article topic" };
}

// A broad composition must never undo exclusions in the topic-specific scene.
export function contentImageComposition(scene: string, variation: string) {
  return `Required framing: ${scene}. Follow this scene's camera angle, crop and exclusions first. Within those limits only, use ${variation}. Never widen the view to reintroduce excluded subjects or surfaces.`;
}
