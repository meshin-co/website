import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const SCRIPT = new URL('./freeze-visual-corpus.mjs', import.meta.url).pathname;
const MANIFEST = 'src/data/visual-corpus.json';

function siteWith(collections) {
  const root = mkdtempSync(join(tmpdir(), 'freeze-visual-corpus-'));
  for (const [collection, names] of Object.entries(collections)) {
    mkdirSync(join(root, 'src/data', collection), { recursive: true });
    for (const name of names) writeFileSync(join(root, 'src/data', collection, name), '---\ntitle: x\n---\n');
  }
  return root;
}

const freeze = (root) => execFileSync('node', [SCRIPT], { cwd: root, encoding: 'utf8' });
const manifestOf = (root) => readFileSync(join(root, MANIFEST), 'utf8');

test('it writes the manifest the visual build reads: every collection folder, its entry files, sorted', () => {
  const root = siteWith({ post: ['b.md', 'a.md'], faq: ['q.md'], case: [] });

  freeze(root);

  assert.deepEqual(JSON.parse(manifestOf(root)), { case: [], faq: ['q.md'], post: ['a.md', 'b.md'] });
  assert.ok(manifestOf(root).endsWith('}\n'), 'the file ends with one newline');
});

test('freezing twice writes the same bytes, so a refreeze that changes nothing shows no diff', () => {
  const root = siteWith({ post: ['a.md', 'b.md'], glossary: ['term.md'] });

  freeze(root);
  const first = manifestOf(root);
  freeze(root);

  assert.equal(manifestOf(root), first);
});

test('a refreeze takes the entries that arrived since and drops the ones that left', () => {
  const root = siteWith({ post: ['old.md', 'gone.md'] });
  freeze(root);
  writeFileSync(join(root, 'src/data/post/new.md'), '---\ntitle: new\n---\n');
  rmSync(join(root, 'src/data/post/gone.md'));

  freeze(root);

  assert.deepEqual(JSON.parse(manifestOf(root)).post, ['new.md', 'old.md']);
});

test('it reports how many entries it pinned in how many collections, so an empty freeze is visible', () => {
  const root = siteWith({ post: ['a.md', 'b.md'], faq: ['q.md'], case: [] });

  assert.match(freeze(root), /pinned 3 entries in 3 collections in src\/data\/visual-corpus\.json/);
});
