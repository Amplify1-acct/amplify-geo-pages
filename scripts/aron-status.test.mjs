import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(name, deps = {}, globals = {}) {
 const code = ts.transpileModule(fs.readFileSync(new URL(`../src/lib/${name}.ts`,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const exports = {};
 vm.runInNewContext(`(function(require,exports){${code}\n})`,{Date,Map,Set,JSON,Number,String,Boolean,Intl,AbortSignal,...globals})(id=>deps[id]||{restoredArchiveDocIds:new Set()},exports);
 return exports;
}
const display=load('aron-wordpress-display').wordPressReviewDisplay;
const merge=load('aron-review-queue',{'./epstein-approved-documents':load('epstein-approved-documents')}).reconcileReviewItem;
test('scheduled posts show their date without a preparation warning',()=>{
 const result=display({wordpressStatus:'future',wordpressScheduledAt:'2026-09-16T13:00:00Z',preparationRequired:true});
 assert.match(result.label,/Scheduled/);assert.match(result.note,/Sep 16, 2026.*9:00 AM/);assert.equal(result.draft,false);assert.doesNotMatch(result.note,/preparation needed/);
});
test('unverified drafts do not claim missing preparation',()=>{
 assert.equal(display({wordpressStatus:'draft'}).label,'Draft · final checks needed');
 assert.equal(display({wordpressStatus:'draft',wordpressIntakeOnly:true}).label,'Draft · preparation needed');
});
test('stale tracker drafts cannot erase a confirmed schedule',()=>{
 const current={id:'one',docUrl:'https://docs.google.com/document/d/abc/edit',aronDone:true,status:'scheduled',wordpressPageId:10,wordpressStatus:'future',updatedAt:'2026-09-09T10:00:00Z'};
 assert.equal(merge({...current,wordpressStatus:'draft',updatedAt:'2026-09-09T11:00:00Z'},current).wordpressStatus,'future');
});
test('status refresh reads WordPress and persists draft, schedule, and publication',async()=>{
 const saved=[];const requests=[];
 const {refreshAronWordPressStatuses}=load('aron-wordpress-status',{
 '@/lib/wordpress':{getWordPressConfigAsync:async()=>({siteUrl:'https://example.test'}),wordPressAuthorization:()=> 'test'},
 '@/lib/aron-review-queue':{saveAronWordPressStatus:async(...args)=>saved.push(args)},
 },{fetch:async(url,options)=>{requests.push(options);return {ok:true,headers:new Headers({'content-type':'application/json'}),json:async()=>[{id:1,status:'future',date_gmt:'2026-09-16T13:00:00'},{id:2,status:'draft'},{id:3,status:'publish'}]};}});
 const errors=await refreshAronWordPressStatuses([1,2,3].map(id=>({id:String(id),wordpressPageId:id,approvalStatus:'APPROVED',workflow:'blog',website:'example.test'})),'test');
 assert.equal(errors.size,0);assert.deepEqual(saved.map(row=>row[2]),['future','draft','publish']);assert.ok(requests.every(options=>!options.method||options.method==='GET'));
});
test('failed verification is reported without overwriting saved status',async()=>{
 let writes=0;
 const {refreshAronWordPressStatuses}=load('aron-wordpress-status',{
 '@/lib/wordpress':{getWordPressConfigAsync:async()=>({siteUrl:'https://example.test'}),wordPressAuthorization:()=> 'test'},
 '@/lib/aron-review-queue':{saveAronWordPressStatus:async()=>writes++},
 },{fetch:async()=>({ok:false,status:403,headers:new Headers({'cf-mitigated':'challenge'})})});
 const errors=await refreshAronWordPressStatuses([{id:'1',wordpressPageId:1,aronDone:true}],'test');
 assert.match(errors.get('1'),/Cloudflare/);assert.equal(writes,0);
});
test('archived entries are not refreshed or reopened',async()=>{
 const {refreshAronWordPressStatuses}=load('aron-wordpress-status',{}, {fetch:async()=>{throw new Error('Archived entry must not be fetched');}});
 const errors=await refreshAronWordPressStatuses([{id:'archived',wordpressPageId:3,aronDone:true,reviewArchivedAt:'2026-09-01T00:00:00Z'}],'test');
 assert.equal(errors.size,0);
});

test('verified preparation and image rejection remain distinct',()=>{
 assert.equal(display({wordpressStatus:'draft',preparationRequired:false}).label,'Draft · ready for final approval');
 assert.equal(display({wordpressStatus:'draft',preparationRequired:false,error:'Image rejected'}).label,'Draft · needs attention');
 const current={id:'one',docUrl:'https://docs.google.com/document/d/abc/edit',aronDone:true,wordpressPageId:10,wordpressStatus:'draft',updatedAt:'2026-09-09T12:00:00Z',preparationRequired:false,featuredImageApproved:true,featuredImageReviewRequired:false};
 const merged=merge({...current,updatedAt:'2026-09-09T11:00:00Z',preparationRequired:true,featuredImageApproved:false,featuredImageReviewRequired:true},current);
 assert.equal(merged.preparationRequired,false);assert.equal(merged.featuredImageApproved,true);assert.equal(merged.featuredImageReviewRequired,false);
});
