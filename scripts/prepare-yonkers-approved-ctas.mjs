import fs from 'node:fs';
import assert from 'node:assert/strict';

const root='/Users/matthewsalvato/Documents/New project/wordpress-backups/yonkers-cta-2026-09-04';
const reference=JSON.parse(fs.readFileSync(`${root}/approved-html-reference.json`,'utf8'));
const site='https://www.billycooperlaw.com';
const specs=[
 {id:7113,topic:'slip and fall',headline:'Slip and Fall in Yonkers NY?',short:'Fall',practice:'/premises-liability/',middle:'Who May Be Responsible?'},
 {id:7126,topic:'e-bike accident',headline:'E-Bike Accident in Yonkers NY?',short:'E-Bike Accident',practice:'/motor-vehicle-accidents/e-bike-accidents/',middle:'Who May Be Responsible?'},
 {id:7117,topic:'car accident',headline:'Car Accident in Yonkers NY?',short:'Car Accident',practice:'/car-accident-lawyer/',middle:'Who May Be Responsible for a Yonkers NY Crash?'},
 {id:7115,topic:'Uber and Lyft accident',headline:'Uber or Lyft Accident in Yonkers NY?',short:'Rideshare Accident',practice:'/uber-lyft-accident-lawyer/',middle:'Who May Be Responsible?'},
 {id:7124,topic:'delivery accident',headline:'Delivery Accident in Yonkers NY?',short:'Delivery Accident',practice:'/commercial-vehicle-accidents/',middle:'Who May Be Responsible?'},
];
const esc=s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const plain=s=>s.replace(/<[^>]+>/g,'').trim();
function card(spec,slot){
 const title=slot==='opening'?spec.headline:slot==='middle'?`Questions About Your Yonkers NY ${spec.short}?`:`Discuss Your Yonkers NY ${spec.short}`;
 const topic=spec.id===7115?'rideshare accident':spec.topic;
 const message=slot==='opening'?`Get answers after your ${topic} before speaking with an insurance company. Billy Cooper Law can explain the evidence, deadlines, and next steps that may apply.`:slot==='middle'?`A serious ${topic} can raise questions about evidence, insurance, and filing deadlines. Get clear guidance before moving forward.`:`Tell us about your ${topic}. Billy Cooper Law will listen, explain the issues, and help you understand your options.`;
 let html=reference.card.replace('amplify-geo-cta-opening',`amplify-geo-cta-${slot}`)
  .replace('https://www.billycooperlaw.com/wp-content/uploads/2026/08/westchester-county-hero.png','https://www.billycooperlaw.com/wp-content/uploads/2026/08/01_Yonkers_NY.png')
  .replace('https://amplify-geo-pages.vercel.app/cta/billy-cooper-cutout-v4.webp','https://www.billycooperlaw.com/wp-content/uploads/2026/08/billy-cooper-cutout-v4.png')
  .replace('width="768" height="833"','width="1204" height="1306"')
  .replace(/aria-label="[^"]*"/,`aria-label="Billy Cooper Law: ${esc(topic)} help in Yonkers NY. Call (914) 730-5789."`)
  .replace(/(<div class="bcl-v4__title"[^>]*>)[\s\S]*?(<\/div>)/,`$1${esc(title)}$2`)
  .replace(/(<p class="bcl-v4__message">)[\s\S]*?(<\/p>)/,`$1${esc(message)}$2`)
  .replace('https://www.billycooperlaw.com/practice-areas/',site+spec.practice)
  .replace('Learn about personal injury cases',`Learn about ${spec.topic} cases`)
  .replace('fetchpriority="high"',`fetchpriority="${slot==='opening'?'high':'auto'}"`)
  .replace(/>\s+</g,'><');
 // These are Classic Editor pages with implicit paragraphs. Do not add a
 // Gutenberg marker, which could disable wpautop for the original content.
 // The outer container also gives the approved card's responsive query a
 // parent container, so its mobile height can expand without clipping.
 const css=slot==='opening'?reference.style.replace(/\n/g,''):'';
 return `<div id="yonkers-cta-${slot}" class="amplify-yonkers-cta" style="container-type:inline-size">${css}${html}</div>`;
}
const result=[];
for(const spec of specs){
 const backup=JSON.parse(fs.readFileSync(`${root}/${spec.id}-before.json`,'utf8'));
 const original=backup.content;
 assert.equal(backup.status,'Published');
 assert.ok(!original.includes('amplify-geo-cta'));
 const headings=[...original.matchAll(/<h2\b[^>]*>[\s\S]*?<\/h2>/g)];
 const middle=headings.filter(m=>plain(m[0])===spec.middle);
 const closing=headings.filter(m=>plain(m[0])==='Sources');
 assert.equal(middle.length,1);assert.equal(closing.length,1);
 const insertions=[{index:headings[0].index,slot:'opening'},{index:middle[0].index,slot:'middle'},{index:closing[0].index,slot:'closing'}].map(x=>({...x,html:'\n\n'+card(spec,x.slot)+'\n\n'}));
 let content=original;
 for(const item of [...insertions].sort((a,b)=>b.index-a.index))content=content.slice(0,item.index)+item.html+content.slice(item.index);
 let stripped=content;for(const item of insertions)stripped=stripped.replace(item.html,'');
 assert.equal(stripped,original,'Only the three CTA blocks may change');
 assert.equal((content.match(/id="yonkers-cta-/g)||[]).length,3);
 assert.equal((content.match(/<style data-amplify-cta-style=/g)||[]).length,1);
 assert.ok(!content.includes('<!-- wp:'));
 result.push({id:spec.id,title:backup.title,permalink:backup.permalink,content,slots:insertions.map(x=>({slot:x.slot,beforeHeading:plain(headings.find(h=>h.index===x.index)[0])})),practiceUrl:site+spec.practice});
}
console.log(JSON.stringify(result));
