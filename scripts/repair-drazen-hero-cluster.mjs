import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import assert from 'node:assert/strict';
function load(name){const source=fs.readFileSync(new URL(`../src/lib/${name}.ts`,import.meta.url),'utf8');const exports={};const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;vm.runInNewContext(`(function(exports){${js}\n})`)(exports);return exports;}
const {drazenHeroAuthorPanel}=load('drazen-hero');
const {insertSubAopClusterSection}=load('sub-aop-cluster-section');
const site='https://www.myfloridainjurylaw.com';
const parent={id:1008,title:'Palm Beach County FL Personal Injury',url:site+'/palm-beach-county-fl-personal-injury-lawyer/'};
const pages=[{id:1276,title:'Car Accidents in Boca Raton FL',url:parent.url+'car-accidents-in-boca-raton/'}];
const output=[];
const ctas=html=>(html.match(/<!--\s*amplify-geo-cta:(?:opening|middle|closing)\s*-->\s*<!--\s*wp:(?:image|html)\b[^>]*-->[\s\S]*?<!--\s*\/wp:(?:image|html)\s*-->/gi)||[]);
for(const id of [1276,1008]){
 const backup=JSON.parse(fs.readFileSync(new URL(`../generated/drazen-${id}-before-live-hero-cluster-2026-09-03.json`,import.meta.url),'utf8'));
 let content=backup.content;
 if(id===1276)content=drazenHeroAuthorPanel(backup.title)+'\n'+content;
 content=insertSubAopClusterSection(content,id,parent,pages,'Boca Raton FL');
 assert.deepEqual(ctas(content),ctas(backup.content),'Existing CTA blocks must remain byte-for-byte unchanged');
 assert.equal((content.match(/<!-- amplify-subaop-cluster:/g)||[]).length,1);
 const again=insertSubAopClusterSection(content,id,parent,pages,'Boca Raton FL');
 assert.equal(again,content,'Cluster repair must be idempotent');
 if(id===1276){assert.match(content,/Auto-Accidents\.webp/);assert.match(content,/Written by/);assert.match(content,/Reviewed by/);}
 output.push({id,content,title:backup.title,status:backup.status});
}
process.stdout.write(JSON.stringify(output));
