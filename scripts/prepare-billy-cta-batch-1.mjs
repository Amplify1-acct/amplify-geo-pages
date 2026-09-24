// Prepares content-only additions from backed-up Classic Editor content.
// Does not write to WordPress or modify local files; emits JSON for review.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {parseDocument} from 'htmlparser2';
import {findAll,textContent} from 'domutils';

const root='/Users/matthewsalvato/Documents/New project/wordpress-backups/billy-cta-batch-1-2026-09-04';
const reference=JSON.parse(fs.readFileSync('/Users/matthewsalvato/Documents/New project/wordpress-backups/yonkers-cta-2026-09-04/approved-html-reference.json','utf8'));
const site='https://www.billycooperlaw.com';
const portrait=site+'/wp-content/uploads/2026/08/billy-cooper-cutout-v4.png';
const specs=[
 {id:193,label:'Personal Injury',topic:'personal injury',image:site+'/wp-content/uploads/2026/02/Personal_Injury-scaled.jpeg',middle:'How Does the Personal Injury Claims Process Work in New York?',practice:'/practice-areas/',practiceLabel:'personal injury',titles:['Injured in New York?','Questions About Your Injury Claim?','Talk About Your New York Injury'],messages:[
  'Get answers after an injury in New York before speaking with an insurance company. Billy Cooper Law can explain the evidence, deadlines, and next steps that may apply.',
  'Medical records, witness accounts, and insurance information can help clarify a New York injury claim. Get clear guidance before moving forward.',
  'Tell us about your injury and how it has affected your life. Billy Cooper Law will listen and help you understand your options in New York.']},
 {id:185,label:'Motor Vehicle Accidents',topic:'motor vehicle accident',middle:'What Is the Serious Injury Threshold in New York?',practice:'/personal-injury/',practiceLabel:'personal injury',titles:['Hurt in a New York Crash?','Questions After a Vehicle Crash?','Discuss Your New York Crash'],messages:[
  'Get answers after a motor vehicle accident in New York. Billy Cooper Law can explain the crash evidence, insurance questions, and next steps that may apply.',
  'A New York vehicle crash can raise questions about medical bills, insurance coverage, and missed work. Get guidance before making decisions about your claim.',
  'Tell us about your motor vehicle accident. Billy Cooper Law will listen, review the issues, and help you understand your options in New York.']},
 {id:3940,label:'Car Accidents',topic:'car accident',middle:'How Does the Car Accident Claims Process Work in New York?',practice:'/motor-vehicle-accidents/',practiceLabel:'motor vehicle accident',titles:['Car Accident in New York?','Questions After Your Car Accident?','Discuss Your New York Car Accident'],messages:[
  'Get answers after a car accident before speaking with an insurance company. Billy Cooper Law can explain the evidence and next steps for your New York claim.',
  'Crash reports, medical records, and insurance information can help clarify what happened. Get guidance on your New York car accident before moving forward.',
  'Tell us about your car accident and injuries. Billy Cooper Law will listen and help you understand your options after a New York crash.']},
 {id:3961,label:'E-Bike Accidents',topic:'e-bike accident',middle:'Injuries Sustained in E-Bike Accidents',practice:'/motor-vehicle-accidents/',practiceLabel:'motor vehicle accident',titles:['E-Bike Accident in New York?','Questions After an E-Bike Crash?','Discuss Your New York E-Bike Accident'],messages:[
  'Get answers after an e-bike accident in New York. Billy Cooper Law can explain the crash evidence, insurance questions, and next steps that may apply.',
  'An e-bike crash can raise questions about drivers, roadway conditions, and insurance. Get clear guidance about your New York accident before moving forward.',
  'Tell us about your e-bike accident and injuries. Billy Cooper Law will listen and help you understand your options after a New York crash.']},
 {id:3946,label:'Uber and Lyft Accidents',topic:'rideshare accident',middle:'What Evidence Is Most Important in a White Plains Rideshare Accident Case?',practice:'/motor-vehicle-accidents/',practiceLabel:'motor vehicle accident',titles:['Uber or Lyft Accident in New York?','Unsure Which Insurance Applies?','Discuss Your New York Rideshare Accident'],messages:[
  'Get answers after an Uber or Lyft accident in New York. Billy Cooper Law can explain how trip records, driver status, and insurance information may affect your next steps.',
  'Rideshare accidents can involve several insurance policies and important app records. Get guidance on your New York Uber or Lyft accident before moving forward.',
  'Tell us about your Uber or Lyft accident. Billy Cooper Law will listen and help you understand your options after a New York rideshare crash.']},
 {id:3971,label:'Truck and Commercial Vehicle Accidents',topic:'truck and commercial vehicle accident',middle:'What Compensation Can I Recover After a Truck Accident in Westchester?',practice:'/motor-vehicle-accidents/',practiceLabel:'motor vehicle accident',titles:['Truck Accident in New York?','Questions After a Truck Crash?','Discuss Your New York Truck Accident'],messages:[
  'Get answers after a truck or commercial vehicle accident in New York. Billy Cooper Law can explain the records, insurance questions, and next steps that may apply.',
  'Driver records, vehicle maintenance, and crash evidence can be important after a New York truck accident. Get clear guidance about what to do next.',
  'Tell us about your truck or commercial vehicle accident. Billy Cooper Law will listen and help you understand your options after a New York crash.']},
 {id:188,label:'Construction Accidents',topic:'construction accident',middle:'What Compensation Can You Recover After a Construction Accident?',practice:'/personal-injury/',practiceLabel:'personal injury',titles:['Hurt on a New York Job Site?','Questions After a Construction Injury?','Discuss Your New York Job-Site Injury'],messages:[
  'Get answers after a construction accident in New York. Billy Cooper Law can explain the job-site evidence, incident records, and next steps that may apply.',
  'A New York construction injury can raise questions about contractors, safety conditions, and insurance. Get guidance before moving forward.',
  'Tell us about your construction accident and injuries. Billy Cooper Law will listen and help you understand your options after a New York job-site accident.']},
 {id:347,label:'Slip and Fall / Premises Liability',topic:'slip and fall and premises liability',middle:'What Compensation Can You Recover from a Premises Liability Case in Westchester?',practice:'/personal-injury/',practiceLabel:'personal injury',titles:['Injured on Unsafe Property?','Questions After a New York Fall?','Discuss Your New York Property Injury'],messages:[
  'After a fall or other property-related injury in New York, get answers before speaking with an insurer. Billy Cooper Law can explain the evidence and next steps that may apply.',
  'Photos, incident reports, and maintenance records can help clarify a dangerous property condition. Get guidance about your New York premises liability claim.',
  'Tell us about your fall or unsafe-property injury. Billy Cooper Law will listen and help you understand your options after an accident in New York.']},
 {id:341,label:'Dog Bites',topic:'dog bite',middle:'What Compensation Is Available After a Dog Bite?',practice:'/personal-injury/',practiceLabel:'personal injury',titles:['Dog Bite in New York?','Questions After a Dog Attack?','Discuss Your New York Dog Bite'],messages:[
  'Get answers after a dog bite or animal attack in New York. Billy Cooper Law can explain the incident records, medical evidence, and next steps that may apply.',
  'A dog attack can raise questions about the owner, insurance, and ongoing treatment. Get clear guidance about your New York dog bite claim.',
  'Tell us about the dog attack and your injuries. Billy Cooper Law will listen and help you understand your options after a dog bite in New York.']},
 {id:339,label:'Catastrophic Injuries',topic:'catastrophic injury',middle:'Burn Injuries and Electrocutions',practice:'/personal-injury/',practiceLabel:'personal injury',titles:['Life-Changing Injury in New York?','Planning for Long-Term Injury Needs?','Discuss Your New York Injury'],messages:[
  'A catastrophic injury can affect your health, work, and independence. Billy Cooper Law can explain the records and next steps for your New York injury claim.',
  'Long-term treatment, rehabilitation, and daily support can be central concerns after a New York catastrophic injury. Get guidance about your next steps.',
  'Tell us how a catastrophic injury has affected you or your family. Billy Cooper Law will listen and help you understand your options in New York.']},
];
const esc=s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const isInsideDetails=e=>{for(let p=e.parent;p;p=p.parent)if(p.name==='details')return true;return false;};
function card(spec,slot,index){
 const html=reference.card.replace('amplify-geo-cta-opening',`amplify-geo-cta-${slot}`)
  .replace('https://www.billycooperlaw.com/wp-content/uploads/2026/08/westchester-county-hero.png',spec.image)
  .replace('https://amplify-geo-pages.vercel.app/cta/billy-cooper-cutout-v4.webp',portrait)
  .replace('width="768" height="833"','width="1204" height="1306"')
  .replace(/aria-label="[^"]*"/,`aria-label="Billy Cooper Law: ${esc(spec.topic)} help in New York. Call (914) 730-5789."`)
  .replace(/(<div class="bcl-v4__title"[^>]*>)[\s\S]*?(<\/div>)/,`$1${esc(spec.titles[index])}$2`)
  .replace(/(<p class="bcl-v4__message">)[\s\S]*?(<\/p>)/,`$1${esc(spec.messages[index])}$2`)
  .replace('https://www.billycooperlaw.com/practice-areas/',site+spec.practice)
  .replace('Learn about personal injury cases',`Learn about ${esc(spec.practiceLabel)} cases`)
  .replace('fetchpriority="high"',`fetchpriority="${slot==='opening'?'high':'auto'}"`)
  .replace(/>\s+</g,'><');
 const css=slot==='opening'?reference.style.replace(/\n/g,''):'';
 return `<div id="bcl-cta-${slot}" class="amplify-billy-batch-cta" style="container-type:inline-size">${css}${html}</div>`;
}
const out=[];
for(const spec of specs){
 const before=JSON.parse(fs.readFileSync(`${root}/${spec.id}-before.json`,'utf8'));
 const publicBefore=JSON.parse(fs.readFileSync(`${root}/${spec.id}-public-before.json`,'utf8'));
 assert.equal(before.status,'Published');assert.equal(publicBefore.status,'publish');
 assert.ok(publicBefore.featured_media,'An existing featured image is required');
 spec.image ||= before.featuredPreview?.[0]?.src;
 assert.ok(spec.image?.startsWith(site+'/wp-content/uploads/'),'Only current WordPress-hosted images are permitted');
 const original=before.content;
 assert.ok(!original.includes('amplify-geo-cta'),'Do not duplicate existing cards');
 assert.ok(!original.includes('<!-- wp:'),'This script is for Classic Editor pages only');
 const dom=parseDocument(original,{withStartIndices:true,withEndIndices:true,decodeEntities:true});
 const headings=findAll(e=>/^h[23]$/.test(e.name)&&!isInsideDetails(e),dom.children);
 const middle=headings.filter(e=>textContent(e).trim()===spec.middle);
 assert.equal(middle.length,1,`Unambiguous complete-section boundary required for ${spec.id}`);
 for(const heading of [headings[0],middle[0]]) assert.equal(heading.parent.type,'root','Do not insert into an existing wrapper or paragraph');
 const insertions=[{slot:'opening',index:headings[0].startIndex,beforeHeading:textContent(headings[0])},{slot:'middle',index:middle[0].startIndex,beforeHeading:spec.middle},{slot:'closing',index:original.length,beforeHeading:null}]
  .map((item,i)=>({...item,html:'\n\n'+card(spec,item.slot,i)+'\n\n'}));
 let content=original;
 for(const item of [...insertions].sort((a,b)=>b.index-a.index))content=content.slice(0,item.index)+item.html+content.slice(item.index);
 let stripped=content;for(const item of insertions)stripped=stripped.replace(item.html,'');
 assert.equal(stripped,original,'Original source must remain byte-for-byte unchanged');
 assert.equal((content.match(/id="bcl-cta-/g)||[]).length,3);
 assert.equal((content.match(/<style data-amplify-cta-style=/g)||[]).length,1);
 out.push({id:spec.id,label:spec.label,url:before.permalink,featuredMedia:publicBefore.featured_media,image:spec.image,portrait,practiceUrl:site+spec.practice,content,insertions:insertions.map(({html,...rest})=>rest)});
}
console.log(JSON.stringify(out));
