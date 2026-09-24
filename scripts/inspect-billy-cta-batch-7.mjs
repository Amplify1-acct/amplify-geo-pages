// Read-only public source discovery for the six explicitly authorized AOP pages.
const site='https://www.billycooperlaw.com';
const out={pages:{},media:{}};
for(const id of [5611,5126,3996,5136,5139,4582]){
 const r=await fetch(`${site}/wp-json/wp/v2/pages/${id}?_fields=id,status,slug,link,title,parent,featured_media,template,content,acf,meta&verify=${Date.now()}`,{signal:AbortSignal.timeout(30000)});
 if(!r.ok||!r.headers.get('content-type')?.includes('json'))throw Error(`Page ${id} did not return WordPress JSON`);
 out.pages[id]=await r.json();
}
for(const q of ['Wrongful Death','Labor Law','Car Accident Lawyer','transportation']){
 const r=await fetch(`${site}/wp-json/wp/v2/media?search=${encodeURIComponent(q)}&per_page=100&_fields=id,title,source_url,alt_text,media_details`,{signal:AbortSignal.timeout(30000)});
 if(!r.ok)throw Error('Media search failed');out.media[q]=(await r.json()).map(x=>({id:x.id,title:x.title,source_url:x.source_url,alt_text:x.alt_text,width:x.media_details?.width,height:x.media_details?.height}));
}
console.log(JSON.stringify(out));
