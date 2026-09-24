import test from 'node:test';
import assert from 'node:assert/strict';
import {protectThemeFaqAnchors} from '../src/lib/blog-final-preparation.ts';
import {extractAmplifyFaqSection} from '../src/lib/faq-standard.ts';
import {restoreEpsteinApprovedDocument} from '../src/lib/epstein-approved-documents.ts';
test('verified original document mapping preserves client and calendar record identity',()=>{
 const item={id:'calendar-record',workflow:'blog',website:'https://www.theepsteinlawfirm.com',docUrl:'https://docs.google.com/document/d/10JMrZKl3qru9bdQbzevnuBgkFTvoeTX9E28IZPaqpi8/edit',wordpressPageId:17764};
 const fixed=restoreEpsteinApprovedDocument(item);
 assert.equal(fixed.id,item.id);assert.equal(fixed.wordpressPageId,17713);assert.match(fixed.docUrl,/1cxCITfDTSekO2ECxdaNMjiByZEKtsJ9_cj_pameH5BY/);
 assert.deepEqual(restoreEpsteinApprovedDocument({...item,website:'https://other.example'}),{...item,website:'https://other.example'});
 assert.deepEqual(restoreEpsteinApprovedDocument(fixed),fixed);
});
test('visible question anchors survive a theme replacing heading IDs',()=>{
 const original='<h2 id="faq">New York Parenting FAQs</h2><p>General information.</p><h3 id="faq-question">Question?</h3><p id="answer-question">Answer.</p>';
 const prepared=protectThemeFaqAnchors(original);
 const themed=prepared.replace(/<h([23]) id="heading-[^"]+"/g,'<h$1 id="section-10"');
 assert.equal(extractAmplifyFaqSection(themed).entries[0].questionId,'faq-question');
 assert.equal(extractAmplifyFaqSection(themed).entries[0].questionIdPresent,true);
 assert.equal(protectThemeFaqAnchors(prepared),prepared);
});
