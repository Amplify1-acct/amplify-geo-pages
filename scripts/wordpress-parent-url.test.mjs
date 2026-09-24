import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const route=fs.readFileSync(new URL('../src/app/api/wordpress/draft/route.ts',import.meta.url),'utf8');
const start=route.indexOf('async function publishedSubAopParent(');
const source=route.slice(start,route.indexOf('\nfunction billyLocationVisualBrief',start));
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
function fixture(pages){
 const urls=[];
 const resolve=vm.runInNewContext(`(function(){${compiled};return publishedSubAopParent})()`,{URL,URLSearchParams,Set,Error,fetch:async url=>{urls.push(url);return {ok:true,json:async()=>pages};},slugify:value=>value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),plainText:value=>value});
 return {resolve,urls};
}
const site='https://www.myfloridainjurylaw.com';
const parent=site+'/palm-beach-county-fl-personal-injury-lawyer/';
test('a parent URL resolves its exact published slug instead of URL-as-title',async()=>{
 const f=fixture([{id:99,status:'publish',link:parent}]);
 assert.equal((await f.resolve(site,'auth',parent)).id,99);
 assert.deepEqual(new URL(f.urls[0]).searchParams.getAll('slug[]'),['palm-beach-county-fl-personal-injury-lawyer']);
});
test('a missing URL parent never falls back to an unrelated published page',async()=>{
 const f=fixture([{id:99,status:'publish',link:site+'/other/'}]);
 assert.equal(await f.resolve(site,'auth',parent),undefined);assert.equal(f.urls.length,1);
});
test('a cross-client parent URL fails before any WordPress request',async()=>{
 const f=fixture([]);await assert.rejects(()=>f.resolve(site,'auth','https://other.test/parent/'),/different WordPress site/);assert.equal(f.urls.length,0);
});
function countyFixture(page) {
 const start=route.indexOf('async function billyGeoParentId(');
 const source=route.slice(start,route.indexOf('\nasync function approvedContentImageMedia',start));
 const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 return vm.runInNewContext(`(function(){${compiled};return billyGeoParentId})()`,{BILLY_GEO_CHILD_PARENTS:[],Error,fetch:async()=>({ok:true}),wordPressJson:async()=>[page],slugify:v=>v,plainText:v=>v});
}
test('a verified county personal-injury landing page may have no parent',async()=>{
 const resolve=countyFixture({id:10,status:'publish',parent:0,title:{rendered:'Rockland County Personal Injury Lawyer'}});
 assert.equal(await resolve('https://firm.test','auth','Rockland County','personal injury'),undefined);
});
test('a city personal-injury page still requires its county parent',async()=>{
 const resolve=countyFixture({id:10,status:'publish',parent:0,title:{rendered:'Clarkstown Personal Injury Lawyer'}});
 await assert.rejects(resolve('https://firm.test','auth','Clarkstown','personal injury'),/county parent/);
});
test('a county accident page remains a child of the county landing page',async()=>{
 const resolve=countyFixture({id:10,status:'publish',parent:0,title:{rendered:'Rockland County Personal Injury Lawyer'}});
 assert.equal(await resolve('https://firm.test','auth','Rockland County','E-Bike Accident'),10);
});
