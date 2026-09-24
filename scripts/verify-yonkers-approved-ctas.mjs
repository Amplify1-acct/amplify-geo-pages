import fs from 'node:fs';
import assert from 'node:assert/strict';
import {parseDocument} from 'htmlparser2';
import {findAll,textContent,removeElement} from 'domutils';
const root='/Users/matthewsalvato/Documents/New project/wordpress-backups/yonkers-cta-2026-09-04';
const originals=JSON.parse(fs.readFileSync(`${root}/original-public-pages.json`,'utf8'));
const chosen=process.argv.slice(2).map(Number);
const find=(dom,p)=>findAll(p,dom.children);
const canonical=html=>{
 const dom=parseDocument(html,{decodeEntities:true});
 for(const node of find(dom,e=>(e.attribs?.class||'').split(' ').includes('amplify-yonkers-cta')))removeElement(node);
 return {text:textContent(dom).replace(/\s+/g,' ').trim(),links:find(dom,e=>e.name==='a').map(e=>({href:e.attribs.href,text:textContent(e).replace(/\s+/g,' ').trim()})),paragraphs:find(dom,e=>e.name==='p').map(e=>textContent(e).replace(/\s+/g,' ').trim()).filter(Boolean),headings:find(dom,e=>/^h[1-6]$/.test(e.name)).map(e=>({tag:e.name,text:textContent(e)}))};
};
for(const original of originals.filter(x=>!chosen.length||chosen.includes(x.id))){
 const r=await fetch(`https://www.billycooperlaw.com/wp-json/wp/v2/pages/${original.id}?_fields=id,status,link,title,parent,featured_media,template,content&amplify_verify=${Date.now()}`,{cache:'no-store'});
 assert.equal(r.status,200);const p=await r.json();
 for(const key of ['status','link','title','parent','featured_media','template'])assert.deepEqual(p[key],original[key],`Unrelated ${key} changed for ${p.id}`);
 assert.deepEqual(canonical(p.content.rendered),canonical(original.content.rendered),`Original content, paragraphs, headings or links changed for ${p.id}`);
 const d=parseDocument(p.content.rendered),cards=find(d,e=>(e.attribs?.class||'').split(' ').includes('amplify-yonkers-cta'));
 assert.equal(cards.length,3);
 const ids=cards.map(e=>e.attribs.id);assert.deepEqual(ids,['yonkers-cta-opening','yonkers-cta-middle','yonkers-cta-closing']);
 for(const c of cards){
  assert.notEqual(c.parent?.name,'p');
  const img=findAll(e=>e.name==='img',c.children)[0];assert.equal(img.attribs['data-no-lazy'],'1');assert.equal(img.attribs.loading,'eager');
  const call=findAll(e=>(e.attribs?.class||'').includes('bcl-v4__phone'),c.children)[0];assert.equal(call.attribs.href,'tel:+19147305789');
 }
 console.log(JSON.stringify({id:p.id,url:p.link,cards:3,originalContentAndLinksUnchanged:true,metadataUnchanged:true}));
}
