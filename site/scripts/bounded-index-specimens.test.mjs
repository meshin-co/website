import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

import { COLLECTION_FEED_MAX_BYTES, FEED_WINDOW } from '../src/utils/feeds.mjs';
import {
  LLMS_FILE_MAX_BYTES,
  LLMS_FULL_MAX_BYTES,
  LLMS_SHARD_MAX_ENTRIES,
  llmsCollectionFiles,
} from '../src/utils/llms-collections.mjs';
import { SPECIMENS } from './mutation-specimens.mjs';

const SITE_ROOT = join(import.meta.dirname, '..');
const CAP = LLMS_SHARD_MAX_ENTRIES.post;
const POSTS = CAP * 3 + 1;
const ORIGIN = 'https://meshin.co';
const urlOf = (index) => `${ORIGIN}/blog/post-${String(index).padStart(2, '0')}`;
const dayOf = (index) => `2026-01-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`;

const entries = Array.from({ length: POSTS }, (_, index) => ({
  id: `post-${String(index).padStart(2, '0')}`,
  title: `Post ${index}`,
  url: urlOf(index),
  summary: `Summary ${index}.`,
  body: `Body ${index}.`,
  published: dayOf(index),
  updated: dayOf(index),
  draft: false,
  noindex: false,
}));

const feedItem = (index) =>
  `<item><title>Post ${index}</title><link>${urlOf(index)}</link><guid isPermaLink="true">${urlOf(index)}</guid></item>`;

const builtFiles = () => {
  const shards = llmsCollectionFiles({
    site: 'meshin.co',
    origin: ORIGIN,
    name: 'post',
    title: 'Writing',
    entries,
    max: CAP,
  });
  const files = Object.fromEntries(shards.map(({ param, text }) => [`dist/llms/${param}.txt`, text]));
  files['dist/llms-full.txt'] =
    `# meshin.co\n\n- [Writing](${ORIGIN}/llms/post.txt): ${POSTS} entries, full body text of each.\n`;
  const items = Array.from({ length: FEED_WINDOW }, (_, index) => feedItem(index)).join('');
  files['dist/blog/rss.xml'] = `<rss><channel><title>Writing</title>${items}</channel></rss>`;
  return files;
};

const scratchSite = () => {
  const copySite = mkdtempSync(join(tmpdir(), 'bounded-specimens-'));
  const files = builtFiles();
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(dirname(join(copySite, name)), { recursive: true });
    writeFileSync(join(copySite, name), text);
  }
  return { copySite, files };
};

const withPlanted = async (name, inspect) => {
  const { copySite, files } = scratchSite();
  try {
    const restore = await SPECIMENS[name].plant(copySite);
    const read = (file) => readFileSync(join(copySite, file), 'utf8');
    inspect({ read, files });
    await restore();
    for (const [file, text] of Object.entries(files)) assert.equal(read(file), text, `${file} restored byte for byte`);
  } finally {
    rmSync(copySite, { recursive: true, force: true });
  }
};

const bytes = (text) => Buffer.byteLength(text, 'utf8');
const entryUrls = (text) => [...text.matchAll(/^\[(https:\/\/[^\]]+)\]\(\1\)$/gm)].map(([, url]) => url);
const escaped = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test('the nine bounded-index plants each belong to gate:machine', () => {
  const names = [
    'machineLlmsShardOverBudget',
    'machineLlmsFullOverBudget',
    'machineLlmsFullInlinesEntries',
    'machineLlmsShardOverCap',
    'machineLlmsShardOmitsEntry',
    'machineLlmsIndexCarriesEntry',
    'machineLlmsFullCountDrifts',
    'machineFeedOverWindow',
    'machineFeedOverBudget',
  ];
  for (const name of names) assert.equal(SPECIMENS[name]?.gate, 'gate:machine', name);
});

test('the two determinism plants run test:llms and carry the name of the test that must go red', () => {
  assert.equal(SPECIMENS.llmsDropsTheIdTieBreak.gate, 'test:llms');
  assert.equal(
    SPECIMENS.llmsDropsTheIdTieBreak.token,
    'generating twice from one fixture is byte-identical for every file, in any input order'
  );
  assert.equal(SPECIMENS.llmsAppendsATimestamp.gate, 'test:llms');
  assert.equal(
    SPECIMENS.llmsAppendsATimestamp.token,
    'the generator reads no clock: a second run a day later is byte-identical'
  );
});

test('a test:llms plant reads its failures through the dot reporter, because the spec reporter prints every passing test name', () => {
  for (const name of ['llmsDropsTheIdTieBreak', 'llmsAppendsATimestamp'])
    assert.equal(SPECIMENS[name].env.NODE_OPTIONS, '--test-reporter=dot', name);
});

test('the tokens that carry a number take it from the constant the gate guards with, never from a retyped literal', () => {
  assert.equal(SPECIMENS.machineLlmsShardOverBudget.token, `bytes, over the ${LLMS_FILE_MAX_BYTES} byte guard`);
  assert.equal(SPECIMENS.machineLlmsFullOverBudget.token, `bytes, over the ${LLMS_FULL_MAX_BYTES} byte guard`);
  assert.equal(SPECIMENS.machineLlmsShardOverCap.token, `entries, over the ${CAP} entry cap`);
  assert.equal(SPECIMENS.machineFeedOverWindow.token, `items, window is ${FEED_WINDOW}`);
  assert.equal(SPECIMENS.machineFeedOverBudget.token, `bytes, over the ${COLLECTION_FEED_MAX_BYTES} byte guard`);
});

test('a shard pushed past the file budget is over it by bytes and restores', async () => {
  await withPlanted('machineLlmsShardOverBudget', ({ read, files }) => {
    assert.ok(bytes(files['dist/llms/post-1.txt']) <= LLMS_FILE_MAX_BYTES);
    assert.ok(bytes(read('dist/llms/post-1.txt')) > LLMS_FILE_MAX_BYTES);
  });
});

test('llms-full.txt pushed past its guard is over it and restores', async () => {
  await withPlanted('machineLlmsFullOverBudget', ({ read, files }) => {
    assert.ok(bytes(files['dist/llms-full.txt']) <= LLMS_FULL_MAX_BYTES);
    assert.ok(bytes(read('dist/llms-full.txt')) > LLMS_FULL_MAX_BYTES);
  });
});

test('llms-full.txt gains a line linking a post that a shard really holds', async () => {
  await withPlanted('machineLlmsFullInlinesEntries', ({ read, files }) => {
    const added = read('dist/llms-full.txt').slice(files['dist/llms-full.txt'].length);
    const url = /\((https:[^)]+)\)/.exec(added)[1];
    assert.match(url, /\/blog\//);
    assert.ok(files['dist/llms/post-1.txt'].includes(`[${url}](${url})`));
  });
});

test('a fourth entry block lands in post-3, copied from post-4, so the shard holds one more than its cap', async () => {
  await withPlanted('machineLlmsShardOverCap', ({ read, files }) => {
    assert.equal(entryUrls(files['dist/llms/post-3.txt']).length, CAP);
    const planted = read('dist/llms/post-3.txt');
    assert.equal(entryUrls(planted).length, CAP + 1);
    assert.ok(entryUrls(files['dist/llms/post-4.txt']).every((url) => entryUrls(planted).includes(url)));
    assert.equal(read('dist/llms/post-4.txt'), files['dist/llms/post-4.txt']);
    assert.ok(planted.endsWith(files['dist/llms/post-3.txt'].slice(-40)));
  });
});

test('one entry loses its URL line from post-2 and the other shards are untouched', async () => {
  await withPlanted('machineLlmsShardOmitsEntry', ({ read, files }) => {
    const before = entryUrls(files['dist/llms/post-2.txt']);
    assert.equal(entryUrls(read('dist/llms/post-2.txt')).length, before.length - 1);
    for (const shard of ['post-1', 'post-3', 'post-4'])
      assert.equal(read(`dist/llms/${shard}.txt`), files[`dist/llms/${shard}.txt`]);
  });
});

test('the index carries a post as an entry line of its own, which only a shard may hold', async () => {
  await withPlanted('machineLlmsIndexCarriesEntry', ({ read, files }) => {
    assert.deepEqual(entryUrls(files['dist/llms/post.txt']), []);
    const [url, ...rest] = entryUrls(read('dist/llms/post.txt'));
    assert.equal(rest.length, 0);
    assert.ok(files['dist/llms/post-1.txt'].includes(`[${url}](${url})`));
  });
});

test('the llms-full.txt count for post goes up by one', async () => {
  await withPlanted('machineLlmsFullCountDrifts', ({ read }) => {
    assert.match(read('dist/llms-full.txt'), new RegExp(`llms/post\\.txt\\): ${POSTS + 1} entries`));
  });
});

test('the post feed gains exactly enough copied items to carry one more than its window', async () => {
  await withPlanted('machineFeedOverWindow', ({ read }) => {
    assert.equal(read('dist/blog/rss.xml').match(/<item>/g).length, FEED_WINDOW + 1);
  });
});

test('the post feed is padded past its byte budget and stays one document', async () => {
  await withPlanted('machineFeedOverBudget', ({ read, files }) => {
    assert.ok(bytes(files['dist/blog/rss.xml']) <= COLLECTION_FEED_MAX_BYTES);
    const planted = read('dist/blog/rss.xml');
    assert.ok(bytes(planted) > COLLECTION_FEED_MAX_BYTES);
    assert.equal(planted.match(/<item>/g).length, FEED_WINDOW);
    assert.ok(planted.endsWith('</channel></rss>'));
  });
});

test('the orphan shard names a shard number no index lists, and the inlined-entry plant reads a shard', async () => {
  const { copySite } = scratchSite();
  try {
    const restoreOrphan = await SPECIMENS.machineLlmsOrphanShard.plant(copySite);
    const orphan = /\/llms\/(post-\d+)\.txt/.exec(SPECIMENS.machineLlmsOrphanShard.token)[1];
    assert.ok(Number(orphan.split('-')[1]) > Math.ceil(POSTS / CAP));
    assert.equal(existsSync(join(copySite, `dist/llms/${orphan}.txt`)), true);
    await restoreOrphan();
    assert.equal(existsSync(join(copySite, `dist/llms/${orphan}.txt`)), false);
    writeFileSync(join(copySite, 'dist/llms.txt'), '# meshin.co\n');
    const restoreInline = await SPECIMENS.machineLlmsInlinesEntries.plant(copySite);
    assert.match(readFileSync(join(copySite, 'dist/llms.txt'), 'utf8'), /\/blog\/post-/);
    await restoreInline();
  } finally {
    rmSync(copySite, { recursive: true, force: true });
  }
});

const sourceSite = () => {
  const copySite = mkdtempSync(join(tmpdir(), 'bounded-source-'));
  cpSync(join(SITE_ROOT, 'src'), join(copySite, 'src'), { recursive: true });
  mkdirSync(join(copySite, 'scripts'));
  cpSync(join(SITE_ROOT, 'scripts/prose-rules.mjs'), join(copySite, 'scripts/prose-rules.mjs'));
  cpSync(join(SITE_ROOT, 'package.json'), join(copySite, 'package.json'));
  return copySite;
};

const llmsTestRun = (copySite) => {
  const run = spawnSync(process.execPath, ['--test', '--test-reporter=spec', 'src/utils/llms-collections.test.mjs'], {
    cwd: copySite,
    encoding: 'utf8',
    env: { ...process.env, NODE_TEST_CONTEXT: undefined },
  });
  return { code: run.status, output: `${run.stdout}${run.stderr}` };
};

for (const name of ['llmsDropsTheIdTieBreak', 'llmsAppendsATimestamp']) {
  test(`${name} turns its own test red in a copy of the source, and the restore turns it green`, async () => {
    const copySite = sourceSite();
    try {
      const pristine = llmsTestRun(copySite);
      assert.equal(pristine.code, 0, pristine.output);
      const restore = await SPECIMENS[name].plant(copySite);
      const planted = llmsTestRun(copySite);
      await restore();
      assert.notEqual(planted.code, 0, 'the planted source stayed green');
      assert.match(planted.output, new RegExp(`✖ ${escaped(SPECIMENS[name].token)}`));
      assert.equal(llmsTestRun(copySite).code, 0);
    } finally {
      rmSync(copySite, { recursive: true, force: true });
    }
  });
}

test('a source plant fails loud when the text it edits is gone, so a refactor cannot turn it into a no-op', async () => {
  const copySite = sourceSite();
  try {
    const target = join(copySite, 'src/utils/llms-collections.mjs');
    writeFileSync(target, 'export const orderEntries = (entries) => entries;\n');
    await assert.rejects(SPECIMENS.llmsDropsTheIdTieBreak.plant(copySite), /changed nothing/);
    await assert.rejects(SPECIMENS.llmsAppendsATimestamp.plant(copySite), /changed nothing/);
  } finally {
    rmSync(copySite, { recursive: true, force: true });
  }
});
