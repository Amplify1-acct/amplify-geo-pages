import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function evaluate(path, modules, globals={}) {
 const source=fs.readFileSync(new URL(path,import.meta.url),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const exports={};vm.runInNewContext(compiled,{exports,require:name=>{assert.ok(modules[name],name);return modules[name];},...globals});return exports;
}
const key='amplify:aron-review-queue:v1';
function fixture(){
 const a={id:'a',website:'https://example.test',docUrl:'https://docs.google.com/document/d/a/edit',createdAt:'2026-09-01',practiceArea:'Car Accident',city:'Albany',state:'NY',status:'ready',aronDone:true,wordpressPageId:123,reviewArchivedAt:'2026-09-04'};
 const b={...a,id:'b',docUrl:'https://docs.google.com/document/d/b/edit',aronDone:false,wordpressPageId:undefined,reviewArchivedAt:undefined,status:'review'};
 const hashes={[key]:{a,b}};
 class Redis {async hgetall(k){return hashes[k];}async hget(k,id){return hashes[k]?.[id];}async hset(k,values){hashes[k]||={};Object.assign(hashes[k],values);}}
 const queue=evaluate('../src/lib/aron-review-queue.ts',{'@upstash/redis':{Redis},'@/lib/obsolete-content':{isObsoleteDrazenPage:()=>false}},{process:{env:{KV_REST_API_URL:'test',KV_REST_API_TOKEN:'test'}}});
 return {queue,a,b,hashes};
}
test('single and bulk deletion hide only selected entries, preserving source data',async()=>{
 const f=fixture();const before=JSON.stringify(f.hashes[key]);
 assert.deepEqual(Array.from(await f.queue.deleteAronReviewItems(['a','a','missing'])),['a']);
 assert.deepEqual(Array.from(await f.queue.listAronReviewItems(),r=>r.id),['b']);
 assert.equal(await f.queue.getAronReviewItem('a'),null);
 assert.equal(JSON.stringify(f.hashes[key]),before);
 assert.equal((await f.queue.listAronReviewItems(true))[0].wordpressPageId,123);
 assert.deepEqual(Array.from(await f.queue.deleteAronReviewItems(['a','b'])),['b']);
 assert.equal((await f.queue.listAronReviewItems()).length,0);
});
test('stale tracker and concurrent upload writes cannot resurrect deleted records',async()=>{
 const f=fixture();await f.queue.deleteAronReviewItems(['a','b']);
 await f.queue.syncAronReviewQueue([f.a,f.b]);
 assert.equal((await f.queue.listAronReviewItems()).length,0);
 // Simulate an already-running save finishing after deletion.
 f.hashes[key].a={...f.a,wordpressPageId:456};
 assert.equal(await f.queue.getAronReviewItem('a'),null);
 assert.equal((await f.queue.listAronReviewItems()).length,0);
});
function apiFixture(authorized=true){
 const calls=[];
 const api=evaluate('../src/app/api/aron/review-queue/route.ts',{
 'next/server':{NextResponse:{json:(data,options)=>({data,status:options?.status||200})}},
 '@/lib/aron-wordpress-status':{refreshAronWordPressStatuses:async()=>{}},
    '@/lib/wordpress-upload-worker':{},'@/lib/wordpress-upload-store':{},
 '@/lib/aron-review-queue':{isAronReviewer:()=>authorized,deleteAronReviewItems:async ids=>{calls.push(ids);return ids;}},
 '@/lib/google':{getGoogleAccessToken:async()=>'test',getGoogleEmail:async()=>'test@example.com'},
 '@/lib/aron-review-order':{},
 });return {api,calls};
}
test('delete endpoint rejects unauthorized and malformed requests without writes',async()=>{
 const denied=apiFixture(false);assert.equal((await denied.api.DELETE({json:async()=>({ids:['a']})})).status,403);assert.equal(denied.calls.length,0);
 const f=apiFixture();for(const ids of [undefined,[],[''],[null],['x'.repeat(201)],Array(1001).fill('a')])assert.equal((await f.api.DELETE({json:async()=>({ids})})).status,400);
 assert.equal(f.calls.length,0);
});
test('delete endpoint supports one or many IDs and deduplicates selection',async()=>{
 const f=apiFixture();const result=await f.api.DELETE({json:async()=>({ids:[' a ','b','a']})});
 assert.equal(result.status,200);assert.deepEqual(Array.from(result.data.deletedIds),['a','b']);
});

test('WordPress status sync archives publication without clearing preparation data or changing targets',async()=>{
 const f=fixture();f.hashes[key].a={...f.a,wordpressStatus:'draft',preparationRequired:true,draftWarnings:['Check images']};
 await f.queue.saveAronWordPressStatus('a',999,'publish');
 assert.equal(f.hashes[key].a.wordpressStatus,'draft');
 await f.queue.saveAronWordPressStatus('a',123,'publish','https://example.test/live/');
 const saved=JSON.parse(f.hashes[key].a);
 assert.equal(saved.wordpressStatus,'publish');assert.equal(saved.reviewArchiveReason,'published');
 assert.equal(saved.preparationRequired,true);assert.equal(saved.draftWarnings[0],'Check images');
});
test('draft intake stays active and a status-only refresh cannot incorrectly mark it ready',async()=>{
 const f=fixture();f.hashes[key].a={...f.a,wordpressStatus:'draft',wordpressDraftAt:f.a.reviewArchivedAt,preparationRequired:true};
 const saved=await f.queue.saveAronWordPressDraft('a',{pageId:123,status:'draft'});
 assert.equal(saved.reviewArchivedAt,undefined);assert.equal(saved.preparationRequired,true);
});
