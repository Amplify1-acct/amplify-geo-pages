import { getGoogleAccessToken, getGoogleEmail } from '@/lib/google';
import { isAronReviewer, listAronReviewItems, returnAronDraftToPreparation } from '@/lib/aron-review-queue';
import { refreshAronWordPressStatuses } from '@/lib/aron-wordpress-status';
import { getWordPressConfigAsync, wordPressAuthorization } from '@/lib/wordpress';
import { assertAmplifyFaqHtml } from '@/lib/faq-standard';
import { uploadRedis } from '@/lib/wordpress-upload-store';
import { revalidatePath } from 'next/cache';
export const dynamic='force-dynamic';
async function context(){
 const token=await getGoogleAccessToken();if(!isAronReviewer(await getGoogleEmail(token)))throw new Error('Authorized reviewer required.');
 const records=(await listAronReviewItems(true)).filter(r=>r.wordpressPageId===7493&&r.website.includes('fulginiti'));
 const r=records[0];if(!r)throw new Error('Post not present in shared review records.');
 const c=await getWordPressConfigAsync(r.clientId,r.website,token);
 const res=await fetch(`${c.siteUrl}/wp-json/wp/v2/posts/7493?context=edit`,{headers:{Authorization:wordPressAuthorization(c)},cache:'no-store'});
 const post=await res.json();if(!res.ok)throw new Error(post.message||'WordPress read failed');
 return {token,records,r,c,post};
}
async function returnToPreparation(){
 'use server';
 const {token,records,r,c,post}=await context();
 if(!['future','draft'].includes(post.status)||Date.parse(post.date_gmt+'Z')>=Date.now())throw new Error('Only the overdue draft may be recovered.');
 let faqError='';try{assertAmplifyFaqHtml(post.content.raw,c.siteUrl);}catch(e){faqError=e instanceof Error?e.message:String(e);}
 if(!faqError)throw new Error('No preparation failure found.');
 await uploadRedis().set(`amplify:missed-schedule-backup:7493:${Date.now()}`,{post,record:r});
 const response=await fetch(`${c.siteUrl}/wp-json/wp/v2/posts/7493`,{method:'POST',headers:{Authorization:wordPressAuthorization(c),'Content-Type':'application/json'},body:JSON.stringify({status:'draft'})});
 const saved=await response.json();if(!response.ok||saved.id!==7493||saved.status!=='draft'||saved.content.raw!==post.content.raw||saved.featured_media!==post.featured_media)throw new Error(saved.message||'Draft preservation not confirmed');
 const errors=await refreshAronWordPressStatuses(records,token);
 if(errors.get(r.id))throw new Error(errors.get(r.id));
 await returnAronDraftToPreparation(r.id,7493,[faqError]);
 revalidatePath('/maintenance/scheduled-status');
 revalidatePath('/editorial-calendar');
 revalidatePath('/aron-review');
}
export default async function Page(){
 const {token,records,r,c,post}=await context();
 const errors=await refreshAronWordPressStatuses(records,token);
 let faqError='';try{assertAmplifyFaqHtml(post.content.raw,c.siteUrl);}catch(e){faqError=e instanceof Error?e.message:String(e);}
 return <main><h1>Scheduled post status</h1><pre>{JSON.stringify({before:{status:r.wordpressStatus,archivedAt:r.reviewArchivedAt,archiveReason:r.reviewArchiveReason,preparationRequired:r.preparationRequired},post:{id:post.id,status:post.status,date_gmt:post.date_gmt,link:post.link,title:post.title,featured_media:post.featured_media,faqError,content:post.content.rendered},error:errors.get(r.id)},null,2)}</pre>{['future','draft'].includes(post.status)&&!!faqError&&!r.preparationRequired&&<form action={returnToPreparation}><button>Return overdue post to preparation</button></form>}</main>;
}
