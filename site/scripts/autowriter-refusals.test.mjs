import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  REFUSED_PATHS,
  REMOVAL_REFUSALS,
  describeRefusal,
  isDispositionFile,
  isGenerationRecord,
  refusalFor,
  refusalOf,
  removalRefusalFor,
  sealSignature,
} from './autowriter-refusals.mjs';
import { restatedReason } from './disposition-restate.mjs';
import { LENGTH_FILE } from './entry-length.mjs';
import { writeMeasuredStamp } from './lh-evidence.mjs';
import { recordDirectory, recordPath } from './record-layout.mjs';
import { dispositionFor } from './route-derive.mjs';
import { BAND_FILE } from './sentence-band.mjs';

const whyOf = (id) => REFUSED_PATHS.find((row) => row.id === id)?.why;
const SLUG = 'model-registry';
const CLAIMED_AT = '2026-11-01T07:00:00.000Z';
const filed = (family) => recordPath(family, SLUG, CLAIMED_AT);
const DISPOSITIONS = recordDirectory('disposition');
const GENERATED = filed('disposition');

test('the list names what automation may never write, each row with one sentence that says why', () => {
  assert.deepEqual(
    REFUSED_PATHS.map(({ id }) => id),
    ['sentence-band', 'entry-length', 'lighthouse-record', 'lighthouse-stamp', 'lighthouse-report']
  );
  for (const row of REFUSED_PATHS) {
    assert.equal(typeof row.covers, 'function', row.id);
    assert.match(row.why, /^[A-Z][^\n]*\.$/, row.id);
    assert.equal(row.why.split('. ').length, 1, row.id + ' says more than one sentence');
  }
});

const REFUSED = [
  ['audits/sentence-band.json', 'sentence-band'],
  ['audits/entry-length.json', 'entry-length'],
  ['audits/lighthouse-green.json', 'lighthouse-record'],
  ['audits/phase-4.7/lh-measured.json', 'lighthouse-stamp'],
  ['audits/phase-zz-specimen/lh-measured.json', 'lighthouse-stamp'],
  ['audits/phase-4.7/lh-mobile/lhr-0.json', 'lighthouse-report'],
  ['audits/phase-4.7/lh-desktop/lhr-2.json', 'lighthouse-report'],
  ['audits/phase-4.7/lh-mobile/deeper/still/lhr-0.json', 'lighthouse-report'],
];

for (const [path, id] of REFUSED) {
  test(path + ' is refused as ' + id, () => {
    assert.deepEqual(refusalFor(path), { id, path, why: whyOf(id) });
  });
}

const DISGUISED = [
  ['./audits/sentence-band.json', 'audits/sentence-band.json', 'sentence-band'],
  ['audits//sentence-band.json', 'audits/sentence-band.json', 'sentence-band'],
  ['audits/phase-4.7/../sentence-band.json', 'audits/sentence-band.json', 'sentence-band'],
  ['audits\\sentence-band.json', 'audits/sentence-band.json', 'sentence-band'],
  ['audits/./entry-length.json', 'audits/entry-length.json', 'entry-length'],
  ['Audits/Entry-Length.JSON', 'Audits/Entry-Length.JSON', 'entry-length'],
  ['.\\audits\\lighthouse-green.json', 'audits/lighthouse-green.json', 'lighthouse-record'],
  ['audits/./phase-4.7/./lh-measured.json', 'audits/phase-4.7/lh-measured.json', 'lighthouse-stamp'],
  ['Audits/Sentence-Band.JSON', 'Audits/Sentence-Band.JSON', 'sentence-band'],
  ['AUDITS/PHASE-4.7/LH-MOBILE/LHR-0.JSON', 'AUDITS/PHASE-4.7/LH-MOBILE/LHR-0.JSON', 'lighthouse-report'],
];

for (const [spelled, normalised, id] of DISGUISED) {
  test(JSON.stringify(spelled) + ' names a refused path, and the refusal shows it as ' + normalised, () => {
    assert.deepEqual(refusalFor(spelled), { id, path: normalised, why: whyOf(id) });
  });
}

const ALLOWED = [
  filed('ledger'),
  filed('generation'),
  filed('claim'),
  GENERATED,
  'audits/sentence-band.json.bak',
  'audits/sentence-band.md',
  'audits/entry-length.json.bak',
  'audits/entry-length.md',
  'site/audits/entry-length.json',
  'audits/measure/sentence-band.json',
  'site/audits/sentence-band.json',
  'audits/lighthouse-green.json5',
  'audits/lighthouse-green/record.json',
  'audits/lh-measured.json',
  'audits/phase-4.7/a/lh-measured.json',
  'audits/phase-4.7/lh-measured.json.gz',
  'audits/phase-4.7/lh-mobile',
  'audits/phase-4.7/lh-mobile-notes.md',
  'audits/phase-4.7/REPORT.md',
  'docs/SEMANTIC-CORE.md',
  'site/src/data/post/sentence-band.md',
  '../audits/sentence-band.json',
  '/audits/sentence-band.json',
  '',
  null,
  undefined,
  42,
];

for (const path of ALLOWED) {
  test(JSON.stringify(path) + ' is not refused', () => {
    assert.equal(refusalFor(path), null);
  });
}

test('the list agrees with the tools that name these files', () => {
  assert.equal(refusalFor(BAND_FILE)?.id, 'sentence-band');
  assert.equal(refusalFor(LENGTH_FILE)?.id, 'entry-length');
  assert.equal(refusalFor('audits/lighthouse-green.json')?.id, 'lighthouse-record');
});

test('every month of a year files its generated dispositions under a path the list reads as a disposition file', () => {
  const months = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'));
  for (const month of months) {
    const path = recordPath('disposition', SLUG, `2027-${month}-15T12:00:00.000Z`);
    assert.equal(path, `${DISPOSITIONS}/2027/${month}/generated-${SLUG}.json`);
    assert.equal(isDispositionFile(path), true, path);
  }
});

test('the stamp the measuring tool writes is a refused path', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'refusals-stamp-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const unattended = process.env.AUTOWRITER_UNATTENDED;
  delete process.env.AUTOWRITER_UNATTENDED;
  t.after(() => {
    if (unattended !== undefined) process.env.AUTOWRITER_UNATTENDED = unattended;
  });

  await writeMeasuredStamp({ auditDir: join(root, 'audits', 'phase-zz'), fingerprint: 'a'.repeat(64) });

  const written = readdirSync(join(root, 'audits', 'phase-zz'));
  assert.equal(written.length, 1);
  assert.equal(refusalFor('audits/phase-zz/' + written[0])?.id, 'lighthouse-stamp');
});

const PATH = DISPOSITIONS + '/routes.json';
const entry = (extra = {}) => ({
  target: '/blog',
  location: 'head.title',
  status: 'verified',
  reason: 'The title was checked against the page.',
  digest: 'aaaaaaaaaaaa',
  ...extra,
});
const second = (extra = {}) =>
  entry({ target: '/glossary', location: undefined, reason: 'The index was re-read.', ...extra });
const file = (...entries) => JSON.stringify(entries, null, 2) + '\n';
const compared = (before, after, path = PATH) =>
  sealSignature({
    path,
    before: before === null ? null : file(...before),
    after: after === null ? null : file(...after),
  });

const SPELLINGS = [
  [true, 'a hand-written file, flat', PATH],
  [true, 'a generated file, flat', DISPOSITIONS + '/generated-model-registry.json'],
  [true, 'a generated file, in its month directory', GENERATED],
  [true, 'a file below the month directory', DISPOSITIONS + '/2026/11/extra/generated-model-registry.json'],
  [true, 'a file in a directory that is no month', DISPOSITIONS + '/deeper/routes.json'],
  [true, 'a leading ./', './' + PATH],
  [true, 'a doubled slash and a dot segment', 'audits//phase-4.7/./dispositions/2026/11/generated-model-registry.json'],
  [true, 'capital letters', 'Audits/Phase-4.7/Dispositions/Routes.JSON'],
  [true, 'capital letters in a month directory', 'AUDITS/PHASE-4.7/DISPOSITIONS/2026/11/GENERATED-MODEL-REGISTRY.JSON'],
  [true, 'backslashes', 'audits\\phase-4.7\\dispositions\\routes.json'],
  [
    true,
    'backslashes in a month directory',
    'audits\\phase-4.7\\dispositions\\2026\\11\\generated-model-registry.json',
  ],
  [false, 'a markdown file beside the json files', DISPOSITIONS + '/routes.md'],
  [false, 'a markdown file in a month directory', DISPOSITIONS + '/2026/11/generated-model-registry.md'],
  [false, 'the directory itself', DISPOSITIONS],
  [false, 'the directory with a trailing slash', DISPOSITIONS + '/'],
  [false, 'a sibling directory that starts with the same name', DISPOSITIONS + '-old/routes.json'],
  [false, 'a json file of the phase beside the directory', 'audits/phase-4.7/inventory.json'],
  [false, 'a json file in the ledger directory', 'audits/autowriter/routes.json'],
  [false, 'the ledger of an entry', filed('ledger')],
  [false, 'the claim of an entry', filed('claim')],
  [false, 'the generation record of an entry', filed('generation')],
  [false, 'a path that leaves the repository', '../' + PATH],
  [false, 'an absolute path', '/' + PATH],
  [false, 'an empty path', ''],
  [false, 'no path', null],
  [false, 'a number', 7],
];

for (const [isFile, what, path] of SPELLINGS) {
  test(JSON.stringify(path) + ' is ' + (isFile ? '' : 'not ') + 'a disposition file: ' + what, () => {
    assert.equal(isDispositionFile(path), isFile);
  });
}

test('a disposition file is found at every depth: the flat one, the one in its month and the one below it make three', () => {
  const lying = [
    DISPOSITIONS + '/generated-model-registry.json',
    GENERATED,
    DISPOSITIONS + '/2026/11/extra/generated-model-registry.json',
  ];
  const found = lying.filter(isDispositionFile);

  assert.deepEqual(found, lying);
  assert.equal(found.length, 3);
});

test('a digest that moves while the reason and the status stay is the seal, and names the entry it moved', () => {
  const found = compared([entry(), second()], [entry({ digest: 'bbbbbbbbbbbb' }), second()]);

  assert.equal(found?.id, 'disposition-seal');
  assert.equal(found?.path, PATH);
  assert.deepEqual(found?.targets, ['/blog head.title']);
  assert.match(found?.why, /^[A-Z][^\n]*\.$/);
  assert.match(found?.why, /assets:seal/);
});

test('every entry the seal moved is named, in file order, and an entry it left alone is not', () => {
  const found = compared(
    [entry(), second(), entry({ target: '/', location: undefined })],
    [entry({ digest: 'bbbbbbbbbbbb' }), second(), entry({ target: '/', location: undefined, digest: 'cccccccccccc' })]
  );

  assert.deepEqual(found?.targets, ['/blog head.title', '/']);
});

test('a restate is not a seal: a digest that moves with a new reason, or with a new status, is refused by no one', () => {
  const moved = { digest: 'bbbbbbbbbbbb' };

  assert.equal(compared([entry()], [entry({ ...moved, reason: 'Restated for the text the writer added.' })]), null);
  assert.equal(compared([entry()], [entry({ ...moved, status: 'rewritten' })]), null);
  assert.equal(compared([entry()], [entry({ ...moved, status: 'rewritten', reason: 'Another reason.' })]), null);
});

test('a seal and a restate in one file name only the seal', () => {
  const found = compared(
    [entry(), second()],
    [entry({ digest: 'bbbbbbbbbbbb' }), second({ digest: 'cccccccccccc', reason: 'Restated.', status: 'rewritten' })]
  );

  assert.deepEqual(found?.targets, ['/blog head.title']);
});

test('an edit that leaves every digest alone is not a seal, whatever else it changes', () => {
  assert.equal(compared([entry()], [entry({ reason: 'Re-read on a later day.' })]), null);
  assert.equal(compared([entry()], [entry({ status: 'rewritten' })]), null);
  assert.equal(compared([entry(), second()], [second(), entry()]), null);
  assert.equal(compared([entry()], [entry()]), null);
});

test('entries are matched by target and location, so one location sealed beside another left alone is named alone', () => {
  const body = entry({ location: 'body.p', reason: 'The paragraph was re-read.' });
  const found = compared([entry(), body], [entry(), { ...body, digest: 'bbbbbbbbbbbb' }]);

  assert.deepEqual(found?.targets, ['/blog body.p']);
});

test('an entry the second version adds or drops is not a seal', () => {
  assert.equal(compared([entry()], [entry(), second()]), null);
  assert.equal(compared([entry(), second()], [entry()]), null);
  assert.equal(compared([entry()], [entry({ location: 'body.p', digest: 'bbbbbbbbbbbb' })]), null);
});

test('a file the commit creates or deletes is never a seal', () => {
  assert.equal(compared(null, [entry()]), null);
  assert.equal(compared([entry()], null), null);
  assert.equal(sealSignature({ path: PATH, before: undefined, after: file(entry()) }), null);
});

test('a path outside the dispositions directory is never a seal, whatever the contents', () => {
  for (const path of [
    'audits/autowriter/routes.json',
    filed('ledger'),
    DISPOSITIONS + '/notes.md',
    DISPOSITIONS + '/2026/11/generated-model-registry.md',
    'site/src/data/post/x.md',
  ])
    assert.equal(compared([entry()], [entry({ digest: 'bbbbbbbbbbbb' })], path), null, path);
});

const PLACEMENTS = [
  DISPOSITIONS + '/generated-model-registry.json',
  GENERATED,
  DISPOSITIONS + '/2026/11/extra/generated-model-registry.json',
];

test('a seal and an unreadable file are found wherever a disposition file lies: flat, in its month, below it', () => {
  const sealed = PLACEMENTS.map((path) => compared([entry()], [entry({ digest: 'bbbbbbbbbbbb' })], path));
  const unreadable = PLACEMENTS.map((path) => sealSignature({ path, before: file(entry()), after: '{not json' }));

  assert.equal(sealed.length, 3);
  assert.deepEqual(
    sealed.map((found) => [found?.id, found?.path, found?.targets]),
    PLACEMENTS.map((path) => ['disposition-seal', path, ['/blog head.title']])
  );
  assert.deepEqual(
    unreadable.map((found) => [found?.id, found?.path]),
    PLACEMENTS.map((path) => ['disposition-unreadable', path])
  );
});

test('a version that is not a list of dispositions is refused as unreadable, on either side', () => {
  const good = file(entry());
  for (const [before, after] of [
    ['{not json', good],
    [good, '{not json'],
    [good, ''],
    ['{"target": "/blog"}', good],
    [good, '[1, 2]'],
    [good, '[null]'],
    [good, '[[]]'],
    ['"text"', good],
  ]) {
    const found = sealSignature({ path: PATH, before, after });
    assert.equal(found?.id, 'disposition-unreadable', JSON.stringify([before, after]));
    assert.equal(found?.path, PATH);
    assert.deepEqual(found?.targets, []);
    assert.match(found?.why, /^[A-Z][^\n]*\.$/);
  }
});

test('an unreadable new file is refused too, because nothing can say it is not a seal', () => {
  assert.equal(sealSignature({ path: PATH, before: null, after: '{not json' })?.id, 'disposition-unreadable');
});

test('a digest that moves under a reason the pipeline wrote itself is a restate it repeats, not a seal', () => {
  const restated = restatedReason({ routes: ['/glossary/model-registry'], generationPaths: [filed('generation')] });
  const generated = dispositionFor({
    claimPath: filed('claim'),
    generationPath: filed('generation'),
    target: '/blog',
    digest: 'x',
    runDate: '2026-11-02',
  }).reason;

  for (const reason of [restated, generated])
    assert.equal(compared([entry({ reason })], [entry({ reason, digest: 'bbbbbbbbbbbb' })]), null, reason);
});

test('a human reason stays sealed when it sits in a file beside a reason the pipeline wrote', () => {
  const reason = restatedReason({ routes: ['/glossary/model-registry'], generationPaths: [filed('generation')] });
  const found = compared(
    [entry(), second({ reason })],
    [entry({ digest: 'bbbbbbbbbbbb' }), second({ reason, digest: 'cccccccccccc' })]
  );

  assert.deepEqual(found?.targets, ['/blog head.title']);
});

test('a reason that only starts like the pipeline wrote it is still a human reason once words come first', () => {
  const reason =
    'Note: ' + restatedReason({ routes: ['/glossary/model-registry'], generationPaths: [filed('generation')] });

  assert.equal(compared([entry({ reason })], [entry({ reason, digest: 'bbbbbbbbbbbb' })])?.id, 'disposition-seal');
});

test('the path rule wins, then the seal, and an ordinary path is neither', () => {
  const sealed = { before: file(entry()), after: file(entry({ digest: 'bbbbbbbbbbbb' })) };

  assert.deepEqual(
    refusalOf({ path: 'audits/sentence-band.json', before: '{}', after: '{}' }),
    refusalFor('audits/sentence-band.json')
  );
  assert.equal(refusalOf({ path: PATH, ...sealed })?.id, 'disposition-seal');
  assert.equal(refusalOf({ path: 'site/src/data/post/x.md', ...sealed }), null);
  assert.equal(refusalOf({ path: PATH, before: file(entry()), after: file(entry()) }), null);
});

test('a refusal reads as its id and its sentence, and a seal adds the entries it moved', () => {
  assert.equal(describeRefusal(refusalFor('audits/sentence-band.json')), 'sentence-band: ' + whyOf('sentence-band'));
  const found = compared([entry(), second()], [entry({ digest: 'bbbbbbbbbbbb' }), second({ digest: 'cccccccccccc' })]);

  assert.equal(describeRefusal(found), found?.id + ': ' + found?.why + '; entries: /blog head.title, /glossary');
});

test('the removal list names what automation may never remove, each row with one sentence that says why', () => {
  assert.deepEqual(
    REMOVAL_REFUSALS.map(({ id }) => id),
    ['generation-record-removed']
  );
  for (const row of REMOVAL_REFUSALS) {
    assert.equal(typeof row.covers, 'function', row.id);
    assert.match(row.why, /^[A-Z][^\n]*\.$/, row.id);
    assert.equal(row.why.split('. ').length, 1, row.id + ' says more than one sentence');
  }
});

const GENERATIONS = recordDirectory('generation');
const REMOVED = { id: 'generation-record-removed', why: REMOVAL_REFUSALS[0].why };
const RECORD_SLUGS = ['first-post', 'zz-specimen', 'a'];
const RECORD_PLACEMENTS = [
  ['flat', (slug) => `${GENERATIONS}/${slug}.json`],
  ['in its month', (slug) => recordPath('generation', slug, CLAIMED_AT)],
  ['below its month', (slug) => `${GENERATIONS}/2026/11/extra/${slug}.json`],
  [
    'in a directory that is no month (filed too deep, and still a record)',
    (slug) => `${GENERATIONS}/nested/${slug}.json`,
  ],
];

for (const [where, place] of RECORD_PLACEMENTS)
  for (const slug of RECORD_SLUGS) {
    const path = place(slug);
    test(`${path} is a generation record, ${where}: refused when removed, allowed when written or changed`, () => {
      assert.equal(isGenerationRecord(path), true);
      assert.deepEqual(removalRefusalFor(path), { ...REMOVED, path });
      assert.equal(refusalFor(path), null);
    });
  }

test('a record is recognised wherever it is filed: four placements of three slugs make twelve records, each refused when removed', () => {
  const paths = RECORD_PLACEMENTS.flatMap(([, place]) => RECORD_SLUGS.map(place));

  assert.equal(paths.length, 12);
  assert.equal(new Set(paths).size, 12);
  assert.deepEqual(paths.filter(isGenerationRecord), paths);
  assert.deepEqual(
    paths.filter((path) => removalRefusalFor(path)?.id === REMOVED.id),
    paths
  );
});

const RECORD_SPELLINGS = [
  ['a leading ./', (path) => './' + path, (path) => path],
  ['backslashes', (path) => path.replaceAll('/', '\\'), (path) => path],
  ['a doubled slash', (path) => path.replace('/generations/', '//generations/'), (path) => path],
  ['capital letters', (path) => path.toUpperCase(), (path) => path.toUpperCase()],
];

for (const [where, place] of RECORD_PLACEMENTS)
  for (const [how, spell, shown] of RECORD_SPELLINGS) {
    const path = place('first-post');
    const spelled = spell(path);
    test(`${JSON.stringify(spelled)} names the record ${where} with ${how}, so another spelling does not slip a removal through`, () => {
      assert.equal(isGenerationRecord(spelled), true);
      assert.deepEqual(removalRefusalFor(spelled), { ...REMOVED, path: shown(path) });
    });
  }

test('every spelling of every placement is a record: four placements in four spellings make sixteen removals refused', () => {
  const spelled = RECORD_PLACEMENTS.flatMap(([, place]) =>
    RECORD_SPELLINGS.map(([, spell]) => spell(place('first-post')))
  );

  assert.equal(spelled.length, 16);
  assert.equal(spelled.filter((path) => removalRefusalFor(path)?.id === REMOVED.id).length, 16);
});

const NOT_RECORDS = [
  `${recordDirectory('ledger')}/first-post.json`,
  recordPath('ledger', 'first-post', CLAIMED_AT),
  `${recordDirectory('ledger')}/2026/11/extra/first-post.json`,
  `${recordDirectory('claim')}/first-post.json`,
  recordPath('claim', 'first-post', CLAIMED_AT),
  `${recordDirectory('claim')}/2026/11/extra/first-post.json`,
  `${DISPOSITIONS}/generated-first-post.json`,
  recordPath('disposition', 'first-post', CLAIMED_AT),
  `${DISPOSITIONS}/2026/11/extra/generated-first-post.json`,
  GENERATIONS + '/first-post.md',
  GENERATIONS + '/2026/11/first-post.md',
  GENERATIONS + '/2026/11/extra/first-post.txt',
  GENERATIONS + '-old/first-post.json',
  GENERATIONS + '-old/2026/11/first-post.json',
  GENERATIONS + '.json',
  GENERATIONS,
  GENERATIONS + '/',
  GENERATIONS + '/2026/11',
  'site/src/data/post/first-post.md',
  'audits/sentence-band.json',
  '',
  undefined,
];

for (const path of NOT_RECORDS) {
  test(JSON.stringify(path) + ' is not a generation record, so removing it is not refused as one', () => {
    assert.equal(isGenerationRecord(path), false);
    assert.equal(removalRefusalFor(path), null);
  });
}

test('twenty-two paths that sit near a record or beside one are none of them a record', () => {
  assert.equal(NOT_RECORDS.length, 22);
  assert.deepEqual(NOT_RECORDS.filter(isGenerationRecord), []);
  assert.deepEqual(
    NOT_RECORDS.filter((path) => removalRefusalFor(path) !== null),
    []
  );
});

test('a removal reads as its id and its sentence, for a record in its month as for a flat one', () => {
  const refusals = RECORD_PLACEMENTS.map(([, place]) => removalRefusalFor(place('first-post')));

  assert.deepEqual(
    refusals.map((refusal) => refusal?.id),
    Array(4).fill(REMOVED.id)
  );
  assert.deepEqual(
    refusals.map((refusal) => describeRefusal(refusal)),
    Array(4).fill(`${REMOVED.id}: ${REMOVED.why}`)
  );
});
