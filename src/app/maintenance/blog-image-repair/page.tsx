import { rebaseSchemaPermalink } from "@/lib/schema-permalink";
import { getGoogleAccessToken, getGoogleEmail } from '@/lib/google';
import { isAronReviewer, listAronReviewItems, saveAronWordPressDraft } from '@/lib/aron-review-queue';
import { getWordPressConfigAsync, wordPressAuthorization } from '@/lib/wordpress';
import { assertAmplifyFaqHtml, validateAmplifyLiveFaq } from '@/lib/faq-standard';
import { uploadRedis } from '@/lib/wordpress-upload-store';
import { listEditorialSlots } from '@/lib/editorial-store';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
export const dynamic='force-dynamic';
export const maxDuration=300;
const targets=[
 {doc:'1cxCITfDTSekO2ECxdaNMjiByZEKtsJ9_cj_pameH5BY',post:17713,asset:'epstein-government',sha256:'34b6de8790626826d44b849fe0a7c2fd5c3a3ae034fdc67c8cac66b91f20a7f1',label:'Epstein government',host:'www.theepsteinlawfirm.com',alt:'Unmarked work truck beside an uneven sidewalk on a New Jersey suburban street'},
 {doc:'1Fa0QjWVRUAg6CA5iinM9IakjfqWJY8OUTV-N0sd2mZw',post:17714,asset:'epstein-pip',sha256:'782b5ed94351cd1d5e2c599051c1acde227923e06068a1415ee5103f63c6ff53',label:'Epstein PIP',host:'www.theepsteinlawfirm.com',alt:'Silver sedan with collision damage on a tree-lined New Jersey suburban street'},
 {doc:'1bEINcJV--5pS9DqyURc1PoO4KYNYxHpCAnzsob_jiy4',post:7620,asset:'fulginiti-settlement',sha256:'27f6102d16dd3c9c18f0f387860d77f1d8e3dc01fe34f8502ec123260a5b50dc',label:'Fulginiti settlement',host:'www.fulginiti-law.com',alt:'Tractor-trailer and damaged passenger car stopped beside a Pennsylvania roadway'},
];
async function context(doc:string){
 const target=targets.find(t=>t.doc===doc);if(!target)throw new Error('Unknown draft');
 const token=await getGoogleAccessToken();if(!isAronReviewer(await getGoogleEmail(token)))throw new Error('Authorized reviewer required');
 const record=(await listAronReviewItems()).find(r=>r.docUrl.includes(`/d/${doc}/`));
 if(!record?.aronDone||record.wordpressPageId!==target.post)throw new Error('Approved original draft identity required');
 const config=await getWordPressConfigAsync(record.clientId,record.website,token);
 if(new URL(config.siteUrl).hostname!==target.host)throw new Error('Wrong WordPress host');
 const headers={Authorization:wordPressAuthorization(config)};
 async function request(path:string,body?:unknown){const response=await fetch(`${config.siteUrl}/wp-json/wp/v2/${path}`,{headers:{...headers,'Content-Type':'application/json'},cache:'no-store',...(body?{method:'POST',body:JSON.stringify(body)}:{})});const result=await response.json();if(!response.ok)throw new Error(result.message||`WordPress ${response.status}`);return result;}
 const post=await request(`posts/${target.post}?context=edit`);
 if(post.status!=='draft'||!post.content?.raw?.includes(`amplify-blog-source:${doc}`)||post.content.raw.includes('amplify-approval-intake')||post.slug.includes('amplify-draft'))throw new Error('Prepared original draft required');
 assertAmplifyFaqHtml(post.content.raw,config.siteUrl);
 if((post.content.raw.match(/<section\b[^>]*class="amplify-geo-cta\b/g)||[]).length!==3)throw new Error('Three complete CTAs required');
 const slot=(await listEditorialSlots()).find(s=>s.contentRecordId===record.id&&s.clientId===record.clientId);if(!slot)throw new Error('Assigned editorial slot required');
 return {target,record,post,config,headers,request,slot};
}
async function replace(form:FormData){
 'use server';
 const doc=String(form.get('doc'));const c=await context(doc);
 if(form.get('reviewed')!=='on')throw new Error('Visual image review required');
 const response=await fetch(`https://amplify-geo-pages.vercel.app/blog-reviewed/${c.target.asset}.jpg`,{cache:'no-store'});if(!response.ok)throw new Error('Reviewed asset unavailable');
 const bytes=Buffer.from(await response.arrayBuffer());if(createHash('sha256').update(bytes).digest('hex')!==c.target.sha256)throw new Error('Reviewed asset checksum mismatch');
 const metadata=await sharp(bytes).metadata();if(metadata.format!=='jpeg'||!metadata.width||metadata.width<1000)throw new Error('Landscape JPEG required');
 const redis=uploadRedis();await redis.set(`amplify:blog-image-backup:v1:${doc}:${Date.now()}`,JSON.stringify({post:c.post,record:c.record,slot:c.slot}));
 const upload=await fetch(`${c.config.siteUrl}/wp-json/wp/v2/media`,{method:'POST',headers:{...c.headers,'Content-Type':'image/jpeg','Content-Disposition':`attachment; filename="${c.target.label.toLowerCase().replace(/ /g,'-')}-reviewed.jpg"`},body:bytes});
 const media=await upload.json();if(!upload.ok||!media.id||!media.source_url)throw new Error('Image upload failed');
 await c.request(`media/${media.id}`,{alt_text:c.target.alt});
 let count=0;const content=c.post.content.raw.replace(/<img\b[^>]*\bclass="[^"]*\b(?:acta|flcta)__image\b[^"]*"[^>]*>/g,(tag:string)=>{count++;return tag.replace(/\bsrc="[^"]*"/,`src="${media.source_url}"`).replace(/\balt="[^"]*"/,`alt="${c.target.alt}"`).replace(/\s+srcset="[^"]*"/g,'');});
 if(count!==3)throw new Error('Expected exactly three CTA image tags');
 assertAmplifyFaqHtml(content,c.config.siteUrl);
 const current=await c.request(`posts/${c.post.id}?context=edit`);if(current.status!=='draft'||current.content.raw!==c.post.content.raw||current.featured_media!==c.post.featured_media)throw new Error('Draft changed during replacement; retry from current draft');
 await c.request(`posts/${c.post.id}`,{content,featured_media:media.id,status:'draft'});
 const saved=await c.request(`posts/${c.post.id}?context=edit`);if(saved.status!=='draft'||saved.featured_media!==media.id||saved.slug!==c.post.slug||saved.content.raw!==content)throw new Error('Saved replacement verification failed');
 await redis.set(`amplify:blog-image-reviewed:v1:${doc}`,{mediaId:media.id,url:media.source_url,at:new Date().toISOString()});
 await saveAronWordPressDraft(c.record.id,{pageId:saved.id,pageUrl:saved.link,editUrl:c.record.wordpressEditUrl,previewUrl:c.record.wordpressPreviewUrl,featuredMediaId:media.id,featuredImageUrl:media.source_url,status:'draft',imageReviewRequired:false,preparationRequired:true,warnings:[]});
 revalidatePath('/maintenance/blog-image-repair');
}
async function verify(form:FormData){
 'use server';
 const doc=String(form.get('doc'));const c=await context(doc);
 const review=await uploadRedis().get<{mediaId:number,url:string}>(`amplify:blog-image-reviewed:v1:${doc}`);
 if(!review||review.mediaId!==c.post.featured_media)throw new Error('Reviewed image is not attached');
 if(!c.post.yoast_head_json?.title||!c.post.yoast_head_json?.description)throw new Error('SEO fields required');
 const categories=await c.request(`categories?include=${c.post.categories.join(',')}`);if(!categories.length||categories.some((v:{slug:string})=>v.slug==='uncategorized'))throw new Error('Relevant categories required');
 const media=await c.request(`media/${review.mediaId}?context=edit`);if(media.alt_text!==c.target.alt)throw new Error('Alt text mismatch');
 let schema=JSON.parse(String(form.get('schema')||''));
 const check=validateAmplifyLiveFaq(`<link rel="canonical" href="${c.post.link}">${c.post.content.raw}<script type="application/ld+json">${JSON.stringify(schema)}</script>`,c.post.link);
 if(!check.passed)throw new Error(check.errors.join(' '));
 const articles=(schema['@graph'] as Array<Record<string,unknown>>).filter(n=>n['@type']==='BlogPosting');if(articles.length!==1||articles[0].url!==c.post.link)throw new Error('Original article schema required');
 await uploadRedis().set(`amplify:blog-schema-backup:v1:${doc}:${Date.now()}`,{schema,post:c.post});
 articles[0].image={'@type':'ImageObject',url:review.url,caption:c.target.alt};
 if(form.get('publicPermalink')==='on') {
   if(c.post.id!==7620||c.post.slug!=='is-it-better-to-settle-with-insurance-or-hire-a-pennsylvania-truck-accident-lawyer')throw new Error('Exact approved publication identity required');
   const permalink='https://www.fulginiti-law.com/is-it-better-to-settle-with-insurance-or-hire-a-pennsylvania-truck-accident-lawyer/';
   schema=rebaseSchemaPermalink(schema,permalink);
   const finalCheck=validateAmplifyLiveFaq(`<link rel="canonical" href="${permalink}">${c.post.content.raw}<script type="application/ld+json">${JSON.stringify(schema)}</script>`,permalink);
   if(!finalCheck.passed)throw new Error(finalCheck.errors.join(' '));
 }
 const bridge=await fetch(`${c.config.siteUrl}/wp-json/amplify-geo/v1/page-meta`,{method:'POST',headers:{...c.headers,'Content-Type':'application/json'},body:JSON.stringify({page_id:c.post.id,seo_title:c.post.meta._yoast_wpseo_title,meta_description:c.post.meta._yoast_wpseo_metadesc,client_id:c.record.clientId,hero_image_id:review.mediaId,schema})});
 const bridgeResult=await bridge.json();if(!bridge.ok||bridgeResult.heroImageId!==review.mediaId||bridgeResult.heroResolvedId!==review.mediaId)throw new Error('Image schema and theme hero verification failed');
 const checked=await c.request(`posts/${c.post.id}?context=edit`);if(checked.status!=='draft'||checked.content.raw!==c.post.content.raw||checked.featured_media!==review.mediaId)throw new Error('Draft changed during metadata verification');

 await uploadRedis().set(`amplify:blog-verification:v1:${doc}:${Date.now()}`,{post:c.post,slot:c.slot,reviewedAt:new Date().toISOString()});
 await saveAronWordPressDraft(c.record.id,{pageId:c.post.id,pageUrl:c.post.link,editUrl:c.record.wordpressEditUrl,previewUrl:c.record.wordpressPreviewUrl,featuredMediaId:review.mediaId,featuredImageUrl:review.url,status:'draft',imageReviewRequired:false,preparationRequired:false,warnings:[]});
 revalidatePath('/maintenance/blog-image-repair');
}
export default async function Page(){
 const token=await getGoogleAccessToken();if(!isAronReviewer(await getGoogleEmail(token)))return <main>Authorized AMPLIFY reviewer required.</main>;
 const results=await Promise.all(targets.map(async t=>{try{const c=await context(t.doc);const media=await c.request(`media/${c.post.featured_media}?context=edit`);return {target:t,record:c.record,post:c.post,media,slot:c.slot,error:''};}catch(e){return {target:t,error:e instanceof Error?e.message:String(e)};}}));
 return <main style={{maxWidth:1000,margin:'40px auto',padding:24}}><h1>Replace reviewed blog images</h1><p>Changes only the featured image and the three CTA images on the original WordPress drafts. Approved article text, FAQs, metadata, slugs, and calendar slots are preserved. No publication action.</p>{results.map(r=><article key={r.target.doc}><h2>{r.target.label}</h2>{!r.record||!r.slot?<p>{r.error}</p>:<><p>Post {r.post.id}: {r.post.status}. Preparation {r.record.preparationRequired?'awaiting verification':'verified'}. Assigned slot: {r.slot.publishAt}</p><a href={r.record.wordpressPreviewUrl}>Review WordPress draft</a><p><a href={r.media.source_url}>Current featured image</a></p><form action={replace}><input type="hidden" name="doc" value={r.target.doc}/><a href={`/blog-reviewed/${r.target.asset}.jpg`}>Reviewed replacement photo</a><label><input name="reviewed" type="checkbox" required/> Visually checked: relevant vehicle, plausible location, no text or branding</label><button>Replace {r.target.label} draft images</button></form><form action={verify}><input type="hidden" name="doc" value={r.target.doc}/><label>Existing rendered article schema<textarea name="schema" required aria-label={`Existing ${r.target.label} schema`}/></label><label><input name="publicPermalink" type="checkbox"/> Prepare schema for the approved Fulginiti public permalink</label><button>Record verified {r.target.label} preparation</button></form><details><summary>Saved draft details</summary><pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify({post:r.post,media:r.media},null,2)}</pre></details></>}</article>)}</main>;
}
