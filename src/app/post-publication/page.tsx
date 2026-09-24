"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
type Job={pageId:number;state:string;changedUrls:string[];pending:string[]};
export default function PostPublication(){
  const [clients,setClients]=useState<{id:string;name:string}[]>([]),[clientId,setClientId]=useState("");
  const [ids,setIds]=useState(""),[workflow,setWorkflow]=useState("create"),[jobs,setJobs]=useState<Job[]>([]),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  useEffect(()=>{fetch('/api/clients').then(r=>r.json()).then(d=>setClients(d.clients)).catch(()=>setError('Client list unavailable.'));},[]);
  const pageIds=()=>[...new Set(ids.split(/[\s,]+/).filter(Boolean).map(Number))].filter(n=>Number.isInteger(n)&&n>0);
  async function run(queue:boolean){setBusy(true);setError("");try{
    const results:Job[]=[];
    for(const pageId of pageIds()){
      const response=await fetch(queue?'/api/wordpress/post-publication':`/api/wordpress/post-publication?clientId=${encodeURIComponent(clientId)}&pageId=${pageId}&endpoint=${workflow==='blog'?'posts':'pages'}`,queue?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId,pageId,workflow,reset:true})}:{cache:'no-store'});
      const data=await response.json();if(!response.ok)throw new Error(data.error);if(data.job)results.push(data.job);
    }setJobs(results);
  }catch(e){setError(e instanceof Error?e.message:'Link check failed.');}finally{setBusy(false);}}
  return <main className="dashboard-shell"><Link href="/">← Content dashboard</Link><h1>Post-publication links</h1><p>Reconcile live campaign links and shorten repeated navigation labels. This updates published pages after backing them up. Drafts and scheduled posts wait until they are public.</p><label>Client <select value={clientId} onChange={e=>setClientId(e.target.value)}><option value="">Choose client</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><p><label>Published WordPress page IDs <input value={ids} onChange={e=>setIds(e.target.value)} placeholder="Separate IDs with commas"/></label></p><label>Content type <select value={workflow} onChange={e=>setWorkflow(e.target.value)}><option value="create">GEO pages</option><option value="aop">Main practice page</option><option value="subaop">Sub-practice page</option><option value="blog">Blog</option></select></label><p><button disabled={busy||!clientId||!pageIds().length} onClick={()=>void run(true)}>Reconcile published links</button> <button disabled={busy||!clientId} onClick={()=>void run(false)}>Refresh progress</button></p>{error&&<p role="alert">{error}</p>}{jobs.map(j=><section key={j.pageId}><h2>Page {j.pageId}: {j.state.replaceAll('_',' ')}</h2>{j.pending.map((p,i)=><p key={i}>{p}</p>)}<ul>{j.changedUrls.map(url=><li key={url}><a href={url}>{url}</a></li>)}</ul><p>Individual GSC indexing requests remain pending until submitted and accepted.</p></section>)}</main>;
}
