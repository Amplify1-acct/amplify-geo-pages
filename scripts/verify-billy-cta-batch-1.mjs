// Read-only saved-content and live-HTML verification for CTA rollout batch one.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {parseDocument} from 'htmlparser2';
import {findAll,textContent,removeElement} from 'domutils';
const root='/Users/matthewsalvato/Documents/New project/wordpress-backups/billy-cta-batch-1-2026-09-04';
const ids=process.argv.slice(2).map(Number);
const selected=ids.length?ids:[193,185,3940,3961,3946,3971,188,347,341,339];
const clean=s=>s.replace(/\s+/g,' ').trim();
const find=(d,p)=>findAll(p,d.children);
const hasClass=(e,c)=>(e.attribs?.class||'').split(/\s+/).includes(c);
const canonical=html=>{
 const d=parseDocument(html,{decodeEntities:true});
 for(const n of find(d,e=>hasClass(e,'amplify-billy-batch-cta')))removeElement(n);
 return {text:clean(textContent(d)),headings:find(d,e=>/^h[1-6]$/.test(e.name)).map(e=>({tag:e.name,text:clean(textContent(e))})),paragraphs:find(d,e=>e.name==='p').map(e=>clean(textContent(e))).filter(Boolean),links:find(d,e=>e.name==='a').map(e=>({href:e.attribs.href,text:clean(textContent(e))})),images:find(d,e=>e.name==='img').map(e=>({src:e.attribs.src,alt:e.attribs.alt}))};
};
for(const id of selected){
 const before=JSON.parse(fs.readFileSync(`${root}/${id}-public-before.json`,'utf8'));
 const prepared=JSON.parse(fs.readFileSync(`${root}/${id}-prepared.json`,'utf8'));
 const r=await fetch(`https://www.billycooperlaw.com/wp-json/wp/v2/pages/${id}?_fields=id,status,slug,link,title,parent,featured_media,template,content,acf,meta&amplify_verify=${Date.now()}`,{cache:'no-store'});
 assert.equal(r.status,200);const p=await r.json();
 for(const key of ['id','status','slug','link','title','parent','featured_media','template','acf','meta'])assert.deepEqual(p[key],before[key],`${id}: unrelated ${key} changed`);
 assert.deepEqual(canonical(p.content.rendered),canonical(before.content.rendered),`${id}: original content or links changed`);
 const liveResponse=await fetch(`${p.link}?amplify_verify=${Date.now()}`,{cache:'no-store'});assert.equal(liveResponse.status,200);
 const live=parseDocument(await liveResponse.text(),{decodeEntities:true});
 const cards=find(live,e=>hasClass(e,'amplify-billy-batch-cta'));
 assert.equal(cards.length,3,`${id}: live card count`);
 assert.deepEqual(cards.map(e=>e.attribs.id),['bcl-cta-opening','bcl-cta-middle','bcl-cta-closing']);
 for(const c of cards){
  assert.notEqual(c.parent?.name,'p');
  const approved=find(c,e=>hasClass(e,'billy-card-v4-html-r2'));assert.equal(approved.length,1);
  const image=find(c,e=>hasClass(e,'bcl-v4__portrait'))[0];assert.ok(image.attribs.src.startsWith('https://www.billycooperlaw.com/wp-content/'));assert.equal(image.attribs['data-no-lazy'],'1');assert.equal(image.attribs.loading,'eager');
  const call=find(c,e=>hasClass(e,'bcl-v4__phone'))[0];assert.equal(call.attribs.href,'tel:+19147305789');
  const practice=find(c,e=>hasClass(e,'bcl-v4__practice'))[0];assert.equal(practice.attribs.href,prepared.practiceUrl);
  assert.ok(approved[0].attribs.style.includes(prepared.image));
 }
 console.log(JSON.stringify({id,url:p.link,cards:3,approvedDesign:true,originalContentAndLinksUnchanged:true,metadataUnchanged:true,featuredMedia:p.featured_media}));
}
