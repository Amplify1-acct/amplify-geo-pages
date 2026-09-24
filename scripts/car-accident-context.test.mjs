import test from 'node:test';
import assert from 'node:assert/strict';
import {enhancementCtaContext, insertCtaBlocks, normalizeEpsteinTypography, usesNewEnhancementImage} from '../src/lib/cta.ts';
const client={name:'The Epstein Law Firm',website:'https://www.theepsteinlawfirm.com',practiceAreas:['Personal Injury','Auto Accidents'],jurisdictions:['New Jersey'],phoneDisplay:'(201) 231-7847',phoneHref:'+12012317847',brand:{primary:'#000000',secondary:'#ffffff',accent:'#cfab40',surface:'#ffffff'},cta:{}};
test('singular car accident titles resolve the city and topic, including previously malformed titles',()=>{
 for(const city of ['Mahwah','Bergenfield','Englewood Cliffs','Fort Lee']) for(const title of [`${city} NJ Car Accident Lawyer`,`${city} Nj Car Accident NJ Lawyer`]){
 assert.deepEqual(enhancementCtaContext(title,`https://www.theepsteinlawfirm.com/${city.toLowerCase().replaceAll(' ','-')}-car-accident-lawyers/`,client),{location:city,practiceArea:'Car Accidents'});
 }
});
test('all three car CTA headlines identify the accident type without duplicating the state',()=>{
 const html=insertCtaBlocks('<p>Opening.</p><h2>Evidence</h2><p>Evidence.</p><h2>Insurance</h2><p>Insurance.</p>',{origin:client.website,client,location:'Bergenfield NJ',practiceArea:'Car Accidents',imageUrl:client.website+'/image.webp',forceRefresh:true});
 assert.match(html,/Injured in a Bergenfield NJ Car Accident\?/);assert.match(html,/Questions About a Bergenfield NJ Car Accident Claim\?/);assert.match(html,/Discuss Your Bergenfield NJ Car Accident/);assert.doesNotMatch(html,/Accident NJ|Personal Injury/);
});

test('preview URLs without a city fall back to the title without carrying a second state',()=>{
 assert.deepEqual(enhancementCtaContext('Bergenfield NJ Car Accident NJ Lawyer','https://www.theepsteinlawfirm.com/?page_id=17781&preview=true',client),{location:'Bergenfield NJ',practiceArea:'Car Accidents'});
});
test('malformed CTA locations fail before a draft can be marked prepared',()=>{
 assert.throws(()=>insertCtaBlocks('<h2>Evidence</h2><p>Text.</p>',{origin:client.website,client,location:'Bergenfield NJ Car Accident NJ',practiceArea:'Personal Injury',imageUrl:client.website+'/image.webp'}),/location contains an accident type/);
});

test('Epstein typography is applied once, including refreshes, and never to other firms',()=>{
 const original='<p class="wp-block-paragraph">Copy</p><ul class="wp-block-list"><li>Item</li></ul>';
 const fixed=normalizeEpsteinTypography(original,client);
 assert.equal(normalizeEpsteinTypography(fixed,client),fixed);
 assert.equal(normalizeEpsteinTypography(original,{website:'https://www.billycooperlaw.com'}),original);
 assert.match(fixed,/font-size:16px;line-height:1.6/);
 const options={origin:client.website,client,location:'Mahwah NJ',practiceArea:'Car Accidents'};
 const prepared=insertCtaBlocks(original,options);
 assert.equal((insertCtaBlocks(prepared,options).match(/data-amplify-epstein-typography=/g)||[]).length,1);
});

test('refresh replaces all three CTA images with the newly prepared featured image',()=>{
 const options={origin:client.website,client,location:'Paramus NJ',practiceArea:'Car Accidents',forceRefresh:true};
 const old=insertCtaBlocks('<p>Intro</p><h2>Evidence</h2><p>Details</p><h2>Claims</h2><p>More</p>',{...options,imageUrl:client.website+'/old-team.jpg'});
 const updated=insertCtaBlocks(old,{...options,imageUrl:client.website+'/new-car.jpg'});
 assert.doesNotMatch(updated,/old-team.jpg/);
 assert.equal((updated.match(/src="https:\/\/www.theepsteinlawfirm.com\/new-car.jpg"/g)||[]).length,3);
});

test('new enhancement imagery is limited to Epstein',()=>{
 assert.equal(usesNewEnhancementImage(client),true);
 for(const website of ['https://www.billycooperlaw.com','https://www.fulginiti-law.com','https://www.myfloridainjurylaw.com','https://theepsteinlawfirm.com.example.org']) assert.equal(usesNewEnhancementImage({website}),false);
});
test('Billy retains his portrait and approved CTA background when featured imagery changes',()=>{
 const billy={...client,id:'billy-cooper-law',name:'Billy Cooper Law',website:'https://www.billycooperlaw.com'};
 const opts={origin:'https://amplify-geo-pages.vercel.app',client:billy,location:'Westchester NY',practiceArea:'Car Accidents',forceRefresh:true};
 const html='<p>Intro</p><h2>Help</h2><p>Details</p>';
 const before=insertCtaBlocks(html,{...opts,imageUrl:billy.website+'/old.jpg'});
 const after=insertCtaBlocks(html,{...opts,imageUrl:billy.website+'/new.jpg'});
 assert.equal(before,after);
 assert.match(after,/billy-cooper-cutout-v4.webp/);
 assert.match(after,/billy-card-v4-html-r2/);
 assert.doesNotMatch(after,/new.jpg/);
});
