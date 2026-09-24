import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publicationClient} from '../src/lib/publication-client.ts';
const clients=[{id:'fulginiti',name:'Fulginiti Law',website:'https://www.fulginiti-law.com'}];
test('legacy page URLs and named blogs share one client filter',()=>{
 const records=[{website:'https://fulginiti-law.com/abington-personal-injury-lawyers/'},{clientName:'fulginiti-law.com/camden-construction-accident-lawyers',wordpressUrl:'https://www.fulginiti-law.com/camden-construction-accident-lawyers/'},{clientName:'Fulginiti Law'}];
 for(const r of records)assert.deepEqual(publicationClient(r,clients),{key:'client:fulginiti',name:'Fulginiti Law'});
});
test('unknown sites collapse paths and www into one domain',()=>{
 assert.deepEqual(publicationClient({website:'https://www.example.com/a?x=1'},[]),publicationClient({website:'example.com/b'},[]));
});
test('exact host matching does not combine different firms',()=>{
 assert.equal(publicationClient({website:'https://fulginiti-law.com.other.com/a'},clients).key,'host:fulginiti-law.com.other.com');
});
test('saved client identity works without URLs',()=>{
 assert.equal(publicationClient({clientId:'fulginiti'},clients).name,'Fulginiti Law');
});
