"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
type Row={key:string;title:string;status:string;id?:number;url?:string;words:number;ready:boolean};
export default function YonkersSpanish() {
  const [rows,setRows]=useState<Row[]>([]);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [confirming,setConfirming]=useState(false);
  const endpoint="/api/wordpress/billy-yonkers-spanish";
  async function load() {
    const r=await fetch(endpoint,{cache:"no-store"}); const d=await r.json();
    if(!r.ok) throw new Error(d.error);setRows(d.rows);
  }
  useEffect(()=>{let active=true;void fetch(endpoint,{cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);if(active)setRows(d.rows);}).catch(e=>{if(active)setMessage(e.message);});return()=>{active=false;};},[]);
  async function action(body:object) {
    setBusy(true);setMessage("Working… This page will show the result when the request finishes.");
    try {const r=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw new Error(d.error);await load();setMessage(JSON.stringify(d));}
    catch(e){setMessage(e instanceof Error?e.message:"Request failed");}finally{setBusy(false);}
  }
  return <main style={{maxWidth:1000,margin:"40px auto",padding:24}}><Link href="/">Content dashboard</Link><h1>Yonkers: five Spanish accident pages</h1><p>Complete translations beneath the existing Spanish Yonkers personal injury page. English pages are not modified.</p><button onClick={()=>void load()} disabled={busy}>Refresh inventory</button><p role="status">{message}</p>{rows.map(r=><section key={r.key} style={{padding:20,borderBottom:"1px solid #ddd"}}><h2>{r.title}</h2><p>{r.status} · {r.words} words {r.id?`· WordPress ${r.id}`:""} · {r.ready?"paragraphs verified":"needs preparation"}</p>{r.url&&<a href={r.url} target="_blank" rel="noreferrer">Open page</a>} <button disabled={busy||r.ready} onClick={()=>void action({action:"prepare",key:r.key})}>Translate {r.key}</button></section>)}<button disabled={busy||rows.length!==5||rows.some(r=>!r.ready)} onClick={()=>setConfirming(true)}>Publish five Spanish pages and link parent</button>{confirming&&<section role="dialog" aria-label="Confirm Spanish publication" style={{padding:24,border:"2px solid #163832",marginTop:24}}><p>Publish these five Spanish pages and replace the Spanish Yonkers parent’s English accident links with their Spanish versions?</p><button disabled={busy} onClick={()=>{setConfirming(false);void action({action:"publish",confirm:true});}}>Confirm publication</button> <button disabled={busy} onClick={()=>setConfirming(false)}>Cancel</button></section>}</main>;
}
