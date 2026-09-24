import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the screen's real approval handler with network writes stubbed out.
const source = fs.readFileSync(new URL('../src/app/final-review/[id]/page.tsx', import.meta.url), 'utf8');
const handler = source.slice(source.indexOf('  async function approve()'), source.indexOf('  return <main'));
const compiled = ts.transpileModule(handler, {compilerOptions: {target: ts.ScriptTarget.ES2022}}).outputText;
async function approve(slot, assigned, ready = true) {
  const writes = [], errors = [];
  const record = {id: 'manual-blog', workflow: 'blog', wordpressPageId: 77, clientId: 'firm', docUrl: 'https://docs.google.com/document/d/doc123/edit'};
  const sandbox = {
    record, id: record.id, ready: true, busy: false, slot,
    finalApprovalReady: () => ready,
    setBusy() {}, setRecord() {}, setResult() {}, setLinking() {},
    setError: message => errors.push(message),
    json: async (url, body) => {
      if (body) writes.push({url, body});
      if (url.startsWith('/api/aron/review-queue')) return {records: [record], archivedRecords: []};
      if (url === '/api/editorial') return {slots: assigned ? [{...assigned, contentRecordId: record.id}] : []};
      if (url === '/api/wordpress/go-live') return {ok: true, status: assigned ? 'future' : 'publish'};
      throw new Error('Unexpected request');
    },
  };
  await vm.runInNewContext(`${compiled}\napprove()`, sandbox);
  return {writes: writes.filter(w => w.url === '/api/wordpress/go-live'), errors};
}
const slot = {id: 'calendar-slot', publishAt: '2030-09-21T13:00:00Z'};
test('manual blog without a slot reaches publication only through final approval', async () => {
  const result = await approve();
  assert.equal(result.writes.length, 1);
  assert.equal(result.writes[0].body.ownerApproved, true);
  assert.equal(result.writes[0].body.publishAt, undefined);
});
test('assigned future date is preserved', async () => {
  const result = await approve(slot, slot);
  assert.equal(result.writes[0].body.publishAt, slot.publishAt);
});
test('added, removed, replaced, or rescheduled slots block stale approval', async () => {
  for (const [shown, current] of [[undefined, slot], [slot, undefined], [slot, {...slot, id: 'replacement'}], [slot, {...slot, publishAt: '2030-09-22T13:00:00Z'}]]) {
    const result = await approve(shown, current);
    assert.equal(result.writes.length, 0);
    assert.match(result.errors.at(-1), /slot changed/);
  }
});
test('a draft whose readiness changed cannot publish', async () => {
  const result = await approve(undefined, undefined, false);
  assert.equal(result.writes.length, 0);
  assert.match(result.errors.at(-1), /draft status changed/);
});
