import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

import { ENTRY_TEXT_CAPS } from '../public/search/shards.mjs';
import { fillPageShardText } from './search-page-text.mjs';

const page = (title, description, main) => `<!doctype html><html><head>
<title>${title}</title>
<meta name="description" content="${description}">
</head><body>
<header><nav><a href="/">Home</a></nav></header>
${main}
<footer><p>Book a call today with the team</p></footer>
</body></html>`;

function distWith(files) {
  const dir = mkdtempSync(join(tmpdir(), 'search-page-text-'));
  for (const [route, html] of Object.entries(files)) {
    const file = join(dir, route === '/' ? 'index.html' : `${route.slice(1)}.html`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, html);
  }
  return dir;
}

const clean = (dist) => rmSync(dist, { recursive: true, force: true });

const shard = (dist, entries) => writeFileSync(join(dist, 'search-index-page.json'), JSON.stringify(entries));

test('an entry with a known title and description gets only its text derived, with chrome stripped', async () => {
  const dist = distWith({
    '/security': page(
      'Security — meshin.co',
      'How this site is built and served.',
      '<main><h1>Security</h1><p>Full-disk encryption on the machine I work from.</p></main>'
    ),
  });
  shard(dist, [
    { href: '/security', title: 'Security', description: 'How this site is built and served.', kind: 'Page', text: '' },
  ]);

  try {
    const { entries, derivedCount } = await fillPageShardText(dist);
    assert.equal(derivedCount, 1);
    assert.equal(entries[0].title, 'Security');
    assert.equal(entries[0].description, 'How this site is built and served.');
    assert.match(entries[0].text, /Full-disk encryption/);
    assert.doesNotMatch(entries[0].text, /Book a call today/);
  } finally {
    clean(dist);
  }
});

test('an entry with no title or description gets its head derived from the built page too', async () => {
  const dist = distWith({
    '/blog': page(
      'Writing — meshin.co',
      'Notes on AI governance for founders and boards.',
      '<main><h1>Writing</h1><p>Latest articles.</p></main>'
    ),
  });
  shard(dist, [{ href: '/blog', title: '', description: '', kind: 'Page', text: '' }]);

  try {
    const { entries } = await fillPageShardText(dist);
    assert.equal(entries[0].title, 'Writing');
    assert.equal(entries[0].description, 'Notes on AI governance for founders and boards.');
    assert.match(entries[0].text, /Latest articles/);
  } finally {
    clean(dist);
  }
});

test('an entry that already carries real text is left untouched and its route is never read', async () => {
  const dist = distWith({});
  shard(dist, [
    {
      href: '/blog/category/governance',
      title: 'Governance',
      description: 'x',
      kind: 'Page',
      text: 'already real body text',
    },
  ]);

  try {
    const { entries, derivedCount } = await fillPageShardText(dist);
    assert.equal(derivedCount, 0);
    assert.equal(entries[0].text, 'already real body text');
  } finally {
    clean(dist);
  }
});

test('an entry pointing at a route with no built page fails loudly instead of shipping empty text', async () => {
  const dist = distWith({});
  shard(dist, [{ href: '/ghost', title: 'Ghost', description: 'x', kind: 'Page', text: '' }]);

  try {
    await assert.rejects(() => fillPageShardText(dist), /no built page for search entry "\/ghost"/);
  } finally {
    clean(dist);
  }
});

test('derived text is capped at the page kind budget even when the built page is huge', async () => {
  const huge = '<main>' + '<p>filler paragraph repeated for length. </p>'.repeat(400) + '</main>';
  const dist = distWith({ '/security': page('Security — meshin.co', 'x', huge) });
  shard(dist, [{ href: '/security', title: 'Security', description: 'x', kind: 'Page', text: '' }]);

  try {
    const { entries } = await fillPageShardText(dist);
    assert.ok(entries[0].text.length <= ENTRY_TEXT_CAPS.page);
  } finally {
    clean(dist);
  }
});

test('the shard file on disk is rewritten with the derived entries', async () => {
  const dist = distWith({
    '/now': page('Now — meshin.co', 'x', '<main><p>Filled in when the site launches.</p></main>'),
  });
  shard(dist, [{ href: '/now', title: 'Now', description: 'x', kind: 'Page', text: '' }]);

  try {
    await fillPageShardText(dist);
    const onDisk = JSON.parse(await readFile(join(dist, 'search-index-page.json'), 'utf8'));
    assert.match(onDisk[0].text, /Filled in when the site launches/);
  } finally {
    clean(dist);
  }
});

test('derived text is the prose a person reads, never the JSON-LD or inline style a page ships inside its main', async () => {
  const dist = distWith({
    '/pricing': page(
      'Pricing — meshin.co',
      'What it costs.',
      '<main><script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"BreadcrumbList"}]}</script>' +
        '<style>.x{color:red}</style><h1>Pricing</h1><p>What it costs depends on the fit.</p></main>'
    ),
  });
  shard(dist, [{ href: '/pricing', title: 'Pricing', description: 'What it costs.', kind: 'Page', text: '' }]);

  try {
    const { entries } = await fillPageShardText(dist);
    assert.equal(entries[0].text, 'Pricing What it costs depends on the fit.');
  } finally {
    clean(dist);
  }
});
