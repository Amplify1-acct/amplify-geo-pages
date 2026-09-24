import assert from 'node:assert/strict';
const origin='https://www.billycooperlaw.com';
const base=`${origin}/es/condado-de-westchester/yonkers/`;
const slugs=['abogado-resbalones-caidas','abogado-accidentes-bicicletas-electricas','abogado-accidentes-auto','abogado-accidentes-uber-lyft','abogado-accidentes-reparto'];
const plain=s=>s.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
async function get(url){const target=new URL(url);if(target.pathname.startsWith('/wp-json/'))target.searchParams.set('amplify_verify',String(Date.now()));const r=await fetch(target,{signal:AbortSignal.timeout(30000),headers:{'Cache-Control':'no-cache'}});assert.equal(r.status,200,url);return r;}
const parent=await (await get(`${origin}/wp-json/wp/v2/pages/7283`)).json();
const list=content=>content.match(/<h2\b[^>]*>Tipos de accidentes[\s\S]*?<\/h2>\s*<ul\b[^>]*>[\s\S]*?<\/ul>/i)?.[0]||'';
const directory=content=>content.match(/<h2\b[^>]*>Comunidades que servimos<\/h2>\s*(?:<!--[\s\S]*?-->\s*)*<ul\b[^>]*>[\s\S]*?<\/ul>/i)?.[0]||'';
const labels=content=>[...content.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map(m=>plain(m[1]));
assert.equal(labels(list(parent.content.rendered)).length,5,'Parent accident list must contain exactly five services');
for(const slug of slugs)assert.ok(list(parent.content.rendered).includes(`${base}${slug}/`),`Parent missing ${slug}`);
const parentHtml=await (await get(base)).text();
for(const slug of slugs)assert.ok(list(parentHtml).includes(`${base}${slug}/`),`Public parent missing ${slug}`);
const roster=labels(directory(parent.content.rendered));
assert.deepEqual(roster,['Condado de Westchester','Yonkers','Greenburgh','New Rochelle','Mount Vernon']);
const report=[];
for(const slug of slugs){
 const candidates=await (await get(`${origin}/wp-json/wp/v2/pages?slug=${slug}`)).json();
 assert.equal(candidates.length,1,`Unique page for ${slug}`);
 const p=candidates[0];const c=p.content.rendered;
 assert.equal(p.parent,7283);assert.equal(p.status,'publish');assert.equal(p.template,'templates/template-default-espanol.php');assert.equal(p.featured_media,7062);assert.equal(p.link,`${base}${slug}/`);
 assert.ok(plain(c).split(/\s+/).length>3000,'Complete Spanish article');
 assert.ok(c.includes('spanish_cooper_firm-overview-aop_260609-v1_v2-1440p.mp4'));
 assert.ok(!c.includes('__HTML_'),'No untranslated placeholders');
 assert.ok(!/<h[1-3][^>]*>\s*(?:<b>)?(?:Sources|What to Do|Frequently Asked|Related Practice)/i.test(c),'Localized headings');
 const services=list(c);assert.equal(labels(services).length,5);
 for(const sibling of slugs)assert.equal(services.includes(`${base}${sibling}/`),sibling!==slug,`Sibling link/self text: ${sibling}`);
 assert.ok(c.includes(`href="${base}"`),'Child must link back to its main Spanish AOP');
 assert.deepEqual(labels(directory(c)),roster,'Canonical community order');
 const cards=[...c.matchAll(/<figure\b[^>]*class="[^"]*billy-card-v3[^>]*>[\s\S]*?<\/figure>/g)];
 assert.equal(cards.length,3);
 for(const card of cards){assert.ok(card[0].includes('data-no-lazy="1"'));assert.ok(card[0].includes('loading="eager"'));assert.ok(card[0].includes('margin:32px 0'));assert.ok(card[0].includes(`${origin}/wp-content/uploads/`));}
 const rendered=await (await get(p.link)).text();
 const hero=rendered.match(/<div[^>]*class="page-hero__image"[^>]*>([\s\S]*?)<\/div>/)?.[1]||'';
 assert.ok(hero.includes('01_Yonkers_NY'),'Theme banner must render the original English Yonkers image');
 const canonical=rendered.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)/i)?.[1];
 assert.equal(canonical,p.link,'Self-referencing Spanish canonical');
 assert.ok(!/<meta[^>]*name=["']robots["'][^>]*noindex/i.test(rendered),'Indexable page');
 assert.ok(rendered.includes('es-US'),'Spanish schema');
 report.push({id:p.id,url:p.link,title:plain(p.title.rendered),words:plain(c).split(/\s+/).length,canonical,htmlLanguage:rendered.match(/<html[^>]*lang=["']([^"']+)/i)?.[1],checks:'passed'});
}
console.log(JSON.stringify({parent:base,roster,pages:report},null,2));
