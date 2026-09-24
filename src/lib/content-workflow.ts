export type WorkflowRecord = {
 id?:string; status?:string; published?:boolean; docUrl?:string; aronDone?:boolean; approvalStatus?:string;
 wordpressStatus?:string; wordpressPageId?:number; preparationRequired?:boolean; wordpressIntakeOnly?:boolean;
 featuredImageReviewRequired?:boolean; error?:string; draftWarnings?:string[];
 upload?:{state:string;error?:string};
 finalApprovedAt?:string; reviewArchivedAt?:string; reviewDeletedAt?:string; wordpressStatusError?:string;
};
export function finalApprovalReady(r:WorkflowRecord){
 return r.wordpressStatus==='draft' && r.preparationRequired===false && r.aronDone===true && !r.wordpressIntakeOnly && !r.featuredImageReviewRequired && !r.error
   && !r.finalApprovedAt && !r.reviewArchivedAt && !r.reviewDeletedAt && !r.wordpressStatusError
   && !['queued','uploading','retry','blocked'].includes(r.upload?.state||'');
}
export function contentWorkflow(r:WorkflowRecord){
 if(r.wordpressStatus==='publish'||(!r.wordpressStatus&&(r.published||r.status==='published')))return {label:'Published',note:'Live on the client’s website. No approval is needed.',done:true};
 if(r.wordpressStatus==='future')return {label:'Scheduled',note:'Approved and scheduled in WordPress. No further approval is needed.',done:true};
 if(r.finalApprovedAt)return {label:'Final approval received',note:'Your approval is saved. AMPLIFY must reconcile publication; no new approval is needed.',done:false};
 if(r.wordpressStatus==='trash')return {label:'In WordPress Trash',note:'This item is not available for publication.',done:false};
 if(finalApprovalReady(r))return {label:'Ready for your approval',note:'Your turn: preview the finished page, then approve publication or scheduling.',done:false};
 if(r.aronDone||r.approvalStatus==='APPROVED'){
  if(['queued','uploading','retry'].includes(r.upload?.state||''))return {label:'Preparing WordPress draft',note:'AMPLIFY is preparing the draft. No approval is needed from you yet.',done:false};
  return {label:'Preparation needs attention',note:'AMPLIFY must finish the WordPress draft and its checks before your final approval.',done:false};
 }
 if(r.status==='error'||r.approvalStatus==='DECLINED')return {label:'Writing needs attention',note:r.error||'The writing needs revision before it can move forward.',done:false};
 if(r.docUrl)return {label:'Awaiting Aron’s review',note:'Aron reviews and edits the writing in Google Docs, then approves it.',done:false};
 if(r.status==='generating')return {label:'Writing in progress',note:'The article is being researched and written. It has not been sent to Aron yet.',done:false};
 return {label:'Ready to write',note:'Start the selected brief to create a draft for Aron.',done:false};
}

export function isPublishedContent(r:WorkflowRecord){
 return r.wordpressStatus ? r.wordpressStatus === "publish" : Boolean(r.published || r.status === "published");
}
