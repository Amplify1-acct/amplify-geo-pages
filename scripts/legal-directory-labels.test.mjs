import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeLegalLocationDirectoryLabels as normalize} from '../src/lib/geo-directory-labels.ts';
test('geographic labels retain URLs, formatting, qualifiers and unlinked cities',()=>{
 const html='<h2>Communities We Serve</h2><ul><li><a href="/soundview/?x=1&amp;y=2"><strong>Soundview NY E-Bike Accident Lawyer</strong></a></li><li>Co-op City NY Slip and Fall Lawyer</li><li><a href="/yonkers/">Yonkers NY Car Accident Lawyer (en español)</a></li><li>New City</li></ul>';
 const result=normalize(html);
 assert.equal(result.changed,3);
 assert.equal(result.content,'<h2>Communities We Serve</h2><ul><li><a href="/soundview/?x=1&amp;y=2"><strong>Soundview</strong></a></li><li>Co-op City</li><li><a href="/yonkers/">Yonkers (en español)</a></li><li>New City</li></ul>');
 assert.equal(normalize(result.content).changed,0);
});
test('recognizes a repeated accident directory under a custom heading',()=>{
 assert.equal(normalize('<h2>Nearby Help</h2><ul><li>Soundview E-Bike Accident Lawyer</li><li>Fordham E-Bike Accident Lawyer</li></ul>').changed,2);
});
test('leaves prose, sources, substantive bullets and same-location practice lists intact',()=>{
 for(const html of [
 '<p><a href="/">Soundview NY E-Bike Accident Lawyer</a></p>',
 '<h2>Sources</h2><ul><li>Soundview E-Bike Accident Lawyer</li><li>Fordham Car Accident Lawyer</li></ul>',
 '<h2>Types of accidents we handle in Soundview NY</h2><ul><li>E-Bike Accidents</li><li>Slip and Fall</li></ul>',
 '<h2>Related practices</h2><ul><li>Soundview E-Bike Accident Lawyer</li><li>Soundview Slip and Fall Lawyer</li></ul>',
 '<h2>Communities We Serve</h2><ul><li>Speak with a lawyer about your car accident</li><li><a href="/">Soundview</a> has local resources.</li></ul>'
 ]) assert.equal(normalize(html).content,html);
});

import {prepareTopicCommunityDirectory} from '../src/lib/geo-directory.ts';
test('county topic directory rejects general injury, other topics, drafts and out-of-county pages',()=>{
 const content='<h2>Rockland County Communities We Serve</h2><ul><li><a href="/rockland-county/">Rockland County</a></li><li><a href="/ramapo/">Ramapo</a></li><li>Clarkstown</li><li>Haverstraw</li><li>New City</li><li>Spring Valley</li></ul>';
 const current={id:8395,slug:'clarkstown-ny-e-bike-accident-lawyer-amplify-draft-abc',title:{raw:'Clarkstown NY E-Bike Accident Lawyer'},content:{raw:content}};
 const page=(id,city,topic,status='publish')=>({id,title:{rendered:`${city} NY ${topic} Lawyer`},slug:`${city.toLowerCase().replaceAll(' ','-')}-ny-${topic.toLowerCase().replaceAll(' ','-')}`,link:`https://example.com/${id}/`,status});
 const result=prepareTopicCommunityDirectory(current,[page(1,'Rockland County','Personal Injury'),page(2,'Ramapo','E-Bike Accident'),page(8395,'Clarkstown','E-Bike Accident'),page(3,'Haverstraw','Slip and Fall'),page(4,'New City','E-Bike Accident','draft'),page(5,'Spring Valley','E-Bike Accident'),page(6,'Yonkers','E-Bike Accident')]);
 assert.match(result,/<h2>E-Bike Accident Lawyers Serving Rockland County<\/h2>/);
 assert.deepEqual([...result.matchAll(/href="([^"]+)"/g)].map(m=>m[1]),['https://example.com/2/','https://example.com/5/']);
 assert.match(result,/<li>Clarkstown<\/li>/);
 assert.match(result,/<li>New City<\/li>/);
 assert.equal((result.match(/<li>/g)||[]).length,6);
 const none=prepareTopicCommunityDirectory(current,[]);
 assert.equal((none.match(/href=/g)||[]).length,0);
 assert.equal(prepareTopicCommunityDirectory({...current,content:{raw:result}},[page(2,'Ramapo','E-Bike Accident'),page(5,'Spring Valley','E-Bike Accident')]),result);
});

import {communityDirectoryLabels} from '../src/lib/geo-directory.ts';
test('premium refresh adds missing canonical county list at a complete block boundary and remains idempotent',()=>{
 const labels=['New York County','Manhattan','Harlem',"Hell's Kitchen",'Upper East Side'];
 const county={id:7591,status:'publish',title:{raw:'New York County NY Personal Injury Lawyer'},content:{raw:'<h2>Communities We Serve</h2><ul>'+labels.map(x=>'<li>'+x.replace("'",'&#039;')+'</li>').join('')+'</ul><h2>Nearby areas</h2><ul><li>Harlem</li></ul>'}};
 const page=(id,city,topic,status='publish')=>({id,status,title:{raw:city+' NY '+topic+' Lawyer'},link:'https://example.com/'+id+'/'});
 const pages=[county,page(1,'Harlem','Car Accident'),page(2,"Hell's Kitchen",'Car Accident','draft'),page(3,'Upper East Side','E-Bike Accident'),page(4,'Fordham','Car Accident')];
 const content='<!-- wp:paragraph --><p>Complete introduction.</p><!-- /wp:paragraph -->\n<!-- wp:heading --><h2>Evidence</h2><!-- /wp:heading --><!-- wp:paragraph --><p>Keep this evidence section together.</p><!-- /wp:paragraph -->';
 const current={id:8626,status:'draft',title:{raw:'Manhattan NY Car Accident Lawyer'},content:{raw:content}};
 const result=prepareTopicCommunityDirectory(current,pages);
 assert.deepEqual(communityDirectoryLabels(result),labels);
 assert.deepEqual([...result.matchAll(/href="([^"]+)"/g)].map(x=>x[1]),['https://example.com/1/']);
 assert.ok(result.startsWith('<!-- wp:paragraph --><p>Complete introduction.</p><!-- /wp:paragraph -->'));
 assert.ok(result.endsWith('<!-- wp:heading --><h2>Evidence</h2><!-- /wp:heading --><!-- wp:paragraph --><p>Keep this evidence section together.</p><!-- /wp:paragraph -->'));
 assert.equal(prepareTopicCommunityDirectory({...current,content:{raw:result}},pages),result);
 const shorter={...current,content:{raw:'<h2>Communities We Serve</h2><ul><li>Harlem</li></ul><h2>Evidence</h2><p>Preserve evidence.</p>'}};
 assert.deepEqual(communityDirectoryLabels(prepareTopicCommunityDirectory(shorter,pages)),labels);
});
test('legacy county SEO title formats still resolve the canonical roster',()=>{
 for(const title of ['Personal Injury Lawyer | Bronx County, NY','Westchester County, NY Personal Injury Lawyer','Personal Injury Lawyer | Brooklyn, NY | Kings County']){
 const county=title.includes('Bronx')?'Bronx County':title.includes('Westchester')?'Westchester County':'Kings County - Brooklyn';
 const page={id:1,status:'publish',title:{raw:title},content:{raw:'<h2>Communities We Serve</h2><ul><li>'+county+'</li><li>Test City</li></ul>'}};
 const html=prepareTopicCommunityDirectory({id:2,title:{raw:'Test City NY Car Accident Lawyer'},content:{raw:'<p>Intro.</p><h2>Evidence</h2><p>Preserve this.</p>'}},[page]);
 assert.deepEqual(communityDirectoryLabels(html),[county,'Test City']);assert.ok(html.includes('Lawyers Serving '+county+'</h2>'));
 }
});
