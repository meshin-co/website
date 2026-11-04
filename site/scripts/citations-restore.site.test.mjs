import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { archivedEntryText, restoredEntryText, searchedEntryText, upgradedEntryText } from './citation-rewrites.mjs';
import { SOURCE_COLLECTIONS } from './citations.mjs';
import { RewriteError } from './entry-surgery.mjs';
import { frontmatterOf } from './fixtures/citation-text.mjs';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const snapshotOf = (address) => `https://web.archive.org/web/20251025031200/${address}`;

const realEntries = () =>
  SOURCE_COLLECTIONS.flatMap((collection) => {
    const directory = join(REPO_ROOT, 'site', 'src', 'data', collection);
    return readdirSync(directory)
      .filter((name) => /\.mdx?$/.test(name))
      .map((name) => ({ path: `${collection}/${name}`, text: readFileSync(join(directory, name), 'utf8') }));
  });

function searchedOrNull(text, url) {
  try {
    return searchedEntryText({ text, url });
  } catch (error) {
    assert.ok(error instanceof RewriteError, String(error));
    return null;
  }
}

test('on every real entry, putting back what the search rewrite made gives the entry back byte for byte', () => {
  let restored = 0;
  for (const { path, text } of realEntries()) {
    for (const url of new Set((frontmatterOf(text).sources ?? []).map((source) => source.url))) {
      const searched = searchedOrNull(text, url);
      if (searched === null) continue;
      assert.equal(restoredEntryText({ text: searched, original: url }), text, `${path} ${url}`);
      restored += 1;
    }
  }
  assert.ok(restored > 0, 'at least one real entry was restored');
});

test('on every real entry, moving the search rewrite up to a snapshot is what the archive rewrite makes of the same entry', () => {
  let upgraded = 0;
  for (const { path, text } of realEntries()) {
    for (const url of new Set((frontmatterOf(text).sources ?? []).map((source) => source.url))) {
      const searched = searchedOrNull(text, url);
      if (searched === null) continue;
      const archiveUrl = snapshotOf(url);
      const result = upgradedEntryText({ text: searched, original: url, archiveUrl });
      assert.equal(result, archivedEntryText({ text, url, archiveUrl }), `${path} ${url}`);
      assert.throws(() => upgradedEntryText({ text: result, original: url, archiveUrl }), RewriteError);
      upgraded += 1;
    }
  }
  assert.ok(upgraded > 0, 'at least one real entry was upgraded');
});
