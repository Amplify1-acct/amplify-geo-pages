import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function fixture({creator=null}={}) {
 const calls=[];const records=[
 {id:'approved',docUrl:'https://docs.google.com/document/d/approved_doc/edit',aronDone:true},
 {id:'waiting',docUrl:'https://docs.google.com/document/d/waiting_doc/edit',aronDone:false},
 {id:'denied',docUrl:'https://docs.google.com/document/d/denied_doc/edit',aronDone:true},
 {id:'active',docUrl:'https://docs.google.com/document/d/active_doc/edit',aronDone:true},
 {id:'complete',docUrl:'https://docs.google.com/document/d/complete_doc/edit',aronDone:true,wordpressPageId:1}];
 const modules={
 '@/lib/ai-control.mjs':{currentAIAction:()=>({id:'click',purpose:'Recover drafts',expiresAt:Date.now()+3600000})},
 '@/lib/aron-wordpress-status':{refreshAronWordPressStatuses:async()=>new Map()},
 '@/lib/published-backlog-reconciliation':{reconcileConfirmedPublishedBacklog:async()=>({reconciled:0,errors:[]})},
 '@/lib/content-workflow':{finalApprovalReady:record=>Boolean(record.wordpressPageId)},
 '@/lib/aron-review-queue':{archiveHistoricalFulginitiQueue:async()=>0,returnAronDraftToPreparation:async()=>{},listAronReviewItems:async()=>records,isAronReviewer:email=>email==='accounts@amplifylaw.ai'},
 '@/lib/wordpress-upload-store':{getDocUploadConnection:async()=>creator,getUploadJob:async id=>id==='active'?{state:'uploading'}:null,saveDocUploadConnection:async(id,c)=>calls.push(['connection',id,c])},
 '@/lib/wordpress-upload-worker':{enqueueWordPressUpload:async(...args)=>calls.push(['enqueue',...args])},
 };
 const compiled=ts.transpileModule(fs.readFileSync(new URL('../src/lib/wordpress-upload-recovery.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const exports={};const fetch=async url=>{calls.push(['check',url]);return url.includes('denied_doc')?new Response('{}',{status:404}):Response.json({mimeType:'application/vnd.google-apps.document',appProperties:{amplifyResponseId:'yes'}});};
 vm.runInNewContext(`(function(require,exports){${compiled}\n})`,{fetch,AbortSignal,Date,Error,Promise,JSON})(name=>modules[name],exports);
 return {calls,run:(email,explicit=true)=>exports.recoverWordPressUploads('access',email,'encrypted',explicit)};
}
test('recovery retains only verified Doc connections and queues only inactive approved records',async()=>{const f=fixture();const r=await f.run('accounts@amplifylaw.ai');assert.equal(r.checked,3);assert.equal(r.connectionsSaved,1);assert.equal(r.queued,1);assert.equal(r.inaccessible,1);assert.equal(f.calls.filter(c=>c[0]==='enqueue')[0][1],'approved');assert.ok(!f.calls.some(c=>c[0]==='connection'&&c[1]==='denied_doc'));assert.ok(!f.calls.some(c=>c[0]==='check'&&c[1].includes('complete_doc')));});
test('recovery rejects unauthorized accounts before reading the queue',async()=>{const f=fixture();await assert.rejects(f.run('outsider@example.com'),/approved AMPLIFY/);assert.equal(f.calls.length,0);});

test('a reviewer cannot replace a verified creator connection during recovery',async()=>{const creator={email:'creator@amplifylaw.ai',credential:'creator-encrypted'};const f=fixture({creator});await f.run('accounts@amplifylaw.ai');assert.equal(f.calls.filter(c=>c[0]==='connection').length,0);const queued=f.calls.find(c=>c[0]==='enqueue');assert.equal(queued[2],creator.email);assert.equal(queued[3].credential,creator.credential);});

test('automatic refresh can save connections but cannot queue paid preparation',async()=>{
 const f=fixture();const result=await f.run('accounts@amplifylaw.ai',false);
 assert.equal(result.queued,0);assert.ok(!f.calls.some(call=>call[0]==='enqueue'));
});
