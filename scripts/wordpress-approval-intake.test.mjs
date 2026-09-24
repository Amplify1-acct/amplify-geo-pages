import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import sanitizeHtml from 'sanitize-html';
import * as policy from '../src/lib/wordpress-upload-policy.ts';
function fixture({approved=true,prior=false,changed=false}={}) {
 const docId='approved_doc_123456'; const writes=[];
 const record={id:'r1',clientId:'test',website:'https://firm.test',workflow:'create',docUrl:`https://docs.google.com/document/d/${docId}/edit`,aronDone:approved};
 const source='<h1>Approved page</h1><h2>Existing FAQs</h2><p>'+('Approved legal copy. '.repeat(50))+'</p>';
 const modules={
 'next/server':{NextResponse:Response},openai:{default:class {}},'sanitize-html':{default:sanitizeHtml},
 '@/lib/google':{getGoogleAccessToken:async()=> 'token',getGoogleEmail:async()=> 'accounts@amplifylaw.ai'},
 '@/lib/client-store':{getClientProfileAsync:async()=>({id:'test',wordpress:{}})},
 '@/lib/wordpress':{getWordPressConfigAsync:async()=>({siteUrl:'https://firm.test'}),wordPressAuthorization:()=> 'test'},
 '@/lib/location':{stateAbbreviation:()=> 'NY'},
 '@/lib/aron-review-queue':{isAronReviewer:()=>true,getAronReviewItem:async()=>record},
 '@/lib/wordpress-upload-store':{uploadLease:async()=>async()=>{}},
 '@/lib/wordpress-upload-policy':policy,
 '@/lib/faq-standard':{validateAmplifyFaqHtml:()=>({passed:false,errors:['Exactly ten FAQs required.']})},
 '@/lib/direct-link':{directLink:v=>v},
 };
 let saved;
 const fetch=async(url,options={})=>{
  if(url.includes('googleapis.com/drive/v3/files/')) {
   if(url.includes('/export?'))return new Response(source);
   if(url.includes('/approvals'))return Response.json({items:[]});
   return Response.json({id:docId,mimeType:'application/vnd.google-apps.document',appProperties:{amplifyResponseId:'source'}});
  }
  if(url.includes('search='))return Response.json(prior?[{id:77,status:'draft',link:'https://firm.test/?page_id=77',content:{raw:`<!-- ${policy.sourceMarker(docId,'create')} -->`}}]:[]);
  if(options.method==='POST') {const p=JSON.parse(options.body);writes.push(p);saved={...p,id:77,link:'https://firm.test/?page_id=77',content:{raw:p.content}};return Response.json(saved);}
  if(url.includes('/pages/77?'))return Response.json(changed?{...saved,content:{raw:'truncated'}}:saved);
  throw new Error('Unexpected request: '+url);
 };
 const sourceTs=fs.readFileSync(new URL('../src/app/api/wordpress/draft/route.ts',import.meta.url),'utf8');
 const compiled=ts.transpileModule(sourceTs,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:false}}).outputText;
 const exports={};
 vm.runInNewContext(`(function(require,exports){${compiled}\n})`,{fetch,URL,Response,Date,JSON,Number,String,Error,Object,Promise,Set,Map,Buffer,process:{env:{}}})(name=>modules[name]||{},exports);
 return {writes,run:()=>exports.POST(new Request('https://app.test/api/wordpress/draft',{method:'POST',body:JSON.stringify({...record,docId,intakeRecordId:'r1',city:'Town',state:'NY',practiceArea:'Injury'})}))};
}
test('approved copy reaches a verified draft despite FAQ issues',async()=>{const f=fixture();const response=await f.run();const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));assert.equal(result.pageId,77);assert.equal(result.preparationRequired,true);assert.equal(f.writes.length,1);assert.equal(f.writes[0].status,'draft');assert.ok(f.writes[0].content.includes('Approved legal copy.'));assert.ok(!f.writes[0].content.includes('amplify-faq-standard:'));assert.ok(result.warnings.some(w=>w.includes('Exactly ten')));});
test('unapproved record cannot use approval intake',async()=>{const f=fixture({approved:false});assert.equal((await f.run()).status,409);assert.equal(f.writes.length,0);});
test('existing source draft is reconciled without overwriting or duplicating',async()=>{const f=fixture({prior:true});const result=await(await f.run()).json();assert.equal(result.pageId,77);assert.equal(result.reconciled,true);assert.equal(f.writes.length,0);});
test('a truncated WordPress save is not reported as verified success',async()=>{const f=fixture({changed:true});const result=await(await f.run()).json();assert.notEqual(result.ok,true);assert.match(result.error,/could not be verified/);});
