import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(file,dependencies={}) {
 const source=fs.readFileSync(new URL(`../src/lib/${file}.ts`,import.meta.url),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const exports={};
 vm.runInNewContext(`(function(require,exports){${compiled}\n})`,{URL,Date,Map,Set,JSON,Number,String,Boolean,process:{env:{}}})(name=>{assert.ok(dependencies[name],name);return dependencies[name];},exports);
 return exports;
}
const clients=load('clients',{'@/lib/practice-area-directory':{verifiedPracticeAreaUrls:()=>({})}});
const cta=load('cta');
const location=load('aop-cta-location',{'@/lib/location':load('location')});
const drazen=clients.normalizeClientProfile({id:'drazen-mancini',name:'Drazen Mancini, P.A.',website:'https://www.myfloridainjurylaw.com',brand:{primary:'#173b32',accent:'#daff26'},phoneDisplay:'',phoneHref:''});
const body='<!-- wp:paragraph --><p>Introduction.</p><!-- /wp:paragraph --><!-- wp:heading --><h2>What happens next</h2><!-- /wp:heading --><!-- wp:paragraph --><p>Supporting copy.</p><!-- /wp:paragraph -->';
const options={origin:'https://amplify.example',client:drazen,location:'Boca Raton FL',practiceArea:'Car Accidents',imageUrl:'https://www.myfloridainjurylaw.com/wp-content/uploads/car.jpg',articleTopic:'Car Accidents in Boca Raton'};
test('verified domain defaults repair empty saved contacts and stale app colors',()=>{
 assert.equal(drazen.phoneDisplay,'561.783.4534');assert.equal(drazen.phoneHref,'+15617834534');assert.equal(drazen.brand.primary,'#132819');assert.equal(drazen.brand.accent,'#d4f0cd');assert.equal(drazen.contactUrl,'https://www.myfloridainjurylaw.com/contact-us/');
});
test('missing or mismatched phone details stop new and existing CTA generation',()=>{
 for(const override of [{phoneDisplay:''},{phoneHref:''},{phoneHref:'+12155550000'},{phoneDisplay:'the firm'}]) {
  const client={...drazen,...override};
  assert.throws(()=>cta.insertCtaBlocks(body,{...options,client}),/verified phone/);
  assert.throws(()=>cta.insertCtaBlocks(`<!-- amplify-geo-cta:opening -->${cta.CLIENT_CTA_VERSION}`,{...options,client}),/verified phone/);
 }
});
test('rendered CTA has correct working call link, local wording, colors, and plural accident classification',()=>{
 const html=cta.insertCtaBlocks(body,options);
 assert.match(html,/href="tel:\+15617834534">561\.783\.4534/);assert.match(html,/Injured in Boca Raton FL\?/);assert.match(html,/#132819/);assert.match(html,/#d4f0cd/);assert.match(html,/Contact Drazen Mancini/);assert.doesNotMatch(html,/the firm|Need Help With Car Accident|in Florida/);
 assert.ok(html.indexOf('Introduction.</p><!-- /wp:paragraph -->')<html.indexOf('<!-- amplify-geo-cta:opening -->'));
 assert.ok(html.indexOf('<!-- amplify-geo-cta:opening -->')<html.indexOf('<!-- wp:heading -->'));
 assert.match(html,/loading="eager"/);assert.match(html,/data-no-lazy="1"/);
});
test('refresh upgrades legacy CTA blocks without duplicating them',()=>{
 const old=cta.insertCtaBlocks(body,options).replaceAll(cta.CLIENT_CTA_VERSION,'amplify-client-cta-v3-topic-aware');
 const refreshed=cta.insertCtaBlocks(old,options);
 assert.doesNotMatch(refreshed,/v3-topic-aware/);assert.equal((refreshed.match(/<!-- amplify-geo-cta:/g)||[]).length,2);
});
test('targeted AOP titles override broad jurisdiction and normalize state suffixes',()=>{
 for(const title of ['Car Accidents in Boca Raton','Car Accidents in Boca Raton, FL','Boca Raton FL Car Accidents','Boca Raton Car Accidents Lawyer'])assert.equal(location.aopCtaLocation(title,'Car Accidents','Florida',drazen),'Boca Raton FL');
 assert.equal(location.aopCtaLocation('Car Accidents','Car Accidents','Florida',drazen),'Florida');
});
test('ambiguous targeted locations fail instead of guessing a state',()=>{
 assert.throws(()=>location.aopCtaLocation('Car Accidents in Springfield','Car Accidents','', {...drazen,jurisdictions:['Massachusetts','Illinois']}),/verified city and state/);
});
test('Billy and Fulginiti keep their separate CTA versions',()=>{
 assert.match(cta.insertCtaBlocks(body,{...options,client:{...drazen,id:'billy-cooper-law'}}),new RegExp(cta.BILLY_CTA_VERSION));
 const fulginiti=clients.normalizeClientProfile({id:'fulginiti-law',website:'https://www.fulginiti-law.com'});
 assert.match(cta.insertCtaBlocks(body,{...options,client:fulginiti}),new RegExp(cta.FULGINITI_CTA_VERSION));
});
