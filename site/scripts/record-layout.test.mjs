import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

import {
  RECORD_FAMILIES,
  familyOf,
  filingProblems,
  findRecordPath,
  layoutProblem,
  locateRecord,
  recordDirectory,
  recordFiles,
  recordPath,
  slugOfRecord,
} from './record-layout.mjs';

const SLUG = 'fractional-caio-vs-full-time-caio-cost';
const CLAIMED = '2026-11-02T20:27:43.937Z';

const SHARDED = {
  ledger: 'audits/autowriter/2026/11/' + SLUG + '.json',
  claim: 'audits/autowriter/claims/2026/11/' + SLUG + '.json',
  generation: 'audits/autowriter/generations/2026/11/' + SLUG + '.json',
  disposition: 'audits/phase-4.7/dispositions/2026/11/generated-' + SLUG + '.json',
};

const FLAT = {
  ledger: 'audits/autowriter/' + SLUG + '.json',
  claim: 'audits/autowriter/claims/' + SLUG + '.json',
  generation: 'audits/autowriter/generations/' + SLUG + '.json',
  disposition: 'audits/phase-4.7/dispositions/generated-' + SLUG + '.json',
};

function inTemp(check) {
  const root = mkdtempSync(join(tmpdir(), 'record-layout-'));
  try {
    return check(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const put = (root, path, text = '{}\n') => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
};

test('there are four families, and each keeps one directory of its own', () => {
  assert.deepEqual(RECORD_FAMILIES, ['ledger', 'claim', 'generation', 'disposition']);
  assert.deepEqual(RECORD_FAMILIES.map(recordDirectory), [
    'audits/autowriter',
    'audits/autowriter/claims',
    'audits/autowriter/generations',
    'audits/phase-4.7/dispositions',
  ]);
});

test('an entry and its date make the month path of every family', () => {
  for (const family of RECORD_FAMILIES) assert.equal(recordPath(family, SLUG, CLAIMED), SHARDED[family], family);
});

test('the month is the UTC month of the instant, so the last second of October stays in October', () => {
  const month = (instant) => recordPath('ledger', 'x', instant);
  assert.equal(month('2026-10-31T23:59:59Z'), 'audits/autowriter/2026/10/x.json');
  assert.equal(month('2026-11-01T00:00:00Z'), 'audits/autowriter/2026/11/x.json');
  assert.equal(month('2026-12-31T23:59:59.999Z'), 'audits/autowriter/2026/12/x.json');
  assert.equal(month('2027-01-01T00:00:00.000Z'), 'audits/autowriter/2027/01/x.json');
  assert.equal(month('2028-02-29T12:00:00Z'), 'audits/autowriter/2028/02/x.json');
});

test('a Date and its ISO text file an entry in the same place', () => {
  const when = new Date('2026-11-02T20:27:43.937Z');
  assert.equal(recordPath('claim', SLUG, when), recordPath('claim', SLUG, when.toISOString()));
});

test('the path never depends on the clock, because a file must not move after it is written', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2031-05-17T08:00:00.000Z') });
  assert.equal(recordPath('generation', SLUG, CLAIMED), SHARDED.generation);
  assert.equal(recordPath('disposition', SLUG, '2026-11-30T23:59:59Z'), SHARDED.disposition);
});

test('a date that is not a real UTC instant is refused instead of filing the record somewhere odd', () => {
  for (const bad of [
    '2026-11-02',
    'not a date',
    '',
    undefined,
    null,
    20261102,
    new Date('nope'),
    '2026-13-01T00:00:00Z',
    '2026-02-30T00:00:00Z',
    '2026-11-02T20:27:43+02:00',
  ])
    assert.throws(() => recordPath('ledger', SLUG, bad), /not a UTC instant/, String(bad));
});

test('a slug that could leave its directory or break the file name is refused', () => {
  for (const bad of ['', '../x', 'A-b', 'a/b', 'a b', 'x.json', '-x', 'x-', 'x--y', undefined, null, 7])
    assert.throws(() => recordPath('ledger', bad, CLAIMED), /not a slug/, String(bad));
});

test('an unknown family is refused', () => {
  assert.throws(() => recordPath('receipt', SLUG, CLAIMED), /unknown record family "receipt"/);
  assert.throws(() => recordDirectory('receipt'), /unknown record family "receipt"/);
});

test('a path belongs to one family at any depth, and a sibling directory is never the ledger directory', () => {
  for (const family of RECORD_FAMILIES) {
    assert.equal(familyOf(SHARDED[family]), family, SHARDED[family]);
    assert.equal(familyOf(FLAT[family]), family, FLAT[family]);
  }
  assert.equal(familyOf('audits/autowriter/2026/11/deeper/still/' + SLUG + '.json'), 'ledger');
  assert.equal(familyOf('audits/autowriter/claims/2026/11/deeper/' + SLUG + '.json'), 'claim');
  assert.equal(familyOf('audits/phase-4.7/dispositions/routes.json'), 'disposition');
  assert.equal(familyOf('audits/autowriter/claims.json'), 'ledger');
  assert.equal(familyOf('audits/autowriter/2026/11/claims.json'), 'ledger');
  assert.equal(familyOf('audits/autowriter/generations.json'), 'ledger');
});

test('a path that is not a json file of a family belongs to none', () => {
  for (const path of [
    'audits/autowriter/README.md',
    'audits/autowriter/2026/11/' + SLUG + '.json.tmp',
    'audits/autowriter',
    'audits/autowriter/claims',
    'audits/autowriter-other/x.json',
    'audits/phase-4.7/inventory.json',
    'audits/phase-4.7/dispositions',
    'audits/phase-4.7/dispositions.json',
    'site/audits/autowriter/x.json',
    './audits/autowriter/x.json',
    '',
    null,
    7,
  ])
    assert.equal(familyOf(path), null, String(path));
});

test('the slug of a record is its file name, less the prefix its family carries', () => {
  assert.equal(slugOfRecord(SHARDED.ledger), SLUG);
  assert.equal(slugOfRecord(SHARDED.claim), SLUG);
  assert.equal(slugOfRecord(SHARDED.generation), SLUG);
  assert.equal(slugOfRecord(SHARDED.disposition), SLUG);
  assert.equal(slugOfRecord(FLAT.disposition), SLUG);
});

test('a disposition file that is not named generated-<slug> is a hand-written layer and has no slug', () => {
  assert.equal(slugOfRecord('audits/phase-4.7/dispositions/routes.json'), null);
  assert.equal(slugOfRecord('audits/phase-4.7/dispositions/2026/11/routes.json'), null);
  assert.equal(slugOfRecord('audits/phase-4.7/dispositions/generated-.json'), null);
  assert.equal(slugOfRecord('audits/autowriter/README.md'), null);
});

test('a record filed under its month has no layout problem, in every family', () => {
  for (const family of RECORD_FAMILIES) assert.equal(layoutProblem(SHARDED[family]), null, family);
});

test('a record that is not filed as year, month, file name is a layout problem, in every family', () => {
  for (const family of RECORD_FAMILIES)
    assert.match(layoutProblem(FLAT[family]), /^is not filed as \S+\/<year>\/<month>\/\S*<slug>\.json$/, family);
});

test('the month directory must be a real month and the year four digits', () => {
  for (const bad of [
    'audits/autowriter/2026/13/x.json',
    'audits/autowriter/2026/00/x.json',
    'audits/autowriter/2026/1/x.json',
    'audits/autowriter/26/11/x.json',
    'audits/autowriter/2026/11/extra/x.json',
    'audits/autowriter/2026/x.json',
    'audits/autowriter/claims/2026/11/extra/x.json',
    'audits/autowriter/generations/2026/x.json',
  ])
    assert.notEqual(layoutProblem(bad), null, bad);
});

test('the hand-written dispositions stay flat, and a generated disposition may not', () => {
  assert.equal(layoutProblem('audits/phase-4.7/dispositions/routes.json'), null);
  assert.equal(layoutProblem('audits/phase-4.7/dispositions/glossary.json'), null);
  assert.notEqual(layoutProblem('audits/phase-4.7/dispositions/generated-x.json'), null);
  assert.notEqual(layoutProblem('audits/phase-4.7/dispositions/2026/11/routes.json'), null);
  assert.notEqual(layoutProblem('audits/phase-4.7/dispositions/deeper/routes.json'), null);
});

test('a path outside every family has no layout problem, because it is not a record', () => {
  assert.equal(layoutProblem('audits/phase-4.7/inventory.json'), null);
  assert.equal(layoutProblem('audits/autowriter/README.md'), null);
});

test('a record is found by its slug at any depth, in its own family only', () => {
  const paths = [FLAT.ledger.replace(SLUG, 'other'), SHARDED.ledger, SHARDED.claim, SHARDED.generation];
  assert.equal(findRecordPath(paths, 'ledger', SLUG), SHARDED.ledger);
  assert.equal(findRecordPath(paths, 'claim', SLUG), SHARDED.claim);
  assert.equal(findRecordPath(paths, 'generation', SLUG), SHARDED.generation);
  assert.equal(findRecordPath(paths, 'disposition', SLUG), null);
  assert.equal(findRecordPath([FLAT.ledger], 'ledger', SLUG), FLAT.ledger);
  assert.equal(findRecordPath([], 'ledger', SLUG), null);
});

test('a generated disposition is found under its generated- name', () => {
  assert.equal(
    findRecordPath([SHARDED.disposition, 'audits/phase-4.7/dispositions/routes.json'], 'disposition', SLUG),
    SHARDED.disposition
  );
  assert.equal(findRecordPath(['audits/phase-4.7/dispositions/routes.json'], 'disposition', 'routes'), null);
});

test('a slug filed twice is refused by name, because the lookup could not tell which file is the record', () => {
  const twice = [SHARDED.ledger, SHARDED.ledger.replace('2026/11', '2026/12')];
  assert.throws(
    () => findRecordPath(twice, 'ledger', SLUG),
    new RegExp('ledger ' + SLUG + ' is filed more than once: .*2026/11.*2026/12')
  );
});

const claimOf = (slug = SLUG, claimedAt = CLAIMED) => ({ slug, claimedAt });

test('records filed where their claim says are not misfiled', () => {
  const paths = Object.values(SHARDED);
  assert.deepEqual(filingProblems({ paths, claims: [claimOf()] }), []);
});

test('a flat record is misfiled, and with a claim the finding names the place it belongs', () => {
  const found = filingProblems({ paths: [FLAT.ledger, FLAT.generation], claims: [claimOf()] });
  assert.deepEqual(
    found.map(({ path }) => path),
    [FLAT.ledger, FLAT.generation]
  );
  assert.equal(
    found[0].detail,
    'the ledger of ' + SLUG + ' belongs at ' + SHARDED.ledger + ', the month of its claim (' + CLAIMED + ')'
  );
  assert.equal(
    found[1].detail,
    'the generation record of ' +
      SLUG +
      ' belongs at ' +
      SHARDED.generation +
      ', the month of its claim (' +
      CLAIMED +
      ')'
  );
});

test('a record filed under a month other than its claim month is misfiled', () => {
  const wrong = SHARDED.claim.replace('2026/11', '2026/12');
  const [found, ...rest] = filingProblems({ paths: [wrong], claims: [claimOf()] });
  assert.equal(rest.length, 0);
  assert.equal(found.path, wrong);
  assert.match(found.detail, /^the claim of \S+ belongs at \S+2026\/11\/\S+, the month of its claim/);
});

test('without a claim to date it, a record is judged on its shape alone', () => {
  assert.deepEqual(filingProblems({ paths: [SHARDED.ledger.replace(SLUG, 'spend-ceiling-2026-11')], claims: [] }), []);
  const [found] = filingProblems({ paths: [FLAT.ledger], claims: [] });
  assert.equal(found.path, FLAT.ledger);
  assert.equal(found.detail, 'is not filed as audits/autowriter/<year>/<month>/<slug>.json');
});

test('a disposition names its slug without the generated- prefix when it looks up the claim', () => {
  assert.deepEqual(filingProblems({ paths: [SHARDED.disposition], claims: [claimOf()] }), []);
  const [found] = filingProblems({ paths: [FLAT.disposition], claims: [claimOf()] });
  assert.match(found.detail, /^the disposition of \S+ belongs at \S+2026\/11\/generated-\S+, the month/);
});

test('the hand-written dispositions and files that are no record are never misfiled', () => {
  const paths = ['audits/phase-4.7/dispositions/routes.json', 'audits/autowriter/README.md', 'site/x.json'];
  assert.deepEqual(filingProblems({ paths, claims: [claimOf('routes')] }), []);
});

test('two files for one slug leave the one in the wrong month named', () => {
  const stray = SHARDED.generation.replace('2026/11', '2026/12');
  const found = filingProblems({ paths: [SHARDED.generation, stray], claims: [claimOf()] });
  assert.deepEqual(
    found.map(({ path }) => path),
    [stray]
  );
});

const RECLAIMED = '2026-12-01T07:00:00.000Z';
const RECLAIMED_AT = {
  claim: SHARDED.claim.replace('2026/11', '2026/12'),
  ledger: SHARDED.ledger.replace('2026/11', '2026/12'),
};
const claimedTwice = () => [claimOf(), claimOf(SLUG, RECLAIMED)];

test('a slug claimed again in a later month leaves its lapsed claim filed where it was, and neither claim is misfiled', () => {
  assert.deepEqual(filingProblems({ paths: [SHARDED.claim, RECLAIMED_AT.claim], claims: claimedTwice() }), []);
  assert.deepEqual(
    filingProblems({ paths: [RECLAIMED_AT.claim, SHARDED.claim], claims: claimedTwice().toReversed() }),
    []
  );
});

test('a ledger filed in the month of any claim of its slug is not misfiled', () => {
  assert.deepEqual(filingProblems({ paths: [SHARDED.ledger], claims: claimedTwice() }), []);
  assert.deepEqual(filingProblems({ paths: [RECLAIMED_AT.ledger], claims: claimedTwice() }), []);
});

test('a record in a month that no claim of its slug names is misfiled, and the finding names the month of the newest claim', () => {
  const october = SHARDED.ledger.replace('2026/11', '2026/10');
  const [found, ...rest] = filingProblems({ paths: [october], claims: claimedTwice() });
  assert.equal(rest.length, 0);
  assert.equal(found.path, october);
  assert.equal(
    found.detail,
    'the ledger of ' + SLUG + ' belongs at ' + RECLAIMED_AT.ledger + ', the month of its claim (' + RECLAIMED + ')'
  );
});

test('a claim looked up by slug is the newest one, whatever order the files are listed in', () => {
  assert.equal(findRecordPath([SHARDED.claim, RECLAIMED_AT.claim], 'claim', SLUG), RECLAIMED_AT.claim);
  assert.equal(findRecordPath([RECLAIMED_AT.claim, SHARDED.claim], 'claim', SLUG), RECLAIMED_AT.claim);
});

test('a claim filed outside its month directory is still ambiguous beside a month claim, so the lookup refuses', () => {
  assert.throws(
    () => findRecordPath([FLAT.claim, SHARDED.claim, RECLAIMED_AT.claim], 'claim', SLUG),
    new RegExp('claim ' + SLUG + ' is filed more than once: .*claims/' + SLUG)
  );
});

test('locateRecord finds the live claim of a slug that was claimed in two months, and still refuses a second ledger', () => {
  inTemp((root) => {
    put(root, SHARDED.claim);
    put(root, RECLAIMED_AT.claim);
    put(root, SHARDED.ledger);
    put(root, RECLAIMED_AT.ledger);
    assert.equal(locateRecord(root, 'claim', SLUG), RECLAIMED_AT.claim);
    assert.throws(() => locateRecord(root, 'ledger', SLUG), /ledger .* is filed more than once/);
  });
});

test('recordFiles lists the json files of one family at every depth, sorted, and never those of a sibling', () => {
  inTemp((root) => {
    for (const path of [
      'audits/autowriter/a.json',
      'audits/autowriter/2026/11/b.json',
      'audits/autowriter/2026/11/c.txt',
      'audits/autowriter/2027/01/deeper/e.json',
      'audits/autowriter/claims/2026/11/d.json',
      'audits/autowriter/claims/f.json',
      'audits/autowriter/generations/2026/11/g.json',
      'audits/phase-4.7/dispositions/routes.json',
      'audits/phase-4.7/dispositions/2026/11/generated-h.json',
      'audits/phase-4.7/inventory.json',
    ])
      put(root, path);
    assert.deepEqual(recordFiles(root, 'ledger'), [
      'audits/autowriter/2026/11/b.json',
      'audits/autowriter/2027/01/deeper/e.json',
      'audits/autowriter/a.json',
    ]);
    assert.deepEqual(recordFiles(root, 'claim'), [
      'audits/autowriter/claims/2026/11/d.json',
      'audits/autowriter/claims/f.json',
    ]);
    assert.deepEqual(recordFiles(root, 'generation'), ['audits/autowriter/generations/2026/11/g.json']);
    assert.deepEqual(recordFiles(root, 'disposition'), [
      'audits/phase-4.7/dispositions/2026/11/generated-h.json',
      'audits/phase-4.7/dispositions/routes.json',
    ]);
  });
});

test('recordFiles finds nothing, and does not fail, where a family has no directory yet', () => {
  inTemp((root) => {
    for (const family of RECORD_FAMILIES) assert.deepEqual(recordFiles(root, family), [], family);
  });
});

test('recordFiles fails when the directory cannot be read, so a silent empty list cannot hide a broken tree', () => {
  inTemp((root) => {
    put(root, 'audits/autowriter');
    assert.throws(() => recordFiles(root, 'ledger'), { code: 'ENOTDIR' });
  });
});

test('recordFiles skips a directory whose name ends in .json', () => {
  inTemp((root) => {
    mkdirSync(join(root, 'audits/autowriter/2026/11/odd.json'), { recursive: true });
    put(root, 'audits/autowriter/2026/11/real.json');
    assert.deepEqual(recordFiles(root, 'ledger'), ['audits/autowriter/2026/11/real.json']);
  });
});

test('recordFiles refuses an unknown family', () => {
  inTemp((root) => assert.throws(() => recordFiles(root, 'receipt'), /unknown record family "receipt"/));
});

test('locateRecord finds the record of a slug on disk at any depth, and null where the family holds none', () => {
  inTemp((root) => {
    put(root, SHARDED.claim);
    put(root, FLAT.ledger);
    assert.equal(locateRecord(root, 'claim', SLUG), SHARDED.claim);
    assert.equal(locateRecord(root, 'ledger', SLUG), FLAT.ledger);
    assert.equal(locateRecord(root, 'generation', SLUG), null);
    assert.equal(locateRecord(root, 'claim', 'another-slug'), null);
  });
});

test('locateRecord refuses a slug filed twice in one family, naming both files', () => {
  inTemp((root) => {
    put(root, SHARDED.generation);
    put(root, SHARDED.generation.replace('2026/11', '2026/12'));
    assert.throws(() => locateRecord(root, 'generation', SLUG), /generation record .* is filed more than once/);
  });
});
