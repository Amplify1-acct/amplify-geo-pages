import assert from 'node:assert/strict';
import test from 'node:test';
import { preparePageTitle } from '../src/lib/wordpress-theme-title.ts';

test('RDCY imports rely on the theme H1 and preserve all remaining content', () => {
  const body = '<p>Introduction</p><h2>What to Do Now</h2><p>Keep this section.</p>';
  for (const url of ['https://www.pbglaw.com', 'https://pbglaw.com/']) {
    for (const title of ['Nursing Home Abuse Lawyer in Sarasota FL', 'Orlando FL Nursing Home Abuse Lawyer']) {
      const result = preparePageTitle(body, title, url);
      assert.equal(result, body);
      assert.equal((`<h1>${title}</h1>${result}`.match(/<h1\b/g) || []).length, 1);
    }
  }
});

test('other clients retain their existing imported H1 behavior', () => {
  assert.equal(preparePageTitle('<p>Body</p>', 'Page Title', 'https://example.com'), '<h1>Page Title</h1>\n<p>Body</p>');
});
