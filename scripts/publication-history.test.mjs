import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const workflow=fs.readFileSync('src/lib/content-workflow.ts','utf8');
const source=workflow+'\n'+fs.readFileSync('src/lib/publication-history.ts','utf8').replace(/^import .*;\n/,'');
const exports={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Date,Map});
const {publicationHistory,publicationDate}=exports;
test('includes shared-only publications and archives, while deduplicating IDs',()=>{
 const result=publicationHistory([{id:'old',published:true},{id:'same',wordpressStatus:'draft'}],[{id:'new',wordpressStatus:'publish',reviewArchivedAt:'2026-09-13'},{id:'same',wordpressStatus:'publish'},{id:'future',wordpressStatus:'future'},{id:'deleted',wordpressStatus:'publish',reviewDeletedAt:'today'}]);
 assert.equal(result.length,3);assert.ok(result.some(r=>r.id==='new'));assert.equal(result.find(r=>r.id==='same').wordpressStatus,'publish');
});
test('a confirmed draft overrides an old published flag',()=>{
 assert.equal(publicationHistory([{id:'x',published:true}],[{id:'x',wordpressStatus:'draft'}]).length,0);
});
test('new workflow dates sort after legacy September 1 records without inventing publish dates',()=>{
 const recent=publicationDate({finalApprovedAt:'2026-09-13T20:00:00Z'});
 assert.ok(recent.time>publicationDate({wordpressPublishedAt:'2026-09-01'}).time);
 assert.equal(recent.label,'Approved for publication');
 assert.equal(publicationDate({wordpressPublishedAt:'2026-09-14',finalApprovedAt:'2026-09-10'}).label,'Published');
 assert.equal(publicationDate({reviewArchivedAt:'2026-09-12',reviewArchiveReason:'manual'}).time,0);
});
