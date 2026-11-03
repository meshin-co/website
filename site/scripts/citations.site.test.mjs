import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { parse } from 'yaml';

import { isSnapshotOf } from '../src/utils/archive-url.mjs';
import { archivedEntryText, citedUrls, citingEntries, RewriteError, SOURCE_COLLECTIONS } from './citations.mjs';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const snapshotOf = (address) => `https://web.archive.org/web/20251025031200/${address}`;
const rewrite = (text, url) => archivedEntryText({ text, url, archiveUrl: snapshotOf(url) });
const frontmatterOf = (text) => parse(/^---\r?\n([\s\S]*?)\r?\n---/.exec(text)[1]);

const realEntries = () =>
  SOURCE_COLLECTIONS.flatMap((collection) => {
    const directory = join(REPO_ROOT, 'site', 'src', 'data', collection);
    return readdirSync(directory)
      .filter((name) => /\.mdx?$/.test(name))
      .map((name) => ({ path: `${collection}/${name}`, text: readFileSync(join(directory, name), 'utf8') }));
  });

test('the real NIST AI RMF glossary entry is rewritten with one changed line and one added line', () => {
  const doi = 'https://doi.org/10.6028/NIST.AI.100-1';
  const text = readFileSync(join(REPO_ROOT, 'site', 'src', 'data', 'glossary', 'nist-ai-rmf.md'), 'utf8');
  const expected = text.replace(`    url: ${doi}\n`, `    url: ${snapshotOf(doi)}\n    original: ${doi}\n`);

  const result = rewrite(text, doi);
  const row = frontmatterOf(result).sources.at(-1);

  assert.notEqual(expected, text);
  assert.equal(result, expected);
  assert.deepEqual([row.url, row.original], [snapshotOf(doi), doi]);
  assert.equal(isSnapshotOf(row.url, row.original), true);
});

test('every address a real entry cites is rewritten row by row, never twice, or refused as a RewriteError', () => {
  let rewritten = 0;
  for (const { path, text } of realEntries()) {
    const rows = frontmatterOf(text).sources ?? [];
    for (const url of new Set(rows.map((source) => source.url))) {
      let result;
      try {
        result = rewrite(text, url);
      } catch (error) {
        assert.ok(error instanceof RewriteError, `${path} ${url}: ${error}`);
        continue;
      }
      rewritten += 1;
      const after = frontmatterOf(result).sources;
      rows.forEach((source, index) => {
        if (source.url !== url) return assert.deepEqual(after[index], source, `${path} row ${index + 1}`);
        assert.deepEqual([after[index].url, after[index].original], [snapshotOf(url), url], `${path} row ${index + 1}`);
        assert.equal(isSnapshotOf(after[index].url, after[index].original), true);
      });
      const cited = rows.filter((source) => source.url === url).length;
      assert.equal(result.split('\n').length - text.split('\n').length, cited, path);
      assert.throws(() => rewrite(result, url), { name: 'RewriteError', message: /already archived/ });
    }
  }
  assert.ok(rewritten > 0, 'at least one real entry was rewritten');
});

test('on the real tree, citedUrls and citingEntries agree about who cites an address', () => {
  const everyAddress = [...citedUrls({ repoRoot: REPO_ROOT })];
  const sample = [everyAddress[0], everyAddress[Math.floor(everyAddress.length / 2)], everyAddress.at(-1)];

  assert.ok(everyAddress.length > 0);
  for (const [url, paths] of sample) {
    const found = citingEntries({ repoRoot: REPO_ROOT, url });
    assert.deepEqual(
      found.map(({ path }) => path),
      paths
    );
    assert.ok(found.every(({ citedOn }) => /^\d{4}-\d{2}-\d{2}$/.test(citedOn)));
  }
});
