// Prepares content-only additions from backed-up Classic Editor content.
// Does not write to WordPress or modify local files; emits JSON for review.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {parseDocument} from 'htmlparser2';
import {findAll,textContent} from 'domutils';

const root='/Users/matthewsalvato/Documents/New project/wordpress-backups/billy-cta-batch-6-2026-09-04';
const reference=JSON.parse(fs.readFileSync('/Users/matthewsalvato/Documents/New project/wordpress-backups/yonkers-cta-2026-09-04/approved-html-reference.json','utf8'));
const site='https://www.billycooperlaw.com';
const portrait=site+'/wp-content/uploads/2026/08/billy-cooper-cutout-v4.png';
const specs=JSON.parse(fs.readFileSync(`${root}/specs.json`,'utf8'));
const esc=s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const isInsideDetails=e=>{for(let p=e.parent;p;p=p.parent)if(p.name==='details')return true;return false;};
function card(spec,slot,index){
 const callLabel=spec.language==='es'?'Llame al (914) 730-5789':'Call (914) 730-5789';
 const aria=spec.language==='es'?`Billy Cooper Law: ayuda con ${spec.topic} en Nueva York. ${callLabel}.`:`Billy Cooper Law: ${spec.topic} help in New York. ${callLabel}.`;
 const html=reference.card.replace('<section ',`<section lang="${spec.language}" `).replace('amplify-geo-cta-opening',`amplify-geo-cta-${slot}`)
  .replace('https://www.billycooperlaw.com/wp-content/uploads/2026/08/westchester-county-hero.png',spec.image)
  .replace('https://amplify-geo-pages.vercel.app/cta/billy-cooper-cutout-v4.webp',portrait)
  .replace('width="768" height="833"','width="1204" height="1306"')
  .replace(/aria-label="[^"]*"/,`aria-label="${esc(aria)}"`)
  .replace(/(<div class="bcl-v4__title"[^>]*>)[\s\S]*?(<\/div>)/,`$1${esc(spec.titles[index])}$2`)
  .replace(/(<p class="bcl-v4__message">)[\s\S]*?(<\/p>)/,`$1${esc(spec.messages[index])}$2`)
  .replace('https://www.billycooperlaw.com/practice-areas/',site+spec.practice)
  .replace('Learn about personal injury cases',esc(spec.practiceText))
  .replace('>Call (914) 730-5789</a>',`>${callLabel}</a>`)
  .replace('fetchpriority="high"',`fetchpriority="${slot==='opening'?'high':'auto'}"`)
  .replace(/>\s+</g,'><');
 const css=index===0?reference.style.replace(/\n/g,''):'';
 return `<div id="bcl-cta-${slot}" class="amplify-billy-batch-cta" style="container-type:inline-size">${css}${html}</div>`;
}
const out=[];
for(const spec of specs.filter(s=>s.featuredMedia && (!process.argv[2] || s.id===Number(process.argv[2])))){
 const before=JSON.parse(fs.readFileSync(`${root}/${spec.id}-before.json`,'utf8'));
 const publicBefore=JSON.parse(fs.readFileSync(`${root}/${spec.id}-public-before.json`,'utf8'));
 assert.equal(before.status,'Published');assert.equal(publicBefore.status,'publish');
 assert.ok(spec.featuredMedia,'A verified featured image is required');
 assert.ok(!publicBefore.featured_media || publicBefore.featured_media===spec.featuredMedia,'Preserve existing featured image');
 spec.image ||= before.featuredPreview?.[0]?.src;
 assert.ok(spec.image?.startsWith(site+'/wp-content/uploads/'),'Only current WordPress-hosted images are permitted');
 const original=before.content;
 assert.ok(!original.includes('amplify-geo-cta'),'Do not duplicate existing cards');

 const dom=parseDocument(original,{withStartIndices:true,withEndIndices:true,decodeEntities:true});
 const headings=findAll(e=>/^h[2-3]$/.test(e.name)&&!isInsideDetails(e),dom.children);
 function boundary(label,index) {
  const matches=index!==undefined?headings.filter(e=>e.startIndex===index):headings.filter(e=>textContent(e).trim()===label);
  assert.equal(matches.length,1,'Unambiguous complete-section boundary for '+spec.id+' '+label);
  assert.equal(matches[0].parent.type,'root');
  return {index:matches[0].startIndex,beforeHeading:textContent(matches[0])};
 }
 const points=spec.titles.length===1?[{slot:'closing',index:original.length,beforeHeading:null}]:
  [{slot:'opening',...boundary(spec.opening,spec.openingIndex)},{slot:'middle',...boundary(spec.middle,spec.middleIndex)},{slot:'closing',index:original.length,beforeHeading:null}];
 const insertions=points.map((item,i)=>({...item,html:'\n\n'+(spec.templateCard?'<!-- bcl-template-cta:start -->':'')+card(spec,item.slot,i)+(spec.templateCard?'<!-- bcl-template-cta:end -->':'')+'\n\n'}));
 let content=original;
 for(const item of [...insertions].sort((a,b)=>b.index-a.index))content=content.slice(0,item.index)+item.html+content.slice(item.index);
 let stripped=content;for(const item of insertions)stripped=stripped.replace(item.html,'');
 assert.equal(stripped,original,'Original source must remain byte-for-byte unchanged');
 assert.equal((content.match(/id="bcl-cta-/g)||[]).length,spec.titles.length);
 assert.equal((content.match(/<style data-amplify-cta-style=/g)||[]).length,1);
 out.push({id:spec.id,language:spec.language,practiceText:spec.practiceText,callLabel:spec.language==='es'?'Llame al (914) 730-5789':'Call (914) 730-5789',label:spec.label,url:publicBefore.link,featuredMedia:spec.featuredMedia,templateCard:!!spec.templateCard,image:spec.image,portrait,practiceUrl:site+spec.practice,content,insertions});
}
console.log(JSON.stringify(out));
