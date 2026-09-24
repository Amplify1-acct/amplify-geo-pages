"use client";
import { useState } from "react";
import Link from "next/link";
import type { AronReviewItem } from "@/lib/aron-review-queue";
const documents = [
 "1cxCITfDTSekO2ECxdaNMjiByZEKtsJ9_cj_pameH5BY",
 "1Fa0QjWVRUAg6CA5iinM9IakjfqWJY8OUTV-N0sd2mZw",
 "1bEINcJV--5pS9DqyURc1PoO4KYNYxHpCAnzsob_jiy4",
 "1AMAoNn2dDEBU_DQaxAvEdd3V8ulx66FnF92br_cD-bE",
 "1luj_Sa8EloJgeVn7V6G157C5aOfamiitZ82_B2UGayw",
];
type Result = { planned?: string; id: string; title: string; state: string; error?: string; previewUrl?: string; featuredImageUrl?: string; warning?: string };
export default function BlogPreparation() {
 const [results,setResults]=useState<Result[]>([]);
 const [running,setRunning]=useState(false);
 const [error,setError]=useState("");
 async function prepare(onlyId?: string) {
  const selectedDocuments = onlyId ? documents.filter(id=>id===onlyId) : documents;
  setRunning(true);setError("");
  try {
   const response=await fetch('/api/aron/review-queue',{cache:'no-store'});
   const queue=await response.json();
   if(!response.ok)throw new Error(queue.error||'Could not load approved articles.');
   const targets=selectedDocuments.map(id=>(queue.records as AronReviewItem[]).find(r=>r.docUrl.includes(`/d/${id}/`)));
   if(targets.some(r=>!r || !(r.aronDone||r.approvalStatus==='APPROVED') || r.wordpressStatus!=='draft'))throw new Error('All five articles must still be approved WordPress drafts. Check their current statuses.');
   const rows=targets as AronReviewItem[];
   const calendarResponse = await fetch("/api/editorial", {cache:"no-store"});
   const calendar = await calendarResponse.json();
   if (!calendarResponse.ok) throw new Error(calendar.error || "Could not read the assigned calendar slots.");
   const slots = rows.map(r => (calendar.slots as {contentRecordId?:string;clientId:string;publishAt:string}[]).find(s=>s.contentRecordId===r.id && s.clientId===r.clientId));
   if (slots.some(s=>!s)) throw new Error("An assigned calendar slot could not be verified. Preparation paused.");
   setResults(rows.map((r,i)=>({id:selectedDocuments[i],title:r.primaryKeyword||r.docName||r.docUrl,state:'Waiting',planned:slots[i]?.publishAt})));
   for(let i=0;i<rows.length;i++) {
    const record=rows[i];const id=selectedDocuments[i];
    setResults(rs=>rs.map(r=>r.id===id?{...r,state:'Preparing draft'}:r));
    try {
     const draftResponse=await fetch('/api/wordpress/draft',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...record,docId:id,aronApproved:true,approvedImageReviewId:record.pendingImageReviewId})});
     const draft=await draftResponse.json();
     if(!draftResponse.ok||!draft.ok)throw new Error(draft.error||'Draft preparation failed.');
     const saveResponse=await fetch('/api/aron/review-queue',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:record.id,action:'wordpress-draft',result:draft})});
     if(!saveResponse.ok)throw new Error('WordPress saved the draft; review status could not be updated.');
     setResults(rs=>rs.map(r=>r.id===id?{...r,state:'Draft saved — verification pending',previewUrl:draft.previewUrl,featuredImageUrl:draft.featuredImageUrl,warning:draft.warning}:r));
    }catch(e){setResults(rs=>rs.map(r=>r.id===id?{...r,state:'Needs attention',error:e instanceof Error?e.message:String(e)}:r));}
   }
  }catch(e){setError(e instanceof Error?e.message:String(e));}
  finally{setRunning(false);}
 }
 return <main style={{maxWidth:1000,margin:'60px auto',padding:24}}><Link href="/">Content dashboard</Link><h1>Prepare the five approved blog drafts</h1><p>Save a backup, prepare the WordPress draft, and report the result. Final publication approval is a separate step.</p><button disabled={running} onClick={()=>void prepare()}>{running?'Preparation running…':'Prepare five drafts'}</button><button disabled={running} onClick={()=>void prepare(documents[0])}>Prepare Epstein government draft</button><button disabled={running} onClick={()=>void prepare(documents[1])}>Prepare Epstein PIP draft</button>{documents.slice(2).map((id,i)=><button key={id} disabled={running} onClick={()=>void prepare(id)}>Prepare {i===0?"Fulginiti":i===1?"Drazen":"Angiuli"} draft</button>)}{error&&<p role="alert">{error}</p>}{results.map(r=><article key={r.id} style={{padding:'24px 0',borderBottom:'1px solid #ddd'}}><h2>{r.title}</h2><p>{r.state}</p>{r.planned&&<p>Assigned calendar slot: {new Date(r.planned).toLocaleString("en-US",{timeZone:"America/New_York"})} Eastern</p>}{r.error&&<p role="alert">{r.error}</p>}{r.warning&&<p>{r.warning}</p>}{r.previewUrl&&<a href={r.previewUrl} target="_blank" rel="noreferrer">Review WordPress draft</a>}{r.featuredImageUrl&&<p><a href={r.featuredImageUrl} target="_blank" rel="noreferrer">Review featured image</a></p>}</article>)}</main>;
}
