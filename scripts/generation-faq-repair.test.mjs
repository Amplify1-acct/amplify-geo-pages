import test from 'node:test';import assert from 'node:assert/strict';
import {nextFaqRepairAttempt,faqRepairPrompt} from '../src/lib/generation-faq-repair.ts';
test('allows two correction attempts and then fails closed',()=>{
 assert.equal(nextFaqRepairAttempt({}),1);assert.equal(nextFaqRepairAttempt({faq_repair_attempt:'1'}),2);
 for(const value of ['2','3','-1','NaN','0.5'])assert.equal(nextFaqRepairAttempt({faq_repair_attempt:value}),null);
});
test('source correction keeps the specific validation failures and authority requirements',()=>{
 const prompt=faqRepairPrompt(['FAQ 2 repeats a source URL.']);
 assert.match(prompt,/FAQ 2 repeats a source URL/);assert.match(prompt,/Do not append irrelevant sources/);assert.match(prompt,/entire corrected Markdown/);
});
