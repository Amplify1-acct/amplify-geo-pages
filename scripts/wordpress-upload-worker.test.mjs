import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as policy from '../src/lib/wordpress-upload-policy.ts';

function fixture({status=200,result={ok:true,pageId:123,status:'draft'},creator=null}={}) {
 const jobs=new Map(),locks=new Set(),calls=[];
 const record={id:'r1',docUrl:'https://docs.google.com/document/d/doc_123456789/edit',aronDone:true,clientId:'billy-cooper-law',website:'https://www.billycooperlaw.com'};
 const modules={
  '@/lib/ai-control.mjs':{currentAIAction:()=>({id:'click',purpose:'Explicit preparation',expiresAt:Date.now()+3600000}),withAIAction:async(_action,work)=>work(),assertAIAvailable:async()=>{}},
  'next/headers':{cookies:async()=>({get:()=>({value:'encrypted-cookie'})})},
  'next/server':{NextRequest:Request},
  '@/lib/google':{GOOGLE_REFRESH_COOKIE:'cookie',getGoogleEmail:async()=> 'accounts@amplifylaw.ai',refreshGoogleAccessToken:async()=> 'access',withJobGoogleToken:async(_token,work)=>work()},
  '@/lib/aron-review-queue':{getAronReviewItem:async()=>record,isAronReviewer:email=>email==='accounts@amplifylaw.ai',saveAronWordPressDraft:async(id,value)=>{calls.push(['save',id,value]);record.wordpressPageId=value.pageId;},saveAronWordPressError:async(id,error)=>calls.push(['error',id,error])},
  '@/lib/wordpress-upload-store':{getDocUploadConnection:async()=>creator,getUploadJob:async id=>jobs.get(id),putUploadJob:async(job,due)=>{jobs.set(job.id,{...job});calls.push(['job',job.state,due]);},dueUploadIds:async()=>[...jobs.keys()],uploadLease:async scope=>{if(locks.has(scope))return null;locks.add(scope);return async()=>locks.delete(scope);}},
  '@/lib/wordpress-upload-policy':policy,
  '@/app/api/wordpress/draft/route':{POST:async request=>{calls.push(['build',await request.json()]);return Response.json(result,{status});}},
 };
 const source=fs.readFileSync(new URL('../src/lib/wordpress-upload-worker.ts',import.meta.url),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const exports={};
 vm.runInNewContext(`(function(require,exports){${compiled}\n})`,{URL,Date,JSON,Number,String,Error,Object,Promise})(name=>{assert.ok(modules[name],name);return modules[name];},exports);
 return {worker:exports,record,jobs,calls,locks};
}
test('a reviewer queues the exact document creator connection',async()=>{
 const f=fixture({creator:{email:'accounts@amplifylaw.ai',credential:'creator-encrypted'}});
 await f.worker.enqueueWordPressUpload('r1','reviewer@amplifylaw.ai');
 assert.equal(f.jobs.get('r1').email,'accounts@amplifylaw.ai');assert.equal(f.jobs.get('r1').credential,'creator-encrypted');
});
test('a reconnected creator uses the current credential',async()=>{
 const f=fixture({creator:{email:'accounts@amplifylaw.ai',credential:'old-encrypted'}});
 await f.worker.enqueueWordPressUpload('r1','accounts@amplifylaw.ai',undefined,'intake');
 assert.equal(f.jobs.get('r1').credential,'encrypted-cookie');
});
test('approval creates a durable job and repeated enqueue is idempotent',async()=>{
 const f=fixture();await f.worker.enqueueWordPressUpload('r1','accounts@amplifylaw.ai',undefined,'intake');await f.worker.enqueueWordPressUpload('r1','accounts@amplifylaw.ai',undefined,'intake');
 assert.equal(f.calls.filter(c=>c[0]==='job').length,1);assert.equal(f.jobs.get('r1').state,'queued');
});
test('worker saves result and removes encrypted credential',async()=>{
 const f=fixture();await f.worker.enqueueWordPressUpload('r1','accounts@amplifylaw.ai',undefined,'intake');await f.worker.runWordPressUpload('r1');
 assert.equal(f.record.wordpressPageId,123);assert.equal(f.jobs.get('r1').state,'complete');assert.equal(f.jobs.get('r1').credential,undefined);
 await f.worker.runWordPressUpload('r1');assert.equal(f.calls.filter(c=>c[0]==='build').length,1);
});
test('transient failure schedules a retry without browser assistance',async()=>{
 const f=fixture({status:503,result:{error:'Service unavailable'}});await f.worker.enqueueWordPressUpload('r1','accounts@amplifylaw.ai',undefined,'intake');await f.worker.runWordPressUpload();
 assert.equal(f.jobs.get('r1').state,'retry');assert.ok(f.jobs.get('r1').nextAttemptAt);assert.ok(f.jobs.get('r1').credential);
});
test('Google access failure is blocked and credential discarded',async()=>{
 const f=fixture({status:500,result:{error:'File not found: doc_123456789'}});await f.worker.enqueueWordPressUpload('r1','accounts@amplifylaw.ai',undefined,'intake');await f.worker.runWordPressUpload();
 assert.equal(f.jobs.get('r1').state,'blocked');assert.equal(f.jobs.get('r1').credential,undefined);assert.equal(f.record.wordpressPageId,undefined);
});
test('a changed approval document never reaches WordPress',async()=>{
 const f=fixture();await f.worker.enqueueWordPressUpload('r1','accounts@amplifylaw.ai',undefined,'intake');f.record.docUrl='https://docs.google.com/document/d/other/edit';await f.worker.runWordPressUpload();
 assert.equal(f.jobs.get('r1').state,'blocked');assert.equal(f.calls.filter(c=>c[0]==='build').length,0);
});
test('worker lease prevents concurrent processing',async()=>{
 const f=fixture();await f.worker.enqueueWordPressUpload('r1','accounts@amplifylaw.ai',undefined,'intake');f.locks.add('worker');assert.equal((await f.worker.runWordPressUpload()).busy,true);assert.equal(f.calls.filter(c=>c[0]==='build').length,0);
});
test('an already tracked page is reconciled without a new build',async()=>{
 const f=fixture();await f.worker.enqueueWordPressUpload('r1','accounts@amplifylaw.ai',undefined,'intake');f.record.wordpressPageId=999;await f.worker.runWordPressUpload();assert.equal(f.jobs.get('r1').state,'complete');assert.equal(f.calls.filter(c=>c[0]==='build').length,0);
});
test('repeated interrupted invocations cannot retry indefinitely',async()=>{
 const f=fixture();await f.worker.enqueueWordPressUpload('r1','accounts@amplifylaw.ai',undefined,'intake');f.jobs.get('r1').attempts=3;f.jobs.get('r1').state='uploading';await f.worker.runWordPressUpload();assert.equal(f.jobs.get('r1').state,'blocked');assert.equal(f.jobs.get('r1').credential,undefined);assert.equal(f.calls.filter(c=>c[0]==='build').length,0);
});
test('approval worker requests draft intake using its server-verified record',async()=>{
 const f=fixture();await f.worker.enqueueWordPressUpload('r1','accounts@amplifylaw.ai',undefined,'intake');await f.worker.runWordPressUpload();
 assert.equal(f.calls.find(c=>c[0]==='build')[1].intakeRecordId,'r1');
});
test('an interruption after saving and archiving completes without another upload',async()=>{
 const f=fixture();await f.worker.enqueueWordPressUpload('r1','accounts@amplifylaw.ai',undefined,'intake');
 f.record.wordpressPageId=999;f.record.reviewArchivedAt='2026-09-04T10:00:00Z';
 await f.worker.runWordPressUpload();
 assert.equal(f.jobs.get('r1').state,'complete');assert.equal(f.calls.filter(c=>c[0]==='build').length,0);
});
test('a manually archived entry without a WordPress ID cannot be uploaded',async()=>{
 const f=fixture();await f.worker.enqueueWordPressUpload('r1','accounts@amplifylaw.ai',undefined,'intake');f.record.reviewArchivedAt='2026-09-04T10:00:00Z';
 await f.worker.runWordPressUpload();assert.equal(f.jobs.get('r1').state,'blocked');assert.equal(f.calls.filter(c=>c[0]==='build').length,0);
});

test('existing image exhaustion retries stop before another generation batch',async()=>{
 const f=fixture();await f.worker.enqueueWordPressUpload('r1','accounts@amplifylaw.ai',undefined,'intake');
 Object.assign(f.jobs.get('r1'),{state:'retry',error:'OpenAI did not return a safety-approved image after three attempts.'});
 await f.worker.runWordPressUpload('r1');
 assert.equal(f.jobs.get('r1').state,'blocked');
 assert.equal(f.jobs.get('r1').credential,undefined);
 assert.equal(f.calls.filter(c=>c[0]==='build').length,0);
});

test('prepare mode blocks immediately after three image rejections',async()=>{
 const f=fixture({status:500,result:{error:'OpenAI did not return a safety-approved image after three attempts.'}});
 await f.worker.enqueueWordPressUpload('r1','accounts@amplifylaw.ai',undefined,'prepare');
 await f.worker.runWordPressUpload('r1');
 assert.equal(f.jobs.get('r1').state,'blocked');
 await f.worker.runWordPressUpload('r1');
 assert.equal(f.calls.filter(c=>c[0]==='build').length,1);
});

test('orphan and expired workers cannot create new paid jobs',async()=>{
 for(const action of [undefined,{id:'old',purpose:'old',expiresAt:0}]){
  const f=fixture();await f.worker.enqueueWordPressUpload('r1','accounts@amplifylaw.ai');
  f.jobs.get('r1').aiAction=action;await f.worker.runWordPressUpload('r1');
  assert.equal(f.jobs.get('r1').state,'blocked');assert.equal(f.calls.filter(c=>c[0]==='build').length,0);
 }
});
test('successful pending polls cannot reset the overall job limit forever',async()=>{
 const f=fixture({status:429,result:{preparationPending:true,error:'Research pending'}});
 await f.worker.enqueueWordPressUpload('r1','accounts@amplifylaw.ai');
 for(let i=0;i<35;i++)await f.worker.runWordPressUpload('r1');
 assert.equal(f.jobs.get('r1').state,'blocked');assert.equal(f.calls.filter(c=>c[0]==='build').length,30);
});
