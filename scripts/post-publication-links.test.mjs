import test from 'node:test';
import assert from 'node:assert/strict';
import {planPublicationLinks,cleanResourceLabels,publicLink} from '../src/lib/post-publication-links.ts';
const roster='<h2>Pinellas County Cities We Serve for Nursing Home Abuse Cases</h2><ul><li>Clearwater</li><li>Dunedin</li><li>St. Petersburg</li></ul>';
const page=(id,name,status='publish',content=roster)=>({id,status,link:`https://example.com/p${id}/`,title:{raw:name},content:{raw:content}});
const context={siteUrl:'https://example.com',practiceAreaUrls:{'Nursing Home Abuse':'https://example.com/p1/'}};
test('all-client GEO reconciliation keeps roster and scopes topic, state and language',()=>{
 const pages=[page(1,'Nursing Home Abuse','publish','<p>Original hub</p>'),page(2,'Nursing Home Abuse Lawyer in Clearwater FL'),page(3,'St. Petersburg FL Nursing Home Abuse Lawyer'),page(4,'Dunedin FL Nursing Home Abuse Lawyer','draft'),page(5,'Dunedin FL Car Accident Lawyer'),page(6,'Dunedin NJ Nursing Home Abuse Lawyer')];
 const plan=planPublicationLinks(pages,2,context);
 assert.deepEqual(plan.pending,[]);
 const updated=plan.updates.find(x=>x.page.id===2).content;
 assert.match(updated,/<li>Clearwater<\/li>/); assert.match(updated,/<li>Dunedin<\/li>/);
 assert.match(updated,/<a href="https:\/\/example.com\/p3\/">St. Petersburg<\/a>/);
 assert.doesNotMatch(updated,/p4\/|p5\/|p6\//);
 assert.match(plan.updates.find(x=>x.page.id===3).content,/p2\//);
 assert.match(plan.updates.find(x=>x.page.id===1).content,/Original hub/);
 const saved=pages.map(p=>({...p,content:{raw:plan.updates.find(u=>u.page.id===p.id)?.content||p.content.raw}}));
 const repeated=planPublicationLinks(saved,2,context);
 assert.equal(repeated.updates.filter(u=>u.content!==u.page.content.raw).length,0);
});
test('resources lose repetition while citation and prose labels remain intact',()=>{
 const label='Florida Nursing Home Bedsores Lawyer';
 const html=`<p>${label}</p><h2>Related Florida Nursing Home Resources</h2><ul><li><a href="/bedsores/">${label}</a></li></ul><h2>Sources</h2><ul><li><a href="/source/">${label}</a></li></ul>`;
 const result=cleanResourceLabels(html);
 assert.match(result,/<a href="\/bedsores\/">Bedsores<\/a>/);
 assert.match(result,/<a href="\/source\/">Florida Nursing Home Bedsores Lawyer<\/a>/);
 assert.match(result,/<p>Florida Nursing Home Bedsores Lawyer<\/p>/);
});
test('required links live in body bullets even if a prose link already exists',()=>{
 const prose='<p>Read <a href="https://example.com/p1/">our practice overview</a>.</p>';
 const pages=[page(1,'Nursing Home Abuse','publish','<p>Original hub</p>'),page(2,'Clearwater FL Nursing Home Abuse Lawyer','publish',prose+roster)];
 const result=planPublicationLinks(pages,2,context).updates.find(u=>u.page.id===2).content;
 assert.ok(result.startsWith(prose));
 assert.match(result,/<ul><li><a href="https:\/\/example.com\/p1\/">Nursing Home Abuse<\/a><\/li><\/ul>/);
 assert.equal((result.match(/href="https:\/\/example.com\/p1\/"/g)||[]).length,2);
});
test('all observed RDCY resource variants use short labels only in resource bullets',()=>{
 const html='<h2>Related Florida Nursing Home Resources</h2><ul><li><a href="/damages/">Florida Nursing Home Abuse Damages</a></li><li><a href="/assisted-living/">Florida Assisted Living Abuse Lawyer</a></li></ul>';
 assert.match(cleanResourceLabels(html),/>Damages<\/a>/);
 assert.match(cleanResourceLabels(html),/>Assisted Living Abuse<\/a>/);
});
test('other clients can shorten shared navigation context without changing prose',()=>{
 const html='<p>New Jersey Truck Accident Damages Lawyer</p><h2>Related New Jersey Truck Accident Resources</h2><ul><li><a href="/damages/">New Jersey Truck Accident Damages Lawyer</a></li><li><a href="/insurance/">New Jersey Truck Accident Insurance Lawyer</a></li></ul>';
 const result=cleanResourceLabels(html);assert.match(result,/>Damages<\/a>/);assert.match(result,/>Insurance<\/a>/);assert.ok(result.startsWith('<p>New Jersey Truck Accident Damages Lawyer</p>'));
});
test('ambiguous destinations and unrecognized campaigns remain pending',()=>{
 const plan=planPublicationLinks([page(2,'Clearwater FL Nursing Home Abuse Lawyer'),page(3,'St. Petersburg FL Nursing Home Abuse Lawyer'),page(4,'St. Petersburg FL Nursing Home Abuse Lawyer')],2,context);
 assert.ok(plan.pending.some(s=>s.includes('Ambiguous')));
 assert.doesNotMatch(plan.updates.find(x=>x.page.id===2).content,/href/);
 assert.ok(planPublicationLinks([page(2,'Unclear topic')],2,context).pending.length);
});
test('scheduled pages and noncanonical destinations cannot enter linking',()=>{
 assert.throws(()=>planPublicationLinks([page(2,'Clearwater FL Nursing Home Abuse Lawyer','future')],2,context),/waits/);
 for(const url of ['https://other.com/a/','https://example.com/?page_id=4','https://example.com/a-amplify-draft-id/']) assert.throws(()=>publicLink(url,context.siteUrl));
});
test('Sub-AOP relationships use actual WordPress parent and preserve other languages',()=>{
 const pages=[page(1,'Personal Injury','publish','<p>Original</p>'),{...page(2,'Car Accidents','publish','<p>Cars</p>'),parent:1},{...page(3,'Truck Accidents','publish','<p>Trucks</p>'),parent:1},{...page(4,'Abogado de accidentes','publish','<p>Spanish</p>'),parent:1}];
 const plan=planPublicationLinks(pages,2,{...context,workflow:'subaop'});
 assert.deepEqual(plan.pending,[]);
 for(const id of [1,2,3])assert.ok(plan.checkedIds.includes(id));
 assert.ok(!plan.checkedIds.includes(4));
 assert.match(plan.updates.find(x=>x.page.id===2).content,/p1\/.*[\s\S]*p3\//);
});
