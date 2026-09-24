import {NextRequest,NextResponse} from 'next/server';
import {createHash} from 'node:crypto';
import {authorizedAmplifyUser} from '@/lib/permissions';
import {getWordPressConfigAsync,wordPressAuthorization} from '@/lib/wordpress';
import {uploadRedis,uploadLease} from '@/lib/wordpress-upload-store';
export const dynamic='force-dynamic';
export const maxDuration=300;
const clientId='rafferty-domnick-cunningham-yaffa';
const pairs=[{city:'Sarasota',postId:19344,slug:'sarasota-fl-nursing-home-abuse'},{city:'St. Petersburg',postId:19342,slug:'st-petersburg-fl-nursing-home-abuse'}];
type Page={id:number;status:string;link:string;slug:string;content:{raw:string;rendered:string}};
const marker='amplify-matching-local-resource';
function linked(html:string,url:string){return [...html.matchAll(/<ul\b[^>]*>[\s\S]*?<\/ul>/gi)].some(m=>m[0].includes(`href="${url}"`));}
function add(content:string,url:string,city:string,label:string){
 if(linked(content,url))return content;
 const block=`<!-- ${marker}:start -->\n<!-- wp:heading -->\n<h2>${city} Nursing Home Resources</h2>\n<!-- /wp:heading -->\n<!-- wp:list -->\n<ul class="wp-block-list"><li><a href="${url}">${label}</a></li></ul>\n<!-- /wp:list -->\n<!-- ${marker}:end -->`;
 if(content.includes(`<!-- ${marker}:start -->`))throw Error('Existing local resource section requires reconciliation.');
 return content.trimEnd()+'\n\n'+block+'\n';
}
export async function POST(request:NextRequest){
 let release:(()=>Promise<void>)|null=null;
 try{
 const {accessToken}=await authorizedAmplifyUser();
 const input=await request.json();if(!['inspect','apply'].includes(input.action))throw Error('Choose inspect or apply.');
 const config=await getWordPressConfigAsync(clientId,undefined,accessToken);
 if(new URL(config.siteUrl).hostname.replace(/^www\./,'')!=='pbglaw.com')throw Error('Incorrect client.');
 const headers={Authorization:wordPressAuthorization(config),'Content-Type':'application/json'};
 async function wp(path:string,body?:object){const r=await fetch(`${config.siteUrl}/wp-json/wp/v2/${path}`,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,cache:'no-store'});if(!r.ok)throw Error(`WordPress ${r.status}`);return r.json();}
 release=await uploadLease('rdcy-blog-geo-links');if(!release)throw Error('This reconciliation is already running.');
 const plans=[];
 for(const pair of pairs){
 const post:Page=await wp(`posts/${pair.postId}?context=edit`);
 const pages:Page[]=await wp(`pages?slug=${pair.slug}&context=edit`);if(pages.length!==1)throw Error('Ambiguous GEO destination.');const geo=pages[0];
 if(post.status!=='publish'||geo.status!=='publish'||!post.link.includes(`/blog/the-best-nursing-home-abuse-lawyer-in-${pair.slug.startsWith('sarasota')?'sarasota':'st-petersburg'}-fl-`))throw Error('Both exact matching pages must be public.');
 for(const [page,endpoint,target,label] of [[post,'posts',geo,pair.city],[geo,'pages',post,'Hiring Guide']] as const){
 const r=await fetch(target.link,{cache:'no-store'});const html=await r.text();if(!r.ok||r.url.replace(/\/$/,'')!==target.link.replace(/\/$/,'')||!/<h1\b/i.test(html))throw Error('Public destination verification failed.');
 plans.push({page,endpoint,target:target.link,content:add(page.content.raw,target.link,pair.city,label)});
 }
 }
 const results=[];
 for(const plan of plans){
 const {page,endpoint,target,content}=plan;let changed=false;
 if(input.action==='apply'&&content!==page.content.raw){
 const latest:Page=await wp(`${endpoint}/${page.id}?context=edit`);if(latest.content.raw!==page.content.raw||latest.status!==page.status||latest.link!==page.link)throw Error('Content changed during planning.');
 await uploadRedis().set(`amplify:post-publication:v1:backup:${clientId}:${endpoint}:${page.id}:${Date.now()}`,JSON.stringify(latest));
 await wp(`${endpoint}/${page.id}`,{content});changed=true;
 await uploadRedis().set('amplify:post-publication:v1:indexing:'+createHash('sha256').update(page.link).digest('hex'),JSON.stringify({clientId,property:'sc-domain:pbglaw.com',url:page.link,changedAt:new Date().toISOString(),state:'pending',reason:'Individual GSC Request indexing required after reciprocal link update.'}));
 }
 const saved:Page=input.action==='apply'?await wp(`${endpoint}/${page.id}?context=edit`):page;
 if(input.action==='apply'&&(saved.status!==page.status||saved.link!==page.link||saved.content.raw!==content||!linked(saved.content.rendered,target)))throw Error('Saved link verification failed.');
 results.push({id:page.id,endpoint,url:page.link,target,changed,needsUpdate:content!==page.content.raw,verified:linked(saved.content.rendered,target)});
 }
 return NextResponse.json({ok:true,results});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Link reconciliation failed.'},{status:400});}finally{if(release)await release();}
}
