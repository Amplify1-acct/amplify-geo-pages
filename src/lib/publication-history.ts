import {isPublishedContent} from './content-workflow';
type HistoryRecord = {id?:string;wordpressStatus?:string;published?:boolean;status?:string;reviewDeletedAt?:string;wordpressPublishedAt?:string;finalApprovedAt?:string;reviewArchivedAt?:string;reviewArchiveReason?:string};
export function publicationHistory<T extends HistoryRecord>(tracker:T[],shared:T[]) {
 const records=new Map(tracker.map(r=>[r.id,r]));
 for(const r of shared) records.set(r.id,{...records.get(r.id),...r});
 return [...records.values()].filter(r=>!r.reviewDeletedAt&&isPublishedContent(r));
}
export function publicationDate(r:HistoryRecord) {
 const choices:[string|undefined,string][]=[
  [r.wordpressPublishedAt,'Published'],
  [r.finalApprovedAt,'Approved for publication'],
  [r.reviewArchiveReason==='published'?r.reviewArchivedAt:undefined,'Publication recorded'],
 ];
 for(const [value,label] of choices){const time=Date.parse(value||'');if(Number.isFinite(time))return {time,label};}
 return {time:0,label:'Published · date not recorded'};
}
