import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { blogPublicationPlan } from '../src/lib/blog-publication.ts';

const now = new Date('2026-09-09T15:30:00Z');
test('late final approval publishes now without backdating', () => {
  assert.deepEqual(blogPublicationPlan('2026-09-08T09:00:00-04:00', now), {
    status: 'publish', overdue: true, dateGmt: now.toISOString(),
  });
});
test('future final approval preserves the calendar instant, including DST', () => {
  assert.equal(blogPublicationPlan('2026-09-15T09:00:00-04:00', now).dateGmt, '2026-09-15T13:00:00.000Z');
  assert.equal(blogPublicationPlan('2026-11-10T09:00:00-05:00', now).dateGmt, '2026-11-10T14:00:00.000Z');
  assert.equal(blogPublicationPlan('2026-09-09T15:30:30Z', now).status, 'future');
});
test('due now publishes, blank publishes, invalid dates fail closed', () => {
  assert.equal(blogPublicationPlan(now.toISOString(), now).status, 'publish');
  assert.equal(blogPublicationPlan(undefined, now).dateGmt, now.toISOString());
  assert.throws(() => blogPublicationPlan('not-a-date', now), /invalid/);
});

function routeFixture({ ownerApproved = true, faqReady = true, status = 'draft', savedDate, wrongSchedule = false } = {}) {
  const writes = [];
  const docId = 'approved_blog_doc_123';
  const page = { id: 77, status, date_gmt: savedDate, link: 'https://firm.test/blog/', content: {raw:
    `<!-- amplify-blog-source:${docId} -->${faqReady ? '<!-- amplify-faq-standard:test -->' : ''}` } };
  const modules = {
    'next/server': {NextResponse: Response},
    '@/lib/blog-publication': {blogPublicationPlan},
    '@/lib/google': {getGoogleAccessToken: async () => 'test', getGoogleEmail: async () => 'accounts@amplifylaw.ai'},
    '@/lib/client-store': {getClientProfileAsync: async () => ({id: 'test', wordpress: {}})},
    '@/lib/wordpress': {getWordPressConfigAsync: async () => ({siteUrl: 'https://firm.test'}), wordPressAuthorization: () => 'test'},
    '@/lib/faq-standard': {AMPLIFY_FAQ_STANDARD_VERSION: 'test', assertAmplifyFaqHtml: () => {}, validateAmplifyLiveFaq: () => ({passed: true})},
  };
  const fetch = async (url, options = {}) => {
    if (options.method === 'POST') {
      const body = JSON.parse(options.body); writes.push(body);
      return Response.json({...page, ...body, date_gmt: wrongSchedule ? '2040-01-01T00:00:00' : body.date_gmt});
    }
    if (String(url).includes('context=edit')) return Response.json(page);
    if (String(url).includes('amplify_faq_verify')) return new Response('<html>verified fixture</html>');
    throw new Error('Unexpected request ' + url);
  };
  const source = fs.readFileSync(new URL('../src/app/api/wordpress/go-live/route.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS}}).outputText;
  const exports = {};
  vm.runInNewContext(`(function(require,exports){${compiled}\n})`, {fetch, URL, Response, AbortSignal, Date, console, process: {env: {}}})(name => modules[name] || {}, exports);
  return {writes, run: (publishAt) => exports.POST(new Request('https://app.test/api/wordpress/go-live', {
    method: 'POST', body: JSON.stringify({clientId: 'test', pageId: 77, docId, workflow: 'blog', ownerApproved, publishAt}),
  }))};
}
test('API requires final approval even when a slot is overdue', async () => {
  const f = routeFixture({ownerApproved: false});
  assert.equal((await f.run('2020-01-01T13:00:00Z')).status, 400);
  assert.equal(f.writes.length, 0);
});
test('API does not publish an unprepared overdue draft', async () => {
  const f = routeFixture({faqReady: false});
  assert.equal((await f.run('2020-01-01T13:00:00Z')).status, 422);
  assert.equal(f.writes.length, 0);
});
test('API explicitly replaces an old draft date on overdue final approval', async () => {
  const f = routeFixture(); const start = Date.now();
  const result = await (await f.run('2020-01-01T13:00:00Z')).json();
  assert.equal(result.status, 'publish');
  assert.equal(f.writes[0].status, 'publish');
  assert.ok(Date.parse(f.writes[0].date_gmt) >= start);
  assert.ok(Date.parse(f.writes[0].date_gmt) <= Date.now());
});
test('API saves and verifies the future slot', async () => {
  const f = routeFixture();
  const result = await (await f.run('2040-09-15T09:00:00-04:00')).json();
  assert.equal(result.status, 'future');
  assert.equal(result.scheduledAt, '2040-09-15T13:00:00.000Z');
  assert.equal(f.writes[0].date_gmt, result.scheduledAt);
});
test('API rejects a mismatched saved schedule and does not falsely finalize retries', async () => {
  const f = routeFixture({wrongSchedule: true});
  assert.notEqual((await (await f.run('2040-09-15T13:00:00Z')).json()).ok, true);
  const retry = routeFixture({status: 'future', savedDate: '2040-01-01T00:00:00'});
  assert.equal((await retry.run('2040-09-15T13:00:00Z')).status, 409);
  assert.equal(retry.writes.length, 0);
});
