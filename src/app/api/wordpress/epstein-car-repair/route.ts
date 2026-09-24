import { relevantFeaturedImage } from "@/lib/content-featured-image";
import { NextRequest, NextResponse } from "next/server";
import { getGoogleAccessToken, getGoogleEmail } from "@/lib/google";
import { getAronReviewItem, isAronReviewer, saveAronWordPressDraft } from "@/lib/aron-review-queue";
import { getClientProfileAsync } from "@/lib/client-store";
import { wordPressAuthorization, getWordPressConfigAsync } from "@/lib/wordpress";
import { uploadRedis, uploadLease } from "@/lib/wordpress-upload-store";
import { insertCtaBlocks, normalizeEpsteinTypography } from "@/lib/cta";
import { buildAmplifyFaqSchemaNode } from "@/lib/faq-standard";
export const maxDuration = 300;
const batch: Record<string,string> = {
"7213ce31-606d-4bc9-85b5-4d3e9447ef66":"Mahwah",
"32e82054-0598-4c65-84ed-7b19e0b941b4":"Bergenfield",
"853e0c94-7cdd-42e1-aea2-9c49c0a4c19b":"Cliffside Park",
"7bbd3b6c-ff44-4dee-a85f-57f2892b51ed":"Englewood",
"97ac5455-c984-4450-870a-299ffa92bb99":"Englewood Cliffs",
"62cb310f-e4da-40c4-9f56-cbad96d2bde9":"Fort Lee",
"bdf57eb1-ca4e-4d50-8cf2-1cac8e65d34c":"Garfield",
"4b554a07-c24e-478f-a5cd-366c1a596124":"Hackensack",
"4321bf13-8870-4de8-8e4c-279634834315":"Paramus",
"8733677e-e0e9-4a35-987a-ebc0223cc04d":"Rochelle Park",
"c0f691f9-535d-436f-9e30-e753917869ca":"Teaneck",
"3ea00543-6033-4e2d-8597-4fd53887a304":"Ridgewood",
};
export async function POST(request: NextRequest) {
 let release: (()=>Promise<void>) | undefined;
 try {
  const {id, typographyOnly, newImage, ridgewoodLinks}=await request.json();
  const city=batch[id]; if(!city) throw new Error("Select a record from the audited batch.");
  const token=await getGoogleAccessToken();
  if(!isAronReviewer(await getGoogleEmail(token))) return NextResponse.json({error:"Sign in to an approved account."},{status:403});
  release=await uploadLease(`job:${id}`) || undefined; if(!release) throw new Error("This record is busy; retry shortly.");
  const record=await getAronReviewItem(id); if(!record?.wordpressPageId) throw new Error("Saved WordPress page not found.");
  const client=await getClientProfileAsync(record.clientId,record.website,token);
  if(!client || new URL(client.website).hostname.replace(/^www\./,"")!=="theepsteinlawfirm.com") throw new Error("Wrong client.");
  const config=await getWordPressConfigAsync(client.id,client.website,token);
  const headers={Authorization:wordPressAuthorization(config),"Content-Type":"application/json"};
  async function wp(path:string,body?:unknown) {
   const r=await fetch(`${config.siteUrl}/wp-json/${path}`,{method:body?"POST":"GET",headers,body:body?JSON.stringify(body):undefined,cache:"no-store",signal:AbortSignal.timeout(25000)});
   if(!r.ok || !r.headers.get("content-type")?.includes("application/json")) throw new Error(`WordPress returned ${r.status}.`);
   return r.json();
  }
  const page=await wp(`wp/v2/pages/${record.wordpressPageId}?context=edit`);
  if (ridgewoodLinks) {
   if(city!=="Ridgewood" || page.status!=="publish" || /amplify-draft/.test(page.slug)) throw new Error("Ridgewood must be published at its permanent URL first.");
   const parent=await wp(`wp/v2/pages/${page.parent}?context=edit`);
   if(parent.status!=="publish" || parent.slug!=="ridgewood-personal-injury-lawyer") throw new Error("The Ridgewood parent could not be verified.");
   const matches=await wp("wp/v2/pages?slug=ridgewood-dog-bite-lawyers&status=publish&context=edit");
   if(!Array.isArray(matches) || matches.length!==1) throw new Error("The live Ridgewood dog bite page could not be verified.");
   const dog=matches[0];
   const members=[{page:parent,label:"Personal Injury"},{page,label:"Car Accidents"},{page:dog,label:"Dog Bites"}];
   const plans=members.map(member=>{
    const block=`<!-- amplify-ridgewood-practice-links:start --><h2>Injury cases we handle in Ridgewood NJ</h2><ul>${members.map(other=>`<li>${other.page.id===member.page.id?other.label:`<a href="${other.page.link}">${other.label}</a>`}</li>`).join("")}</ul><!-- amplify-ridgewood-practice-links:end -->`;
    const raw=member.page.content.raw;
    const cleaned=raw.replace(/<!-- amplify-ridgewood-practice-links:start -->[\s\S]*?<!-- amplify-ridgewood-practice-links:end -->/g,"").trimEnd();
    return {...member,content:cleaned+"\n\n"+block};
   });
   for(const plan of plans) await uploadRedis().set(`amplify:ridgewood-links-backup:v1:${plan.page.id}`,plan.page,{nx:true});
   for(const plan of plans){
    await wp(`wp/v2/pages/${plan.page.id}`,{content:plan.content});
    const saved=await wp(`wp/v2/pages/${plan.page.id}?context=edit`);
    if(saved.status!=="publish" || saved.slug!==plan.page.slug || saved.content.raw!==plan.content || saved.featured_media!==plan.page.featured_media) throw new Error(`Ridgewood links failed verification on page ${plan.page.id}.`);
   }
   return NextResponse.json({ok:true,city:"Ridgewood reciprocal links on all three pages",status:"published"});
  }
  if(page.status!==(city==="Mahwah"?"publish":"draft")) throw new Error("Publication status changed; repair stopped for review.");
  await uploadRedis().set(`amplify:epstein-car-repair-backup:v1:${page.id}`,{page,record},{nx:true});
  if (newImage) {
   if(!["Paramus","Rochelle Park"].includes(city) || !record.aronDone) throw new Error("Select an approved image-repair draft.");
   await uploadRedis().set(`amplify:epstein-image-backup:v1:${page.id}`,{page,record},{nx:true});
   const media=await relevantFeaturedImage(config.siteUrl,headers.Authorization,{pageTitle:page.title.raw,clientName:client.name,sourceId:`${id}-fresh-enhancement-v1`,practiceArea:"Car Accidents",jurisdiction:`${city} NJ`,contentType:"enhance"});
   if(!media.id || !media.source_url) throw new Error("New image missing.");
   const content=insertCtaBlocks(page.content.raw,{origin:request.nextUrl.origin,client,location:`${city} NJ`,practiceArea:"Car Accidents",imageUrl:media.source_url,forceRefresh:true});
   await wp(`wp/v2/pages/${page.id}`,{content,featured_media:media.id});
   const saved=await wp(`wp/v2/pages/${page.id}?context=edit`);
   if(saved.status!=="draft" || saved.slug!==page.slug || saved.content.raw!==content || saved.featured_media!==media.id) throw new Error("Image update failed verification.");
   await saveAronWordPressDraft(id,{pageId:page.id,pageUrl:record.wordpressUrl,editUrl:record.wordpressEditUrl,previewUrl:record.wordpressPreviewUrl,featuredMediaId:media.id,featuredImageUrl:media.source_url,status:"draft",preparationRequired:record.preparationRequired,warnings:record.draftWarnings});
   return NextResponse.json({ok:true,city,status:"draft",imageUrl:media.source_url});
  }
  if (typographyOnly) {
   await uploadRedis().set(`amplify:epstein-typography-backup:v1:${page.id}`,{page,record},{nx:true});
   const content=normalizeEpsteinTypography(page.content.raw,client);
   await wp(`wp/v2/pages/${page.id}`,{content});
   const saved=await wp(`wp/v2/pages/${page.id}?context=edit`);
   if(saved.content.raw!==content || saved.status!==page.status || saved.slug!==page.slug || saved.featured_media!==page.featured_media || saved.title.raw!==page.title.raw) throw new Error("Typography save failed verification.");
   return NextResponse.json({ok:true,city,status:saved.status,url:saved.link});
  }
  const clean=(s:string)=>s.replace(new RegExp(`${city}\\s+NJ\\s+Car Accident\\s+NJ`,"gi"),`${city} NJ Car Accident`);
  const title=`${city} NJ Car Accident Lawyer`;
  let content=clean(page.content.raw);
  // WordPress's banner already supplies the main heading.
  if(city==="Ridgewood") content=content.replace(/<h1\b[^>]*>[\s\S]*?<\/h1>/i,"");
  const media=await wp(`wp/v2/media/${page.featured_media}?context=edit&_fields=id,source_url`);
  if(!media.source_url) throw new Error("Existing featured image missing.");
  content=insertCtaBlocks(content,{origin:request.nextUrl.origin,client,location:`${city} NJ`,practiceArea:"Car Accidents",imageUrl:media.source_url,forceRefresh:true});
  const pageUrl=city==="Ridgewood" ? page.link : (record.pageUrl || page.link);
  const faq=buildAmplifyFaqSchemaNode(content,pageUrl); if(!faq) throw new Error("Matching FAQ schema could not be built.");
  const schema={"@context":"https://schema.org","@graph":[{"@type":"LegalService","@id":`${pageUrl}#legal-service`,name:`${client.name} — Car Accidents in ${city} NJ`,url:pageUrl,serviceType:"Car Accidents",areaServed:{"@type":"City",name:`${city} NJ`},provider:{"@type":"LegalService",name:client.name,url:client.website}},faq]};
  const description=clean(page.excerpt?.raw || `Car accident legal help in ${city} NJ from The Epstein Law Firm. Call for a free case evaluation.`);
  await wp(`wp/v2/pages/${page.id}`,{title,content,excerpt:description});
  const meta=await wp("amplify-geo/v1/page-meta",{page_id:page.id,seo_title:`${title} | Epstein Law Firm`,meta_description:description,client_id:client.id,schema});
  if(!meta.saved) throw new Error("Metadata was not confirmed.");
  const saved=await wp(`wp/v2/pages/${page.id}?context=edit`);
  if(saved.status!==page.status || saved.slug!==page.slug || saved.featured_media!==page.featured_media || saved.title.raw!==title || /NJ Car Accident NJ/i.test(saved.content.raw) || saved.content.raw!==content) throw new Error("Saved repair failed verification.");
  return NextResponse.json({ok:true,city,title,status:saved.status,url:saved.link});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Repair failed."},{status:500});}
 finally {if(release) await release();}
}
