import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(name, globals = {}, deps = {}) {
  const code = ts.transpileModule(fs.readFileSync(new URL(`../src/lib/${name}.ts`, import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports = {};
  vm.runInNewContext(`(function(require,exports){${code}\n})`, { Date, Map, Set, Error, AbortSignal, ...globals })(id => deps[id], exports);
  return exports;
}

function clock() {
  let now = 0, id = 0;
  const timers = new Map(), listeners = new Set();
  const document = {
    visibilityState: 'visible',
    addEventListener: (_, fn) => listeners.add(fn),
    removeEventListener: (_, fn) => listeners.delete(fn),
  };
  return {
    timers, listeners, document,
    globals: { document, Date: { now: () => now }, setTimeout: (fn, ms) => { timers.set(++id, { fn, at: now + ms }); return id; }, clearTimeout: id => timers.delete(id) },
    visibility(value) { document.visibilityState = value; for (const fn of listeners) fn(); },
    async tick(ms) {
      now += ms;
      for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.fn(); }
      await Promise.resolve(); await Promise.resolve();
    },
  };
}

test('hidden tabs issue no polls and resume without an immediate duplicate', async () => {
  const c = clock(); let calls = 0;
  c.visibility('hidden');
  const stop = load('visible-polling', c.globals).startVisiblePolling(async () => { calls++; });
  await c.tick(60_000); assert.equal(calls, 0);
  c.visibility('visible'); await c.tick(0); assert.equal(calls, 1);
  c.visibility('hidden'); await c.tick(10_000); c.visibility('visible');
  await c.tick(0); assert.equal(calls, 1);
  await c.tick(50_000); assert.equal(calls, 2);
  stop(); assert.equal(c.timers.size, 0); assert.equal(c.listeners.size, 0);
});

test('slow requests never overlap and cleanup stops an in-flight poll rescheduling', async () => {
  const c = clock(); let calls = 0, finish;
  const stop = load('visible-polling', c.globals).startVisiblePolling(() => { calls++; return new Promise(resolve => { finish = resolve; }); });
  await c.tick(0); await c.tick(180_000);
  c.visibility('hidden'); c.visibility('visible'); await c.tick(0);
  assert.equal(calls, 1); stop(); finish(); await c.tick(0);
  assert.equal(c.timers.size, 0);
});

test('failed loads wait five minutes, including across visibility changes', async () => {
  const c = clock(); let calls = 0;
  const stop = load('visible-polling', c.globals).startVisiblePolling(async () => { calls++; return calls !== 1; });
  await c.tick(0); await c.tick(60_000);
  c.visibility('hidden'); c.visibility('visible'); await c.tick(0); assert.equal(calls, 1);
  await c.tick(240_000); assert.equal(calls, 2);
  await c.tick(60_000); assert.equal(calls, 3); stop();
});

test('quota errors explain service availability without exposing Redis commands', () => {
  const { reviewErrorMessage, isStorageLimitError } = load('storage-error');
  const message = reviewErrorMessage(new Error('ERR max requests limit exceeded. command was: ["hgetall","private-key"]'));
  assert.match(message, /monthly usage allowance/); assert.doesNotMatch(message, /hgetall|private-key/);
  assert.equal(isStorageLimitError('Google token expired'), false);
  assert.equal(reviewErrorMessage(new Error('Google token expired')), 'Google token expired');
});

test('recent bulk checks skip all database and WordPress calls; individual review forces a fresh check', async () => {
  let slotReads = 0, wpReads = 0, writes = 0;
  const { refreshAronWordPressStatuses } = load('aron-wordpress-status', {
    fetch: async () => { wpReads++; return { ok: true, headers: new Headers({'content-type':'application/json'}), json: async () => [{id: 42, status: 'draft'}] }; },
  }, {
    '@/lib/editorial-store': { editorialStoreConfigured: () => true, listEditorialSlots: async () => { slotReads++; return []; } },
    '@/lib/wordpress': { getWordPressConfigAsync: async () => ({siteUrl: 'https://example.test'}), wordPressAuthorization: () => 'test' },
    '@/lib/aron-review-queue': { saveAronWordPressStatus: async () => { writes++; } },
  });
  const records = [{id:'one', wordpressPageId:42, aronDone:true, wordpressCheckedAt:new Date().toISOString()}];
  await refreshAronWordPressStatuses(records, 'test');
  assert.equal(slotReads + wpReads + writes, 0);
  await refreshAronWordPressStatuses(records, 'test', true);
  assert.equal(slotReads, 1); assert.equal(wpReads, 1); assert.equal(writes, 1);
});
