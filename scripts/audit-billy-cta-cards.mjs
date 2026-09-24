// Read-only public WordPress and sitemap audit. Emits NDJSON; makes no writes.
import {parseDocument} from 'htmlparser2';
import {findAll, textContent} from 'domutils';
import {readFileSync} from 'node:fs';

const origin = 'https://www.billycooperlaw.com';
const stamp = Date.now();
const types = ['pages', 'posts', 'areas', 'attorney', 'post-author', 'news', 'testimonials', 'video'];
const emit = data => console.log(JSON.stringify(data));
const clean = s => (s || '').replace(/\s+/g, ' ').trim();
const find = (d, predicate) => findAll(predicate, d.children || []);
const classes = e => (e.attribs?.class || '').split(/\s+/);
const inside = (e, parents) => {for(let p=e.parent; p; p=p.parent) if(parents.includes(p)) return true; return false;};
const normalize = input => {
  const u = new URL(input, origin);
  u.searchParams.delete('amplify_audit');
  u.hash = '';
  return u.href;
};
async function request(url) {
  for(let attempt=0; attempt<3; attempt++) {
    try {
      const u = new URL(url);u.searchParams.set('amplify_audit', stamp);
      const response = await fetch(u, {cache:'no-store', signal:AbortSignal.timeout(30000)});
      const body = await response.text();
      if((response.status===429 || response.status>=500) && attempt<2) continue;
      return {status:response.status, url:normalize(response.url), headers:response.headers, body};
    } catch(error) {if(attempt===2) return {status:0,url,error:error.message,body:'',headers:new Headers()};}
  }
}
function cards(html) {
  const d = parseDocument(html, {decodeEntities:true});
  const marked = find(d, e => ['section','figure','div','aside'].includes(e.name) &&
    classes(e).some(c => c==='amplify-geo-cta' || /^billy-card-v\d/.test(c) || /^amplify-client-cta-v\d/.test(c)));
  const roots = marked.filter(e => !inside(e, marked));
  const unwrapped = find(d, e => e.name==='img' && !inside(e, roots) &&
    /(?:\/api\/cta(?:\?|\/)|billy-card|(?:^|[-_/])cta(?:[-_.?/]|$))/i.test(Object.values(e.attribs || {}).join(' ')));
  const versions = [...new Set(roots.flatMap(e => classes(e).filter(c => /^(?:billy-card|amplify-client-cta)-v/.test(c))))];
  const approved = roots.filter(e => classes(e).includes('billy-card-v4-html-r2')).length;
  const older = roots.length - approved + unwrapped.length;
  const candidates = find(d, e => !inside(e, roots) && !roots.includes(e) &&
    /(?:^|[-_\s])(?:cta|call-to-action)(?:$|[-_\s])/i.test((e.attribs?.class || '')+' '+(e.attribs?.id || '')))
    .filter(e => !['style','script','a','button'].includes(e.name))
    .map(e => ({tag:e.name,class:e.attribs.class || '',id:e.attribs.id || '',text:clean(textContent(e)).slice(0,150)}));
  return {total:roots.length+unwrapped.length, approved, older, versions,
    unwrappedImages:unwrapped.map(e => ({src:e.attribs.src || e.attribs['data-src'],alt:e.attribs.alt || ''})),
    candidates};
}

const records = new Map();
const inventories = [];
for(const type of types) {
  let total=0, pages=1, count=0;
  for(let page=1; page<=pages; page++) {
    const r = await request(`${origin}/wp-json/wp/v2/${type}?status=publish&per_page=100&page=${page}&_fields=id,link,title,content,modified,parent`);
    if(r.status!==200) throw new Error(`Inventory failed: ${type}, ${page}, HTTP ${r.status}`);
    const items = JSON.parse(r.body);
    total=Number(r.headers.get('x-wp-total'));pages=Number(r.headers.get('x-wp-totalpages'));
    for(const p of items) {
      count++;
      records.set(normalize(p.link), {type,id:p.id,url:normalize(p.link),title:clean(textContent(parseDocument(p.title?.rendered || ''))),parent:p.parent,modified:p.modified,rest:cards(p.content?.rendered || '')});
    }
  }
  if(count!==total) throw new Error(`Incomplete inventory ${type}: ${count}/${total}`);
  inventories.push({type,total});
}
emit({event:'inventory',at:new Date(stamp).toISOString(),inventories});

const index = await request(`${origin}/sitemap_index.xml`);
if(index.status!==200) throw new Error('Sitemap index failed');
const xmlLocs = body => find(parseDocument(body,{xmlMode:true}), e => e.name==='loc').map(textContent);
const sitemaps=[];
for(const url of xmlLocs(index.body)) {
  const r = await request(url);
  if(r.status!==200) throw new Error(`Sitemap failed: ${url}`);
  const urls = xmlLocs(r.body).map(normalize);
  sitemaps.push({url,total:urls.length});
  for(const link of urls) {
    const record = records.get(link);
    if(record) record.sitemap=url;
    else records.set(link, {type:url.includes('category-sitemap')?'archive':'sitemap-only',url:link,sitemap:url});
  }
}
emit({event:'sitemaps',sitemaps,urlsToCheck:records.size});

const resumePath = process.argv.find(arg => arg.startsWith('--skip-checked='))?.split('=').slice(1).join('=');
const checked = new Set(resumePath ? JSON.parse(readFileSync(resumePath,'utf8')) : []);
const queue = [...records.values()].filter(record => !checked.has(record.url));
let next=0;
async function worker() {
  while(next<queue.length) {
    const record=queue[next++];
    const r=await request(record.url);
    const d=parseDocument(r.body,{decodeEntities:true});
    const canonical=find(d,e=>e.name==='link' && e.attribs.rel==='canonical')[0]?.attribs.href;
    const robots=find(d,e=>e.name==='meta' && e.attribs.name==='robots')[0]?.attribs.content || '';
    const h1=find(d,e=>e.name==='h1').map(e=>clean(textContent(e))).filter(Boolean);
    const live=cards(r.body);
    emit({event:'page',...record,status:r.status,finalUrl:r.url,canonical:canonical?normalize(canonical):null,robots,h1,error:r.error,
      live,classification:r.status!==200?'unverified':live.total===0?'no-card':live.approved===0?'older-only':live.older?'mixed':'approved'});
  }
}
await Promise.all(Array.from({length:4},worker));
emit({event:'complete',at:new Date().toISOString(),checked:queue.length});
