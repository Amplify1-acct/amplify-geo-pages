type ClusterPage={id:number;title:string;url:string};
const escapeHtml=(value:string)=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');

// The caller supplies only verified live members of the same local cluster.
export function insertSubAopClusterSection(content:string,currentId:number,parent:ClusterPage,pages:ClusterPage[],location:string) {
  const marker=`amplify-subaop-cluster:${parent.id}:${location.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`;
  const start=`<!-- ${marker} -->`,end=`<!-- /${marker} -->`;
  const priorStart=content.indexOf(start),priorEnd=content.indexOf(end);
  const clean=priorStart>=0&&priorEnd>priorStart?content.slice(0,priorStart)+content.slice(priorEnd+end.length):content;
  const section=`${start}\n<!-- wp:heading -->\n<h2>${escapeHtml(location)} Injury Practice Areas</h2>\n<!-- /wp:heading -->\n${currentId===parent.id?'':`<!-- wp:paragraph -->\n<p>Learn more about our <a href="${escapeHtml(parent.url)}">${escapeHtml(parent.title)}</a> practice.</p>\n<!-- /wp:paragraph -->\n`}<!-- wp:list -->\n<ul class="wp-block-list">${pages.map(page=>`<li>${page.id===currentId?escapeHtml(page.title):`<a href="${escapeHtml(page.url)}">${escapeHtml(page.title)}</a>`}</li>`).join('')}</ul>\n<!-- /wp:list -->\n${end}`;
  const openingCta=clean.indexOf('<!-- amplify-geo-cta:opening -->');
  const heading=clean.search(/<!--\s*wp:heading\b[^>]*-->\s*<h2\b|<h2\b/i);
  const at=openingCta>=0?openingCta:heading>=0?heading:clean.length;
  return `${clean.slice(0,at).trimEnd()}\n${section}\n${clean.slice(at).trimStart()}`;
}
