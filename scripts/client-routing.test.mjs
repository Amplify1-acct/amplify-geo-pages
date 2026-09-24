import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const profiles = [{id:'epstein',website:'https://www.theepsteinlawfirm.com'}, {id:'fulginiti',website:'https://fulginiti-law.com'}];
for (const [file, name, asynchronous] of [['clients.ts','getClientProfile',false],['client-store.ts','getClientProfileAsync',true]]) {
 const source=fs.readFileSync(new URL('../src/lib/'+file,import.meta.url),'utf8');
 const start=source.indexOf(`export ${asynchronous?'async ':''}function ${name}(`);
 const end=source.indexOf('\n}',start)+2;
 const body=source.slice(source.indexOf('{',start)+1,end-1);
 const fn=vm.runInNewContext(`(${asynchronous?'async ':''}function(clientId,website,accessToken){${body}})`,{URL,clientProfiles:()=>profiles,clientProfilesAsync:async()=>profiles,host:p=>new URL(p.website).hostname.replace(/^www\./,''),getClientProfile:()=>{throw Error('unexpected fallback')}});
 test(file+' refuses a website belonging to another client', async()=>assert.equal(await fn('epstein',profiles[1].website,'token'),null));
 test(file+' refuses an unknown explicit client even with a known domain',async()=>assert.equal(await fn('unknown',profiles[0].website,'token'),null));
 test(file+' resolves matching, www-equivalent and ID-only inputs',async()=>{
  for(const url of [profiles[0].website,'https://theepsteinlawfirm.com/a-page',undefined])assert.equal((await fn('epstein',url,'token')).id,'epstein');
 });
 test(file+' supports domain-only legacy records',async()=>assert.equal((await fn(undefined,profiles[1].website,'token')).id,'fulginiti'));
}
const page=fs.readFileSync(new URL('../src/app/page.tsx',import.meta.url),'utf8');
const label=vm.runInNewContext('('+page.match(/function statusLabel\(record: PageRecord\) \{[\s\S]*?\n\}/)[0].replace(': PageRecord','')+')');
test('verified published WordPress status overrides leftover draft timestamp',()=>assert.equal(label({wordpressStatus:'publish',wordpressDraftAt:'2026-09-01',status:'published'}),'Live'));
