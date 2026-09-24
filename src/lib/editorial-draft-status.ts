import { contentWorkflow, type WorkflowRecord } from "./content-workflow";
import type { EditorialSlot, EditorialSlotStatus } from './editorial';
export function editorialDraftStatus(slot: EditorialSlot, record?: {status?:string;docUrl?:string;wordpressStatus?:string}): EditorialSlotStatus {
 if(record?.wordpressStatus==='publish')return 'published';
 if(record?.wordpressStatus==='future')return 'scheduled';
 if(record?.wordpressStatus==='draft')return 'wordpress_draft';
 if(record?.status==='published'&&!record?.wordpressStatus)return 'published';
 if(record?.docUrl)return 'review';
 if(slot.generationState==='running'&&Date.now()-Date.parse(slot.generationCheckedAt||'')<120000)return 'drafting';
 if(slot.generationState==='failed')return 'error';
 if(record?.status==='error')return 'error';
 if(record?.status==='generating')return 'drafting';
 if(slot.status==='drafting'&&!record)return 'error';
 return slot.status;
}

export function editorialActionGroup(slot: EditorialSlot, record?: Parameters<typeof editorialDraftStatus>[1]) {
 const status=editorialDraftStatus(slot,record);
 if(!slot.selectedTopic && ['topic_selection','error'].includes(status))return 'topic';
 if(slot.selectedTopic && ['selected','drafting','error'].includes(status))return 'writing';
 return null;
}
export function editorialStatusLabel(slot: EditorialSlot, record?: Parameters<typeof editorialDraftStatus>[1] & WorkflowRecord) {
 const status=editorialDraftStatus(slot,record);
 if(status==='published'&&Date.parse(slot.publishAt)>Date.now())return 'Published — before assigned date';
 if(status==='scheduled'&&Date.parse(slot.publishAt)<Date.now())return 'Scheduled time passed — check WordPress';
 if(status==='wordpress_draft')return contentWorkflow({...record,wordpressStatus:'draft'}).label;
 if(status==='review'&&record)return contentWorkflow(record).label;
 return {topic_selection:'Choose a topic',selected:'Ready to write',drafting:'Writing in progress',review:'With reviewer',scheduled:'Scheduled',published:'Published',skipped:'Skipped',error:'Needs attention'}[status];
}
