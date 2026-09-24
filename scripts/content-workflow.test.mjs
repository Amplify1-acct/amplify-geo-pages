import {test} from 'node:test';
import assert from 'node:assert/strict';
import {contentWorkflow,finalApprovalReady,isPublishedContent} from '../src/lib/content-workflow.ts';
test('active writing never claims to be with Aron',()=>{const f=contentWorkflow({status:'generating'});assert.equal(f.label,'Writing in progress');assert.match(f.note,/not been sent/);});
test('saved document waits for writing approval',()=>assert.equal(contentWorkflow({docUrl:'doc'}).label,'Awaiting Aron’s review'));
test('approved unfinished content identifies AMPLIFY work',()=>assert.equal(contentWorkflow({aronDone:true,wordpressStatus:'draft'}).label,'Preparation needs attention'));
test('active preparation distinct from idle incomplete draft',()=>assert.equal(contentWorkflow({aronDone:true,upload:{state:'uploading'}}).label,'Preparing WordPress draft'));
test('readiness requires writing approval and verified non-intake draft',()=>{const r={aronDone:true,wordpressStatus:'draft',preparationRequired:false};assert.equal(finalApprovalReady(r),true);for(const p of [{aronDone:false},{wordpressIntakeOnly:true},{featuredImageReviewRequired:true},{error:'Failed'},{preparationRequired:true}])assert.equal(finalApprovalReady({...r,...p}),false);});
test('published and scheduled override stale errors and never request approval',()=>{for(const wordpressStatus of ['publish','future'])assert.equal(contentWorkflow({wordpressStatus,status:'error',error:'old'}).done,true);});
test('final approvals exclude completed, archived, unverified and still-running work',()=>{
 const ready={aronDone:true,wordpressStatus:'draft',preparationRequired:false};
 for(const patch of [{finalApprovedAt:'2026-09-10'},{reviewArchivedAt:'2026-09-10'},{reviewDeletedAt:'2026-09-10'},{wordpressStatusError:'Could not verify'},{wordpressStatus:'publish'},{wordpressStatus:'future'},...['queued','uploading','retry','blocked'].map(state=>({upload:{state}}))])assert.equal(finalApprovalReady({...ready,...patch}),false);
 assert.equal(finalApprovalReady({...ready,upload:{state:'complete'}}),true);
});

test("publication history excludes drafts and schedules even with stale published flags",()=>{for(const wordpressStatus of ["draft","future","trash","private"])assert.equal(isPublishedContent({wordpressStatus,published:true,status:"published"}),false);assert.equal(isPublishedContent({wordpressStatus:"publish"}),true);});
test("publication history retains legacy published records",()=>{assert.equal(isPublishedContent({published:true}),true);assert.equal(isPublishedContent({status:"published"}),true);assert.equal(isPublishedContent({status:"review"}),false);});
