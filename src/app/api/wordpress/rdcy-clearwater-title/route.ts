import {NextRequest, NextResponse} from 'next/server';
import {createHash} from 'node:crypto';
import {authorizedAmplifyUser} from '@/lib/permissions';
import {getWordPressConfigAsync, wordPressAuthorization} from '@/lib/wordpress';
import {uploadRedis, uploadLease} from '@/lib/wordpress-upload-store';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
const clientId = 'rafferty-domnick-cunningham-yaffa';
const targets:Record<number,{slug:string;title:string}> = {19314:{slug:'clearwater-fl-nursing-home-abuse',title:'Nursing Home Abuse Lawyer in Clearwater FL'},19311:{slug:'lakeland-fl-nursing-home-abuse',title:'Lakeland FL Nursing Home Abuse Lawyer'},19317:{slug:'tampa-fl-nursing-home-abuse',title:'Tampa FL Nursing Home Abuse Lawyer'}};
type Page = {id:number; status:string; link:string; content:{raw:string}};
export async function POST(request:NextRequest) {
 let release:(()=>Promise<void>)|null = null;
 try {
  const {accessToken} = await authorizedAmplifyUser();
  const {action,pageId=19314} = await request.json();
  const target=targets[pageId]; if(!target) throw Error('Unsupported repair target.');
  const url='https://www.pbglaw.com/'+target.slug+'/';
  const heading='<h1 class="wp-block-heading page-content__title">'+target.title+'</h1>';
  if (!['inspect','apply'].includes(action)) throw Error('Choose inspect or apply.');
  const config = await getWordPressConfigAsync(clientId, undefined, accessToken);
  if (new URL(config.siteUrl).hostname.replace(/^www\./,'') !== 'pbglaw.com') throw Error('Incorrect client.');
  const headers = {Authorization:wordPressAuthorization(config),'Content-Type':'application/json'};
  async function wp(body?:object):Promise<Page> {
   const r = await fetch(`${config.siteUrl}/wp-json/wp/v2/pages/${pageId}${body?'':'?context=edit'}`, {method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,cache:'no-store'});
   if (!r.ok) throw Error(`WordPress ${r.status}`);
   return r.json();
  }
  release = await uploadLease('rdcy-clearwater-title');
  if (!release) throw Error('Repair already running.');
  const page = await wp();
  if (page.id !== pageId || page.status !== 'publish' || page.link !== url) throw Error('Unexpected page.');
  const count = page.content.raw.split(heading).length - 1;
  if (count > 1 || (count === 0 && /<h1\b/i.test(page.content.raw))) throw Error('Unexpected title markup.');
  const content = page.content.raw.replace(heading, '');
  let backupKey:string|null = null;
  if (action === 'apply' && count === 1) {
   const latest = await wp();
   if (latest.content.raw !== page.content.raw || latest.status !== page.status || latest.link !== url) throw Error('Page changed during repair.');
   backupKey = `amplify:post-publication:v1:backup:${clientId}:pages:${pageId}:${Date.now()}`;
   await uploadRedis().set(backupKey, JSON.stringify(page));
   await wp({content});
   await uploadRedis().set('amplify:post-publication:v1:indexing:'+createHash('sha256').update(url).digest('hex'), JSON.stringify({clientId,property:'sc-domain:pbglaw.com',url,changedAt:new Date().toISOString(),state:'pending',reason:'Individual GSC Request indexing required after duplicate title correction.'}));
   const saved = await wp();
   if (saved.content.raw !== content || saved.status !== 'publish' || saved.link !== url) throw Error('Saved page verification failed.');
  }
  return NextResponse.json({ok:true,url,needsUpdate:count===1,changed:action==='apply'&&count===1,backupKey,onlyChange:'Remove the duplicate body H1; preserve template title and all other content.'});
 } catch(e) {return NextResponse.json({error:e instanceof Error?e.message:'Repair failed.'},{status:400});}
 finally {if(release) await release();}
}
