import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
const source=fs.readFileSync(new URL('../src/app/api/tracker/route.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
test('deleted rows cannot be resurrected by a stale device PUT',async()=>{
 let stored=[{id:'keep'},{id:'deleted'}];const markers={};const exports={};
 const dependencies={
  'next/server':{NextResponse:{json:(body,options)=>({body,status:options?.status||200})}},
  'next/headers':{cookies:async()=>({get:()=>undefined})},
  '@/lib/google':{getGoogleAccessToken:async()=>'test',getGoogleEmail:async()=>null},
  '@/lib/aron-review-queue':{aronReviewStoreConfigured:()=>true,listAronReviewItems:async()=>[],mergeAronApprovals:async r=>r,syncAronReviewQueue:async()=>{}},
  '@/lib/aron-wordpress-status':{refreshAronWordPressStatuses:async()=>{}},
  '@/lib/wordpress-upload-store':{uploadRedis:()=>({hgetall:async()=>markers,hset:async(k,values)=>Object.assign(markers,values)})},
 };
 const fetch=async(url,options)=>{
  if(url.includes('uploadType=media')){stored=JSON.parse(options.body);return {ok:true};}
  if(url.includes('alt=media'))return {ok:true,json:async()=>stored};
  return {ok:true,json:async()=>({files:[{id:'own-tracker'}]})};
 };
 vm.runInNewContext(`(function(require,exports){${compiled}\n})`,{fetch,URLSearchParams,Set,Map,Date,JSON,Object,Array,String})(name=>dependencies[name]||{},exports);
 assert.equal((await exports.DELETE({json:async()=>({ids:['deleted']})})).status,200);
 await exports.PUT({json:async()=>[{id:'deleted'},{id:'keep'}]});
 assert.deepEqual(stored,[{id:'keep'}]);
 const loaded=await exports.GET();assert.deepEqual(Array.from(loaded.body.deletedIds),['deleted']);assert.equal(loaded.body.records.length,1);
});
