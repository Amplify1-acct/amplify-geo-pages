import { getClientProfileAsync } from '@/lib/client-store';
import RecoveryControl from './recovery-control';
import { uploadLease } from '@/lib/wordpress-upload-store';
import { editorialDraftStatus, editorialStatusLabel } from '@/lib/editorial-draft-status';
import { NextRequest } from 'next/server';
import { GET as trackerGet, PUT as trackerPut } from '@/app/api/tracker/route';
import { GET as generateGet } from '@/app/api/generate/route';
import { getEditorialSlot, saveEditorialSlot } from '@/lib/editorial-store';
import { getGoogleAccessToken, getGoogleEmail } from '@/lib/google';
import { isAronReviewer } from '@/lib/aron-review-queue';
import { revalidatePath } from 'next/cache';
export const dynamic='force-dynamic';
export const maxDuration=300;
async function load(id:string){
 const token=await getGoogleAccessToken();if(!isAronReviewer(await getGoogleEmail(token)))throw new Error('Authorized reviewer required.');
 const slot=await getEditorialSlot(id);if(!slot)throw new Error('Slot missing.');
 const response=await trackerGet(new NextRequest('https://amplify-geo-pages.vercel.app/api/tracker'));const data=await response.json();if(!response.ok)throw new Error(data.error);
 const records=data.records as Array<Record<string,unknown>>;
 const record=records.find(r=>r.id===slot.contentRecordId||r.editorialSlotId===id);
 return {slot,records,record};
}
async function performRecovery(id:string){
 const {slot,records,record}=await load(id);
 if(record?.docUrl||record?.wordpressPageId){await saveEditorialSlot({...slot,status:record.wordpressStatus==='publish'?'published':record.wordpressStatus==='future'?'scheduled':record.wordpressPageId?'wordpress_draft':'review',error:undefined});return;}
 const jobId=String(record?.jobId||slot.generationJobId||'');
 if(!jobId){await saveEditorialSlot({...slot,status:'error',generationState:'failed',generationCheckedAt:new Date().toISOString(),error:'No saved writing job was found. Reopen the selected brief to create the draft.'});return;}
 const response=await generateGet(new NextRequest(`https://amplify-geo-pages.vercel.app/api/generate?jobId=${encodeURIComponent(jobId)}`));
 const data=await response.json();
 if(!response.ok){await saveEditorialSlot({...slot,status:'error',generationState:'failed',generationCheckedAt:new Date().toISOString(),error:data.error||'The writing job could not be recovered.'});return;}
 if(data.status!=='completed'){await saveEditorialSlot({...slot,status:'drafting',generationState:'running',generationCheckedAt:new Date().toISOString(),error:undefined});return;}
 const token=await getGoogleAccessToken();
 const actualClient=await getClientProfileAsync(data.clientId,undefined,token);
 const expectedHost=new URL(slot.website).hostname.replace(/^www\./,'').toLowerCase();
 const actualHost=actualClient?new URL(actualClient.website).hostname.replace(/^www\./,'').toLowerCase():'';
 if(!data.doc?.id||!data.doc?.url||actualHost!==expectedHost){
 await saveEditorialSlot({...slot,status:'error',generationState:'failed',error:`The saved job belongs to ${actualClient?.name||data.clientId||'an unknown client'} (${data.doc?.name||'no document'}), not this selected brief. A new draft is required.`});return;
 }
 const latest=await load(id);
 const saved={...record,id:record?.id||crypto.randomUUID(),workflow:'blog',clientId:slot.clientId,clientName:slot.clientName,website:slot.website,practiceArea:slot.selectedTopic,blogPracticeArea:slot.practiceArea,jurisdiction:slot.jurisdiction,editorialSlotId:id,scheduledPublishAt:slot.publishAt,status:'review',docId:data.doc.id,docUrl:data.doc.url,docName:data.doc.name,wordCount:data.wordCount,aronDone:false,createdAt:record?.createdAt||slot.createdAt,updatedAt:new Date().toISOString(),error:undefined};
 const put=await trackerPut(new NextRequest('https://amplify-geo-pages.vercel.app/api/tracker',{method:'PUT',body:JSON.stringify([...latest.records.filter(r=>r.id!==saved.id),saved])}));
 if(!put.ok)throw new Error('Recovered draft could not be saved.');
 await saveEditorialSlot({...slot,contentRecordId:String(saved.id),status:'review',generationState:'completed',error:undefined,updatedAt:new Date().toISOString()});
 revalidatePath('/editorial-calendar/recover');
}
async function recover(id:string){
 'use server';
 const release=await uploadLease(`editorial-recovery:${id}`);if(!release)return;
 try { await performRecovery(id); }
 catch(e){const slot=await getEditorialSlot(id);if(slot)await saveEditorialSlot({...slot,status:'error',generationState:'failed',error:e instanceof Error?e.message:'Draft recovery failed.'});}
 finally { await release(); revalidatePath('/editorial-calendar/recover'); revalidatePath('/editorial-calendar'); }
}
export default async function Page({searchParams}:{searchParams:Promise<{slot:string}>}){
 const {slot:id}=await searchParams;const {slot,record}=await load(id);
 const brief='/?'+new URLSearchParams({workflow:'blog',editorialSlotId:id,clientId:slot.clientId,practiceArea:slot.practiceArea,topic:slot.selectedTopic||'',jurisdiction:slot.jurisdiction,publishAt:slot.publishAt});
 return <main style={{padding:40}}><a href="/editorial-calendar">← Editorial calendar</a><h1>{slot.selectedTopic}</h1><p>{slot.clientName} · Assigned: {slot.publishAt}</p><p>Status: {editorialStatusLabel(slot, record)}</p>{slot.error&&<p role="alert">{slot.error}</p>}{record?.docUrl?<a href={String(record.docUrl)}>Open Google Doc</a>:<><p>Check the original writing job before starting another draft.</p><RecoveryControl action={recover.bind(null,id)} running={slot.generationState==='running'} />{slot.status==='error'&&slot.generationState!=='running'&&<p><a href={brief}>Reopen selected blog brief</a></p>}</>}</main>;
}
