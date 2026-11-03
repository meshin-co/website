import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  DISPOSITION_DIRECTORY,
  REFUSED_PATHS,
  describeRefusal,
  isDispositionFile,
  refusalFor,
  refusalOf,
  sealSignature,
} from './autowriter-refusals.mjs';
import { restatedReason } from './disposition-restate.mjs';
import { writeMeasuredStamp } from './lh-evidence.mjs';
import { DISPOSITION_DIRECTORY as DERIVED_DIRECTORY, dispositionFor } from './route-derive.mjs';
import { BAND_FILE } from './sentence-band.mjs';

const whyOf = (id) => REFUSED_PATHS.find((row) => row.id === id)?.why;

test('the list names what automation may never write, each row with one sentence that says why', () => {
  assert.deepEqual(
    REFUSED_PATHS.map(({ id }) => id),
    ['sentence-band', 'lighthouse-record', 'lighthouse-stamp', 'lighthouse-report']
  );
  for (const row of REFUSED_PATHS) {
    assert.equal(typeof row.covers, 'function', row.id);
    assert.match(row.why, /^[A-Z][^\n]*\.$/, row.id);
    assert.equal(row.why.split('. ').length, 1, row.id + ' says more than one sentence');
  }
});

const REFUSED = [
  ['audits/sentence-band.json', 'sentence-band'],
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
  'audits/autowriter/model-registry.json',
  'audits/autowriter/generations/model-registry.json',
  'audits/autowriter/claims/model-registry.json',
  'audits/phase-4.7/dispositions/generated-model-registry.json',
  'audits/sentence-band.json.bak',
  'audits/sentence-band.md',
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
  assert.equal(refusalFor('audits/lighthouse-green.json')?.id, 'lighthouse-record');
  assert.equal(DISPOSITION_DIRECTORY, DERIVED_DIRECTORY);
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

const PATH = DISPOSITION_DIRECTORY + '/routes.json';
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

test('a disposition file is a json file directly in the dispositions directory, however the path is spelled', () => {
  for (const path of [
    PATH,
    './' + PATH,
    DISPOSITION_DIRECTORY + '/generated-model-registry.json',
    'Audits/Phase-4.7/Dispositions/Routes.JSON',
  ])
    assert.equal(isDispositionFile(path), true, path);
  for (const path of [
    DISPOSITION_DIRECTORY + '/deeper/routes.json',
    DISPOSITION_DIRECTORY + '/routes.md',
    DISPOSITION_DIRECTORY,
    'audits/phase-4.7/inventory.json',
    'audits/autowriter/routes.json',
    '',
    null,
    7,
  ])
    assert.equal(isDispositionFile(path), false, String(path));
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
    DISPOSITION_DIRECTORY + '/deeper/routes.json',
    DISPOSITION_DIRECTORY + '/notes.md',
    'site/src/data/post/x.md',
  ])
    assert.equal(compared([entry()], [entry({ digest: 'bbbbbbbbbbbb' })], path), null, path);
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
  const restated = restatedReason({ routes: ['/glossary/model-registry'], slugs: ['model-registry'] });
  const generated = dispositionFor({
    slug: 'model-registry',
    target: '/blog',
    digest: 'x',
    runDate: '2026-11-02',
  }).reason;

  for (const reason of [restated, generated])
    assert.equal(compared([entry({ reason })], [entry({ reason, digest: 'bbbbbbbbbbbb' })]), null, reason);
});

test('a human reason stays sealed when it sits in a file beside a reason the pipeline wrote', () => {
  const reason = restatedReason({ routes: ['/glossary/model-registry'], slugs: ['model-registry'] });
  const found = compared(
    [entry(), second({ reason })],
    [entry({ digest: 'bbbbbbbbbbbb' }), second({ reason, digest: 'cccccccccccc' })]
  );

  assert.deepEqual(found?.targets, ['/blog head.title']);
});

test('a reason that only starts like the pipeline wrote it is still a human reason once words come first', () => {
  const reason = 'Note: ' + restatedReason({ routes: ['/glossary/model-registry'], slugs: ['model-registry'] });

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
