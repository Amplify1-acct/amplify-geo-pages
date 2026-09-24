import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(name){const exports={};const js=ts.transpileModule(fs.readFileSync(new URL(`../src/lib/${name}.ts`,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;vm.runInNewContext(`(function(exports){${js}\n})`)(exports);return exports;}
const {drazenHeroAuthorPanel}=load('drazen-hero');
const {insertSubAopClusterSection}=load('sub-aop-cluster-section');
test('Drazen hero retains the reference background and author panel',()=>{
 const hero=drazenHeroAuthorPanel('Car Accidents in Boca Raton');
 assert.match(hero,/Auto-Accidents\.webp/);assert.match(hero,/Aron Solomon/);assert.match(hero,/Eugenio Mancini/);assert.match(hero,/Practice Areas/);assert.match(hero,/Car Accidents in Boca Raton/);assert.match(hero,/if\(!root\|\|root\.querySelector\('\.authors-box'\)\)return/);
});
test('hero title cannot inject markup or end the script',()=>{
 const hero=drazenHeroAuthorPanel('</script><script>alert(1)</script>');
 assert.equal((hero.match(/<script\b/g)||[]).length,1);assert.match(hero,/&lt;\/script&gt;/);
});
const parent={id:1,title:'Main AOP',url:'https://example.test/main/'};
const pages=[{id:2,title:'Car Accidents',url:'https://example.test/main/car/'},{id:3,title:'Truck Accidents',url:'https://example.test/main/truck/'}];
const content='<!-- wp:paragraph --><p>Complete introduction.</p><!-- /wp:paragraph -->\n<!-- wp:heading --><h2>Next section</h2><!-- /wp:heading -->';
test('each sibling links to the parent and every other live sibling, not itself',()=>{
 for(const current of pages){const html=insertSubAopClusterSection(content,current.id,parent,pages,'Boca Raton FL');assert.match(html,/href="https:\/\/example.test\/main\/"/);for(const target of pages)assert.equal(html.includes(`href="${target.url}"`),target.id!==current.id);assert.match(html,new RegExp(`<li>${current.title}</li>`));}
});
test('parent links to every live cluster member and insertion is idempotent between complete sections',()=>{
 const html=insertSubAopClusterSection(content,1,parent,pages,'Boca Raton FL');for(const page of pages)assert.ok(html.includes(`href="${page.url}"`));assert.equal(insertSubAopClusterSection(html,1,parent,pages,'Boca Raton FL'),html);assert.ok(html.indexOf('</p><!-- /wp:paragraph -->')<html.indexOf('<!-- amplify-subaop-cluster:'));assert.ok(html.indexOf('<!-- /amplify-subaop-cluster:')<html.indexOf('<h2>Next section'));
});
