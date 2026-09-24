"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {ArrowLeft,ArrowUpRight,Globe2,RotateCcw} from "lucide-react";
import {isPublishedContent} from "@/lib/content-workflow";
import {publicationClient, type PublicationClient} from "@/lib/publication-client";
import {publicationDate} from "@/lib/publication-history";
import "./published.css";

type Publication={id:string;clientId?:string;clientName?:string;website?:string;workflow?:string;practiceArea?:string;city?:string;state?:string;docName?:string;primaryKeyword?:string;wordpressUrl?:string;pageUrl?:string;docUrl?:string;wordpressPublishedAt?:string;finalApprovedAt?:string;reviewArchivedAt?:string;reviewArchiveReason?:string;wordpressStatus?:string;published?:boolean;status?:string};
const types:Record<string,string>={create:"GEO",enhance:"Enhancement",blog:"Blog",aop:"AOP",subaop:"Sub-AOP"};
const title=(r:Publication)=>r.docName||r.primaryKeyword||[r.city,r.state,r.practiceArea].filter(Boolean).join(" ")||"Published page";
function safeLink(value?:string){try{const u=new URL(value||"");return ["https:","http:"].includes(u.protocol)?u.href:undefined;}catch{return undefined;}}
export default function PublishedContent(){
 const [records,setRecords]=useState<Publication[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const [profiles,setProfiles]=useState<PublicationClient[]>([]);
 const firm=(r:Publication)=>publicationClient(r,profiles).name;
 const [query,setQuery]=useState(""),[client,setClient]=useState(""),[type,setType]=useState("");
 async function refresh(){setLoading(true);setError("");try{const [response,clientResponse]=await Promise.all([fetch('/api/tracker?view=published',{cache:'no-store'}),fetch('/api/clients',{cache:'no-store'})]);const data=await response.json();const clientData=await clientResponse.json();if(!clientResponse.ok)throw new Error(clientData.error||'Client list could not be loaded.');setProfiles(clientData.clients||[]);if(!response.ok)throw new Error(data.error||"Published content could not be loaded.");setRecords((data.records||[]).filter(isPublishedContent));}catch(e){setError(e instanceof Error?e.message:"Published content could not be loaded.");}finally{setLoading(false);}}
 useEffect(()=>{void refresh();},[]);
 const clients=useMemo(()=>[...new Map(records.map(r=>{const c=publicationClient(r,profiles);return [c.key,c];})).values()].sort((a,b)=>a.name.localeCompare(b.name)),[records,profiles]);
 const visible=useMemo(()=>records.filter(r=>(!client||publicationClient(r,profiles).key===client)&&(!type||(r.workflow||'create')===type)&&(!query.trim()||[title(r),firm(r),r.wordpressUrl,r.pageUrl,r.city,r.state,r.practiceArea].join(' ').toLowerCase().includes(query.trim().toLowerCase()))).sort((a,b)=>publicationDate(b).time-publicationDate(a).time||title(a).localeCompare(title(b))),[records,profiles,client,type,query]);
 return <main className="app-shell published-page"><header className="topbar"><Link className="brand" href="/"><span className="brand-mark">A</span><span className="brand-word">AMPLIFY</span><span className="brand-product">Published</span></Link><div className="topbar-actions"><Link className="secondary-button compact" href="/"><ArrowLeft size={15}/> Active content</Link><Link className="secondary-button compact" href="/editorial-calendar">Calendar</Link></div></header>
 <section className="publication-library"><div className="publication-heading"><div><h1>Published Content</h1><p>Look back at the blogs and pages published through AMPLIFY.</p></div><button className="secondary-button compact" disabled={loading} onClick={()=>void refresh()}><RotateCcw size={15}/>{loading?'Loading…':'Refresh'}</button></div>
 <div className="publication-filters"><label>Search<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Title, location or URL"/></label><label>Client<select value={client} onChange={e=>setClient(e.target.value)}><option value="">All clients</option>{clients.map(c=><option key={c.key} value={c.key}>{c.name}</option>)}</select></label><label>Content type<select value={type} onChange={e=>setType(e.target.value)}><option value="">All types</option>{Object.entries(types).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></div>
 {error&&<p role="alert">{error}</p>}{!loading&&!error&&<p>{visible.length} published {visible.length===1?'item':'items'}</p>}
 {!loading&&!error&&!visible.length&&<div className="empty-state"><Globe2 size={28}/><h2>{records.length?'No matching publications':'No published content yet'}</h2><p>{records.length?'Try another search or filter.':'Published blogs and pages will appear here automatically.'}</p></div>}
 <div className="publication-list">{visible.map(r=>{const url=safeLink(r.wordpressUrl||r.pageUrl),doc=safeLink(r.docUrl),date=publicationDate(r);return <article className="publication-row" key={r.id}><div><div className="publication-meta">{firm(r)} · {types[r.workflow||'create']||'Page'}</div><h2>{title(r)}</h2><p>{date.time?`${date.label} ${new Date(date.time).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}`:'Published · date not recorded'}</p>{url&&<p className="publication-url">{url}</p>}</div><div className="publication-actions">{url&&<a className="primary-button compact" href={url} target="_blank" rel="noreferrer">View live page <ArrowUpRight size={15}/></a>}{doc&&<a href={doc} target="_blank" rel="noreferrer">Google Doc <ArrowUpRight size={13}/></a>}</div></article>;})}</div>
 </section></main>;
}
