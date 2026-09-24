import { getGoogleAccessToken, getGoogleEmail } from "@/lib/google";
import { isAronReviewer, listAronReviewItems, saveAronWordPressDraft, saveAronWordPressError } from "@/lib/aron-review-queue";
import { assertAmplifyFaqHtml } from "@/lib/faq-standard";
import { getWordPressConfigAsync, wordPressAuthorization } from "@/lib/wordpress";
import { uploadRedis } from "@/lib/wordpress-upload-store";
import { revalidatePath } from "next/cache";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
const documents = ["1cxCITfDTSekO2ECxdaNMjiByZEKtsJ9_cj_pameH5BY","1Fa0QjWVRUAg6CA5iinM9IakjfqWJY8OUTV-N0sd2mZw","1bEINcJV--5pS9DqyURc1PoO4KYNYxHpCAnzsob_jiy4","1AMAoNn2dDEBU_DQaxAvEdd3V8ulx66FnF92br_cD-bE","1luj_Sa8EloJgeVn7V6G157C5aOfamiitZ82_B2UGayw"];
async function recordVerification(docId:string) {
 'use server';
 if(!documents.includes(docId) || [documents[1],documents[2]].includes(docId))throw new Error('This draft has not passed image review.');
 const token=await getGoogleAccessToken();
 if(!isAronReviewer(await getGoogleEmail(token)))throw new Error('Authorized AMPLIFY account required.');
 const record=(await listAronReviewItems()).find(r=>r.docUrl.includes(`/d/${docId}/`));
 if(!record?.aronDone||!record.wordpressPageId)throw new Error('Approved draft required.');
 const config=await getWordPressConfigAsync(record.clientId,record.website,token);
 const headers={Authorization:wordPressAuthorization(config),'Content-Type':'application/json'};
 const response=await fetch(`${config.siteUrl}/wp-json/wp/v2/posts/${record.wordpressPageId}?context=edit`,{headers,cache:'no-store'});
 const post=await response.json();
 if(!response.ok || post.status!=='draft' || !post.featured_media || post.slug.includes('amplify-draft') || !post.content?.raw?.includes(`amplify-blog-source:${docId}`) || post.content.raw.includes('amplify-approval-intake'))throw new Error('Complete original draft required.');
 assertAmplifyFaqHtml(post.content.raw,config.siteUrl);
 if((post.content.raw.match(/<section\b[^>]*class="amplify-geo-cta\b/g)||[]).length!==3)throw new Error('Three CTAs required.');
 if(!post.yoast_head_json?.title||!post.yoast_head_json?.description)throw new Error('Saved SEO fields required.');
 const categoryResponse=await fetch(`${config.siteUrl}/wp-json/wp/v2/categories?include=${post.categories.join(',')}`,{headers,cache:'no-store'});
 const categories=await categoryResponse.json();
 if(!categoryResponse.ok||!categories.length||categories.some((c:{slug:string})=>c.slug==='uncategorized'))throw new Error('Relevant saved categories required.');
 await uploadRedis().set(`amplify:blog-verification:v1:${docId}:${Date.now()}`,JSON.stringify({record,post,checkedAt:new Date().toISOString(),renderedFaqAndImageReview:true}));
 const altText=docId===documents[0]?'Person beside a stopped work truck on a New Jersey neighborhood sidewalk':docId===documents[3]?'Passenger holding her neck in a car after a collision on a Florida residential street':'Parent and child outside a brick home during a parenting-time exchange in Staten Island';
 const mediaResponse=await fetch(`${config.siteUrl}/wp-json/wp/v2/media/${post.featured_media}?context=edit`,{headers,cache:'no-store'});
 const media=await mediaResponse.json();
 if(!mediaResponse.ok)throw new Error('Featured image metadata could not be checked.');
 await uploadRedis().set(`amplify:blog-media-backup:v1:${docId}:${Date.now()}`,JSON.stringify(media));
 const mediaSave=await fetch(`${config.siteUrl}/wp-json/wp/v2/media/${post.featured_media}`,{method:'POST',headers,body:JSON.stringify({alt_text:altText})});
 if(!mediaSave.ok)throw new Error('Descriptive image alt text could not be saved.');
 const content=post.content.raw.replace(/(<img\b[^>]*\bclass="[^"]*\bacta__image[^"]*"[^>]*\balt=")[^"]*(")/g,`$1${altText}$2`);
 const contentSave=await fetch(`${config.siteUrl}/wp-json/wp/v2/posts/${post.id}`,{method:'POST',headers,body:JSON.stringify({content,status:'draft'})});
 if(!contentSave.ok)throw new Error('CTA image descriptions could not be saved.');
 await saveAronWordPressDraft(record.id,{pageId:post.id,pageUrl:post.link,editUrl:record.wordpressEditUrl,previewUrl:record.wordpressPreviewUrl,featuredMediaId:post.featured_media,featuredImageUrl:record.featuredImageUrl,status:'draft',imageReviewRequired:false,preparationRequired:false,warnings:[]});
 revalidatePath('/maintenance/blog-audit');
}
async function recordTruckImageBlocker() {
 'use server';
 const token=await getGoogleAccessToken();
 if(!isAronReviewer(await getGoogleEmail(token)))throw new Error('Authorized AMPLIFY account required.');
 const records=await listAronReviewItems();
 for(const id of [documents[1],documents[2]]) {
 const record=records.find(r=>r.docUrl.includes(id));
 if(!record)throw new Error('Draft missing.');
 await saveAronWordPressError(record.id,'Featured image rejected during final review because of a vehicle logo. Three replacement attempts failed safety checks. A verified, unbranded, topic-appropriate image is still required before final approval.');
 }
 revalidatePath('/maintenance/blog-audit');
}
async function removeSupersededCopies() {
 'use server';
 const token=await getGoogleAccessToken();
 if(!isAronReviewer(await getGoogleEmail(token)))throw new Error('Authorized AMPLIFY account required.');
 const queue=await listAronReviewItems();
 const record=queue.find(r=>r.docUrl.includes(documents[0]));
 if(!record)throw new Error('Original Epstein record missing.');
 const config=await getWordPressConfigAsync(record.clientId,record.website,token);
 const headers={Authorization:wordPressAuthorization(config),'Content-Type':'application/json'};
 for(const [copyId,wrongDoc,originalId,correctDoc] of [[17764,'10JMrZKl3qru9bdQbzevnuBgkFTvoeTX9E28IZPaqpi8',17713,documents[0]],[17767,'1llNO19yzipAyMVGJm3P8XR9YDrOYje7hj0XkvZlUJ8k',17714,documents[1]]] as const) {
  const originalResponse=await fetch(`${config.siteUrl}/wp-json/wp/v2/posts/${originalId}?context=edit`,{headers,cache:'no-store'});
  const original=await originalResponse.json();
  if(!originalResponse.ok || original.status!=='draft' || !original.content?.raw?.includes(`amplify-blog-source:${correctDoc}`))throw new Error('Original approved intake must be verified before removing its extra copy.');
  await uploadRedis().set(`amplify:blog-original-backup:v1:${originalId}:${Date.now()}`,JSON.stringify(original));
  const response=await fetch(`${config.siteUrl}/wp-json/wp/v2/posts/${copyId}?context=edit`,{headers,cache:'no-store'});
  const copy=await response.json();
  if(copy.status==='trash')continue;
  if(!response.ok || copy.status!=='draft' || !copy.content?.raw?.includes(`amplify-blog-source:${wrongDoc}`))throw new Error('Extra draft identity could not be verified.');
  await uploadRedis().set(`amplify:blog-superseded-backup:v1:${copyId}:${Date.now()}`,JSON.stringify(copy));
  const remove=await fetch(`${config.siteUrl}/wp-json/wp/v2/posts/${copyId}`,{method:'DELETE',headers});
  const removed=await remove.json();
  if(!remove.ok || removed.status!=='trash')throw new Error('Extra copy was not confirmed in Trash.');
 }
 revalidatePath('/maintenance/blog-audit');
}
export default async function BlogAudit() {
 const token = await getGoogleAccessToken();
 if (!isAronReviewer(await getGoogleEmail(token))) return <main>Authorized AMPLIFY account required.</main>;
 const queue = await listAronReviewItems();
 const results = await Promise.all(documents.map(async docId=>{
  const record = queue.find(r=>r.docUrl.includes(`/d/${docId}/`));
  if(!record?.wordpressPageId) return {docId,error:"No linked draft"};
  const config=await getWordPressConfigAsync(record.clientId,record.website,token);
  async function read(path:string) {
   const response=await fetch(`${config.siteUrl}/wp-json/${path}`,{headers:{Authorization:wordPressAuthorization(config)},cache:"no-store",signal:AbortSignal.timeout(20000)});
   if(!response.ok) return {error:`HTTP ${response.status}`};
   return response.json();
  }
  const post=await read(`wp/v2/posts/${record.wordpressPageId}?context=edit`);
  const media=post.featured_media?await read(`wp/v2/media/${post.featured_media}?context=edit`):null;
  const categories=await read(`wp/v2/categories?include=${(post.categories||[]).join(',')}`);
  const oldIntake=record.clientId&&config.siteUrl.includes('theepsteinlawfirm.com')?await read(`wp/v2/posts/${docId===documents[0]?17713:17714}?context=edit&_fields=id,status,slug,title,content`):undefined;
  return {docId,client:record.clientName,post:{id:post.id,status:post.status,slug:post.slug,title:post.title,content:post.content,excerpt:post.excerpt,date:post.date,date_gmt:post.date_gmt,featured_media:post.featured_media,categories,meta:post.meta,acf:post.acf,yoast_head_json:post.yoast_head_json},media:media&&{id:media.id,url:media.source_url,alt:media.alt_text},oldIntake};
 }));
 return <main><h1>Prepared blog verification</h1><p>WordPress draft details. No publication action.</p><form action={removeSupersededCopies}><button>Back up and trash the two superseded preparation copies</button></form><form action={recordTruckImageBlocker}><button>Record the two image blockers</button></form>{results.map(r=><article key={r.docId}><h2>{r.docId}</h2>{![documents[1],documents[2]].includes(r.docId)&&<form action={recordVerification.bind(null,r.docId)}><button>Record verified preparation for {r.docId}</button></form>}<pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(r,null,2)}</pre></article>)}</main>;
}
