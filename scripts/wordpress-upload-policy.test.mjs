import test from 'node:test';
import assert from 'node:assert/strict';
import { uploadFailure, sameApprovedDocument, sourceMarker } from '../src/lib/wordpress-upload-policy.ts';

test('Google access errors stop retries without substituting source text',()=>{
 for(const message of ['File not found: abc','Google Doc access is required.','invalid_grant','Reconnect Google Drive']) {
  const result=uploadFailure(500,message,1);assert.equal(result.blocked,true);assert.match(result.message,/no replacement content/);
 }
});
test('temporary failures back off and stop after three attempts',()=>{
 assert.equal(uploadFailure(503,'Timeout',1).blocked,false);
 assert.equal(uploadFailure(503,'Timeout',2).delayMs,120000);
 assert.equal(uploadFailure(503,'Timeout',3).blocked,true);
 assert.equal(uploadFailure(429,'A WordPress upload is already running',1).blocked,false);
});
test('conflicts and validation errors require attention rather than automatic overwrite',()=>{
 for(const status of [400,401,403,404,409])assert.equal(uploadFailure(status,'Cannot continue',1).blocked,true);
});
test('jobs are tied to the exact approved document',()=>{
 const record={docUrl:'https://docs.google.com/document/d/doc_123456789/edit',aronDone:true};
 assert.equal(sameApprovedDocument(record,'doc_123456789'),true);
 assert.equal(sameApprovedDocument(record,'different'),false);
 assert.equal(sameApprovedDocument({...record,aronDone:false},'doc_123456789'),false);
});
test('source markers distinguish workflows and preserve enhancement GEO lineage',()=>{
 assert.equal(sourceMarker('abc','enhance'),'amplify-geo-source:abc');
 assert.equal(sourceMarker('abc','subaop'),'amplify-subaop-source:abc');
 assert.equal(sourceMarker('abc','blog'),'amplify-blog-source:abc');
});

test('exhausted image validation is terminal even when returned as HTTP 500',()=>{
 const message='OpenAI did not return a safety-approved image for “Best Lawyer” after three attempts.';
 assert.equal(uploadFailure(500,message,1).blocked,true);
 assert.equal(uploadFailure(500,message,1).message,message);
});
