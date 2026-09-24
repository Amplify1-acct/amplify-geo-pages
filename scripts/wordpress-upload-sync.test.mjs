import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../src/lib/aron-review-queue.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const exports={};
vm.runInNewContext(`(function(require,exports){${compiled}\n})`,{Date,Map,Set,JSON,Number,String,Boolean})(()=>({restoredArchiveDocIds:new Set()}),exports);
const merge=exports.reconcileReviewItem;
const base={id:'one',docUrl:'https://docs.google.com/document/d/abc/edit',aronDone:true,status:'ready',updatedAt:'2026-09-03T10:00:00Z',wordpressPageId:10,wordpressStatus:'draft'};
test('stale tracker cannot erase a confirmed upload',()=>{
 const result=merge({...base,wordpressPageId:undefined,wordpressStatus:undefined,updatedAt:'2026-09-03T11:00:00Z'},base);
 assert.equal(result.wordpressPageId,10);assert.equal(result.wordpressStatus,'draft');
});
test('newer dashboard result can add an ID and record publication',()=>{
 assert.equal(merge(base,{...base,wordpressPageId:undefined,updatedAt:'2026-09-03T09:00:00Z'}).wordpressPageId,10);
 assert.equal(merge({...base,wordpressStatus:'publish',status:'published',updatedAt:'2026-09-03T11:00:00Z'},base).status,'published');
});
test('a published result cannot be demoted or have its target switched',()=>{
 const published={...base,wordpressStatus:'publish',status:'published'};
 assert.equal(merge({...base,updatedAt:'2026-09-03T11:00:00Z'},published).wordpressStatus,'publish');
 assert.equal(merge({...base,wordpressPageId:11,updatedAt:'2026-09-03T11:00:00Z'},base).wordpressPageId,10);
});
test('approval is not transferred to a different document',()=>{
 const revised={...base,docUrl:'https://docs.google.com/document/d/new/edit',aronDone:false,wordpressPageId:undefined};
 assert.equal(merge(revised,base).aronDone,false);assert.equal(merge(revised,base).wordpressPageId,undefined);
});
test('a dashboard sync cannot restore an archived approved entry',()=>{
 const archived={...base,reviewArchivedAt:'2026-09-04T23:59:00Z'};
 assert.equal(merge({...base,updatedAt:'2026-09-05T10:00:00Z'},archived).reviewArchivedAt,archived.reviewArchivedAt);
});
test('confirmed drafts stay approved on synchronization, with links retained',()=>{
 const uploaded={...base,wordpressEditUrl:'https://example.test/wp-admin/post.php?post=10&action=edit'};
 for(const result of [merge(uploaded),merge({...uploaded,wordpressPageId:undefined},uploaded)]) {
  assert.equal(result.reviewArchivedAt,undefined);assert.equal(result.wordpressPageId,10);assert.equal(result.wordpressEditUrl,uploaded.wordpressEditUrl);assert.equal(result.docUrl,base.docUrl);
 }
});
test('pending or failed uploads stay active and a new document does not inherit the archive',()=>{
 for(const pageId of [undefined,0,-1,NaN])assert.equal(merge({...base,wordpressPageId:pageId,error:'Upload failed'}).reviewArchivedAt,undefined);
 assert.equal(merge({...base,aronDone:false,wordpressPageId:10}).reviewArchivedAt,undefined);
 const changed={...base,docUrl:'https://docs.google.com/document/d/new/edit',aronDone:false,wordpressPageId:undefined};
 assert.equal(merge(changed,{...base,reviewArchivedAt:'2026-09-04T10:00:00Z'}).reviewArchivedAt,undefined);
});

test('legacy upload archives reopen drafts, while published and manual archives stay archived',()=>{
 const legacy={...base,wordpressDraftAt:'2026-09-04T12:00:00Z',reviewArchivedAt:'2026-09-04T12:00:00Z'};
 assert.equal(merge(legacy).reviewArchivedAt,undefined);
 assert.equal(merge({...legacy,reviewArchiveReason:'manual'}).reviewArchivedAt,legacy.reviewArchivedAt);
 assert.ok(merge({...legacy,wordpressStatus:'publish'}).reviewArchivedAt);
 assert.ok(merge({...base,wordpressStatus:'publish'}).reviewArchivedAt);
});
