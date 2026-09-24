import type { ClientProfile } from "@/lib/clients";
import { inferStateAbbreviation, stripStateSuffix } from "@/lib/location";

// Only AOP/Sub-AOP page titles use this parser, never question-style blog titles.
export function aopCtaLocation(pageTitle:string,practiceArea:string,fallback:string,client:ClientProfile) {
  const title=pageTitle.split(/\s+[|–—]\s+/)[0].trim();
  const topics=[practiceArea,...client.practiceAreas].filter(Boolean).sort((a,b)=>b.length-a.length);
  let place="";
  for(const topic of topics) {
    const escaped=topic.replace(/\s+(?:lawyers?|attorneys?)$/i,"").replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
    const suffix=title.match(new RegExp(`^${escaped}(?: lawyers?| attorneys?)? (?:in|near|serving) (.+)$`,"i"));
    const prefix=title.match(new RegExp(`^(.+?) ${escaped}(?: lawyers?| attorneys?)?$`,"i"));
    if(suffix||prefix){place=(suffix||prefix)![1].trim();break;}
  }
  if(!place)return fallback;
  const city=stripStateSuffix(place).replace(/,\s*$/,"").trim();
  const state=inferStateAbbreviation(`${title}\n${fallback}`,client.jurisdictions,city);
  if(!city||!state)throw new Error("The AOP page's CTA location needs a verified city and state. Add the state to the approved title before uploading.");
  return `${city} ${state}`;
}
