import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { restoredEntryText } from './citation-rewrites.mjs';
import { reexamineSearchRows } from './link-repair-reexamine.mjs';
import { citing } from './fixtures/link-repair-world.mjs';
import { entryText } from './fixtures/link-rot-repo.mjs';
import {
  EMPTY_ADDRESS,
  GLOSSARY,
  NIST,
  PUBLISHER,
  SECOND,
  TITLE,
  TODAY,
  page,
  reexamineWorld,
  registerRow,
  searchOf,
  searched,
} from './fixtures/reexamine-world.mjs';

const OTHER_TITLE = 'Quite Another Report';
const OTHER = 'https://example.org/other-report';
const OTHER_PUBLISHER = 'Another Publisher';
const THIRD = 'site/src/data/post/third.md';
const snapshotOf = (stamp, address) => `https://web.archive.org/web/${stamp}/${address}`;

const searchSource = ({ original, title = TITLE, publisher = PUBLISHER, retrieved = '2023-03-01' }) => ({
  title,
  url: searchOf({ title, publisher }),
  original,
  publisher,
  retrieved,
});

const twoTitles = () =>
  entryText({
    sources: [searchSource({ original: NIST }), searchSource({ original: NIST, title: OTHER_TITLE })],
    body: `First [one](${searchOf()}) and then [two](${searchOf({ title: OTHER_TITLE })}).\n`,
  });

const run = async (t, options, changes = {}) => {
  const world = reexamineWorld(options);
  t.after(world.repo.remove);
  return { ...world, result: await reexamineSearchRows({ ...world.inputs, ...changes }) };
};

test('two entries that rest on a search for one original, cited on different days, each get the capture nearest their own day', async (t) => {
  const files = {
    [GLOSSARY]: searched({ retrieved: '2023-03-01' }),
    [SECOND]: searched({ retrieved: '2025-10-25', updatedDate: '2025-10-25' }),
  };
  const rows = [registerRow(), registerRow({ entry: SECOND, citedOn: '2025-10-25' })];
  const { result, archive } = await run(t, { files, rows, verdicts: { [NIST]: 'dead' }, empty: [] });

  assert.deepEqual(
    result.upgraded.map(({ entry, replacement, citedOn }) => ({ entry, replacement, citedOn })),
    [
      { entry: GLOSSARY, replacement: snapshotOf('20230302214609', NIST), citedOn: '2023-03-01' },
      { entry: SECOND, replacement: snapshotOf('20260101233427', NIST), citedOn: '2025-10-25' },
    ]
  );
  assert.ok(result.texts.get(GLOSSARY).includes(snapshotOf('20230302214609', NIST)));
  assert.ok(result.texts.get(SECOND).includes(snapshotOf('20260101233427', NIST)));
  assert.equal(archive.requests().filter((address) => address.includes('/available')).length, 2);
  assert.deepEqual(
    result.register.found.map(({ entry }) => entry),
    [GLOSSARY, SECOND]
  );
});

test('two entries that cite on the same day share one archive lookup and one capture read, and no live page is read for an address that is gone', async (t) => {
  const files = { [GLOSSARY]: searched(), [SECOND]: searched() };
  const rows = [registerRow(), registerRow({ entry: SECOND })];
  const { result, archive, livePagesRead } = await run(t, { files, rows, verdicts: { [NIST]: 'dead' }, empty: [] });

  assert.equal(result.upgraded.length, 2);
  assert.equal(archive.requests().filter((address) => address.includes('/available')).length, 1);
  assert.equal(archive.requests().filter((address) => address.includes('/web/')).length, 1);
  assert.deepEqual(livePagesRead, []);
});

test('two rows of one entry for one original are judged by their own titles: a page that carries one title restores that row only', async (t) => {
  const { result } = await run(t, { files: { [GLOSSARY]: twoTitles() } });

  assert.deepEqual(
    result.restored.map(({ original }) => original),
    [NIST]
  );
  const text = result.texts.get(GLOSSARY);
  assert.ok(text.includes(`[one](${NIST})`));
  assert.ok(text.includes(`[two](${searchOf({ title: OTHER_TITLE })})`));
  assert.equal((text.match(/original:/g) ?? []).length, 1, 'the row that was not restored keeps its original');
  assert.deepEqual(result.register, { found: [], removed: [] }, 'a row of the same citation still rests on a search');
});

test('every row of one entry for one original is restored when the page carries each title, and then the register row goes', async (t) => {
  const pages = { [NIST]: page(`<h1>${TITLE}</h1><h2>${OTHER_TITLE}</h2>`) };
  const { result } = await run(t, { files: { [GLOSSARY]: twoTitles() }, pages });

  assert.equal(result.restored.length, 2);
  assert.ok(result.texts.get(GLOSSARY).includes(`[one](${NIST}) and then [two](${NIST})`));
  assert.deepEqual(result.register, { found: [], removed: [{ original: NIST, entry: GLOSSARY }] });
});

test('one entry can have a row restored and another moved up in the same pass, and both rewrites are in its text', async (t) => {
  const files = {
    [GLOSSARY]: entryText({
      sources: [searchSource({ original: NIST }), searchSource({ original: OTHER, publisher: OTHER_PUBLISHER })],
      body: `First [one](${searchOf()}) and then [two](${searchOf({ publisher: OTHER_PUBLISHER })}).\n`,
    }),
  };
  const rows = [registerRow(), registerRow({ original: OTHER, publisher: OTHER_PUBLISHER })];
  const { result } = await run(t, { files, rows, verdicts: { [OTHER]: 'dead' }, empty: [] });

  assert.deepEqual(
    result.restored.map(({ original }) => original),
    [NIST]
  );
  assert.deepEqual(
    result.upgraded.map(({ original }) => original),
    [OTHER]
  );
  const text = result.texts.get(GLOSSARY);
  assert.ok(text.includes(`[one](${NIST})`));
  assert.ok(text.includes(`[two](${snapshotOf('20230302214609', OTHER)})`));
  assert.deepEqual(result.register.removed, [{ original: NIST, entry: GLOSSARY }]);
  assert.deepEqual(
    result.register.found.map(({ original }) => original),
    [OTHER]
  );
});

test('the text the sweep already rewrote in this run is the text the pass builds on, and it is not read from disk again', async (t) => {
  const marker = '\nA paragraph the sweep rewrote earlier in this run.\n';
  const pending = new Map([[GLOSSARY, `${searched()}${marker}`]]);
  const { result } = await run(t, {}, { pending });

  assert.equal(result.texts.get(GLOSSARY), `${citing({ address: NIST })}${marker}`);
  assert.equal(result.texts.get(GLOSSARY), restoredEntryText({ text: pending.get(GLOSSARY), original: NIST }));
});

test('an original the sweep acted on in this run is not examined again, and is not part of the pool the rotation draws from', async (t) => {
  const { result, probed } = await run(t, {}, { skip: new Set([NIST]) });

  assert.deepEqual(probed, []);
  assert.equal(result.of, 0);
  assert.deepEqual(result.examined, []);
});

test('a row the register does not hold is moved up all the same, dated from the earliest row the register holds for the original, or from today', async (t) => {
  const none = await run(t, { rows: [], verdicts: { [NIST]: 'dead' }, empty: [] });
  const elsewhere = await run(t, {
    rows: [
      registerRow({ entry: SECOND, firstSeenDead: '2026-09-30' }),
      registerRow({ entry: 'site/src/data/post/x.md', firstSeenDead: '2026-10-05' }),
    ],
    verdicts: { [NIST]: 'dead' },
    empty: [],
  });

  assert.equal(none.result.upgraded[0].firstSeenDead, TODAY);
  assert.equal(elsewhere.result.upgraded[0].firstSeenDead, '2026-09-30');
});

test('a restore the register never held still names the row to drop, and has no day it was first seen dead', async (t) => {
  const { result } = await run(t, { rows: [] });

  assert.deepEqual(result.register.removed, [{ original: NIST, entry: GLOSSARY }]);
  assert.equal(result.restored[0].firstSeenDead, null);
});

test('an entry the rewrite refuses is left as it is and reported, while the other entries in the same pass are still restored', async (t) => {
  const refused = searched({
    body: `See [the framework](${searchOf()}).\n\n\`\`\`sh\ncurl ${searchOf()}\n\`\`\`\n`,
  });
  const files = { [GLOSSARY]: refused, [SECOND]: searched({ original: OTHER }) };
  const rows = [registerRow(), registerRow({ original: OTHER, entry: SECOND })];
  const { result } = await run(t, { files, rows });

  assert.deepEqual(
    result.restored.map(({ entry }) => entry),
    [SECOND]
  );
  assert.deepEqual([...result.texts.keys()], [SECOND]);
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].entry, GLOSSARY);
  assert.equal(result.failures[0].original, NIST);
  assert.match(result.failures[0].message, /site\/src\/data\/glossary\/ai-rmf\.md: .*line \d+: /);
  assert.deepEqual(result.register.removed, [{ original: OTHER, entry: SECOND }]);
});

test('an entry the pass cannot read, or whose date it cannot read, is reported and never stops the others', async (t) => {
  const files = {
    [GLOSSARY]: searched({ retrieved: 'last Tuesday' }),
    [SECOND]: searched({ original: OTHER }),
    'site/src/data/faq/broken.md': 'no front matter at all\n',
  };
  const rows = [registerRow(), registerRow({ original: OTHER, entry: SECOND })];
  const { result } = await run(t, { files, rows });

  assert.deepEqual(
    result.restored.map(({ entry }) => entry),
    [SECOND]
  );
  assert.deepEqual(result.failures.map(({ entry }) => entry).sort(), ['site/src/data/faq/broken.md', GLOSSARY]);
  for (const failure of result.failures) assert.equal(failure.original, null);
  assert.match(result.failures.find(({ entry }) => entry === GLOSSARY).message, /is not a calendar day/);
});

test('an address that makes the pass itself throw is reported for that address and the other addresses are still examined', async (t) => {
  const files = { [GLOSSARY]: searched(), [SECOND]: searched({ original: OTHER }) };
  const rows = [registerRow(), registerRow({ original: OTHER, entry: SECOND })];
  const pages = { [NIST]: new TypeError('the reader fell over') };
  const { result } = await run(t, { files, rows, pages });

  assert.deepEqual(
    result.restored.map(({ entry }) => entry),
    [SECOND]
  );
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].original, NIST);
  assert.equal(result.failures[0].entry, GLOSSARY);
  assert.equal(result.failures[0].message, `the re-examination of ${NIST} failed: the reader fell over`);
});

test('a second pass over what the first one made changes nothing, whatever the first one did', async (t) => {
  const files = {
    [GLOSSARY]: searched(),
    [SECOND]: searched({ original: OTHER }),
    [THIRD]: searched({ original: EMPTY_ADDRESS }),
  };
  const rows = [
    registerRow(),
    registerRow({ original: OTHER, entry: SECOND }),
    registerRow({ original: EMPTY_ADDRESS, entry: THIRD }),
  ];
  const verdicts = { [OTHER]: 'dead', [EMPTY_ADDRESS]: 'dead' };
  const { result, repo, inputs } = await run(t, { files, rows, verdicts, empty: [OTHER] });

  assert.equal(result.restored.length + result.upgraded.length, 2, 'the first pass restored one and moved one up');
  for (const [path, text] of result.texts) writeFileSync(join(repo.root, path), text);
  const again = await reexamineSearchRows(inputs);

  assert.deepEqual([...again.texts.keys()], []);
  assert.deepEqual([again.restored, again.upgraded, again.failures], [[], [], []]);
  assert.equal(again.of, 1, 'only the row that stayed on its search is still there');
  assert.ok(!repo.read(GLOSSARY).includes('original:'));
});
