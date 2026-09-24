// Read-only saved-content and live-HTML verification for CTA rollout batch six.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {parseDocument} from 'htmlparser2';
import {findAll,textContent,removeElement} from 'domutils';
const root='/Users/matthewsalvato/Documents/New project/wordpress-backups/billy-cta-batch-6-2026-09-04';
const ids=process.argv.slice(2).map(Number);
const selected=ids.length?ids:[21,7169,68,5581,72,70,71,4744,45,5566,4847,5529,280,5632,5129,69,3,4851,5626,5623,4845,4128];
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
 for(const key of ['id','status','slug','link','title','parent','template','acf','meta'])assert.deepEqual(p[key],before[key],`${id}: unrelated ${key} changed`);
 assert.equal(p.featured_media,prepared.featuredMedia,`${id}: featured image mismatch`);
 assert.deepEqual(canonical(p.content.rendered),canonical(before.content.rendered),`${id}: original content or links changed`);
 const liveResponse=await fetch(`${p.link}?amplify_verify=${Date.now()}`,{cache:'no-store'});assert.equal(liveResponse.status,200);
 const live=parseDocument(await liveResponse.text(),{decodeEntities:true});
 const cards=find(live,e=>hasClass(e,'amplify-billy-batch-cta'));
 assert.equal(cards.length,prepared.insertions.length,`${id}: live card count`);
 assert.deepEqual(cards.map(e=>e.attribs.id),prepared.insertions.map(x=>'bcl-cta-'+x.slot));
 for(const c of cards){
  assert.notEqual(c.parent?.name,'p');
  const approved=find(c,e=>hasClass(e,'billy-card-v4-html-r2'));assert.equal(approved.length,1);assert.equal(approved[0].attribs.lang,prepared.language);
  const image=find(c,e=>hasClass(e,'bcl-v4__portrait'))[0];assert.ok(image.attribs.src.startsWith('https://www.billycooperlaw.com/wp-content/'));assert.equal(image.attribs['data-no-lazy'],'1');assert.equal(image.attribs.loading,'eager');
  const call=find(c,e=>hasClass(e,'bcl-v4__phone'))[0];assert.equal(call.attribs.href,'tel:+19147305789');assert.equal(clean(textContent(call)),prepared.callLabel);
  const practice=find(c,e=>hasClass(e,'bcl-v4__practice'))[0];assert.equal(practice.attribs.href,prepared.practiceUrl);assert.equal(clean(textContent(practice)),prepared.practiceText);
  assert.ok(approved[0].attribs.style.includes(prepared.image));
 }
 console.log(JSON.stringify({id,url:p.link,cards:cards.length,language:prepared.language,localizedActionsVerified:true,approvedDesign:true,originalContentAndLinksUnchanged:true,otherMetadataUnchanged:true,featuredImageAdded:!before.featured_media,featuredMedia:p.featured_media}));
}
