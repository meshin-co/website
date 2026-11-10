import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

import { keywordReportText } from './fixtures/pick-scene.mjs';
import {
  GROWTH_FACTOR,
  GROWTH_FLOOR,
  HANDLED_PATH,
  deadRecords,
  handledFindings,
  isHandled,
  readHandled,
  readingOf,
  runCli,
} from './keyword-handled.mjs';
import { KEYWORD_REPORT_PATH } from './topic-keywords.mjs';

const row = (extra = {}) => ({
  phrase: 'ai governance framework',
  route: '/glossary/ai-governance',
  impressions: 803,
  handledOn: '2026-11-10',
  reason: 'Added a framework section with the five controls the page defines.',
  ...extra,
});

const asked = (phrase, route, exact) => ({ phrase, route, exact });

const inRepo = (body) => {
  const root = mkdtempSync(join(tmpdir(), 'keyword-handled-'));
  try {
    return body(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

const put = (root, path, text) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
};

test('the ledger is audits/keyword-handled.json, and growth means at least doubled and at least 50 more', () => {
  assert.equal(HANDLED_PATH, 'audits/keyword-handled.json');
  assert.equal(GROWTH_FACTOR, 2);
  assert.equal(GROWTH_FLOOR, 50);
});

test('a handled pair is not advised, and the same phrase against another route is', () => {
  const rows = [row()];
  assert.equal(isHandled(rows, asked('ai governance framework', '/glossary/ai-governance', 803)), true);
  assert.equal(isHandled(rows, asked('ai governance framework', '/glossary/nist-ai-rmf', 803)), false);
  assert.equal(isHandled(rows, asked('ai governance policy', '/glossary/ai-governance', 32)), false);
});

test('an unhandled pair is advised, whatever else is handled', () => {
  assert.equal(isHandled([], asked('dpia template', '/glossary/dpia', 78)), false);
  assert.equal(isHandled([row()], asked('dpia template', '/glossary/dpia', 78)), false);
});

test('a pair stays handled while its impressions are short of double, or double but under 50 more', () => {
  const small = [row({ impressions: 32 })];
  assert.equal(isHandled(small, asked('ai governance framework', '/glossary/ai-governance', 32)), true);
  assert.equal(isHandled(small, asked('ai governance framework', '/glossary/ai-governance', 64)), true);
  assert.equal(isHandled(small, asked('ai governance framework', '/glossary/ai-governance', 81)), true);
  const large = [row({ impressions: 803 })];
  assert.equal(isHandled(large, asked('ai governance framework', '/glossary/ai-governance', 1605)), true);
});

test('a handled pair whose impressions grew past the threshold is advised again', () => {
  const small = [row({ impressions: 32 })];
  assert.equal(isHandled(small, asked('ai governance framework', '/glossary/ai-governance', 82)), false);
  assert.equal(isHandled(small, asked('ai governance framework', '/glossary/ai-governance', 803)), false);
  const large = [row({ impressions: 803 })];
  assert.equal(isHandled(large, asked('ai governance framework', '/glossary/ai-governance', 1606)), false);
});

test('a handled pair whose impressions fell stays handled', () => {
  assert.equal(isHandled([row()], asked('ai governance framework', '/glossary/ai-governance', 40)), true);
});

test('a missing ledger is nothing handled and no error', () => {
  inRepo((root) => assert.deepEqual(readHandled(root), []));
});

test('an empty ledger, a blank one and an empty list are nothing handled and no error', () => {
  for (const text of ['', '  \n', '[]', '[]\n']) {
    inRepo((root) => {
      put(root, HANDLED_PATH, text);
      assert.deepEqual(readHandled(root), [], JSON.stringify(text));
      assert.deepEqual(readingOf(text).problems, [], JSON.stringify(text));
    });
  }
});

test('a ledger that is a directory, is not JSON or is not a list is nothing handled at run time, and a problem in the reading', () => {
  inRepo((root) => {
    mkdirSync(join(root, HANDLED_PATH), { recursive: true });
    assert.deepEqual(readHandled(root), []);
  });
  for (const text of ['{ nope', '{"phrase": "x"}', '"text"', 'null']) {
    inRepo((root) => {
      put(root, HANDLED_PATH, text);
      assert.deepEqual(readHandled(root), [], text);
    });
    assert.equal(readingOf(text).problems.length, 1, text);
    assert.deepEqual(readingOf(text).rows, [], text);
  }
});

test('a ledger is read from the repository root and gives its rows as written', () => {
  inRepo((root) => {
    put(root, HANDLED_PATH, `${JSON.stringify([row(), row({ phrase: 'dpia template', route: '/glossary/dpia' })])}\n`);
    assert.deepEqual(
      readHandled(root).map(({ phrase }) => phrase),
      ['ai governance framework', 'dpia template']
    );
  });
});

const BAD = {
  'no phrase': [{ phrase: undefined }, 'row 1: phrase must be'],
  'a phrase with space around it': [{ phrase: ' dpia template' }, '" dpia template": phrase must be'],
  'a route that is no route': [{ route: 'glossary/dpia' }, 'route must be a route of the site'],
  'impressions of zero': [{ impressions: 0 }, 'impressions must be a whole number of at least 1'],
  'impressions as text': [{ impressions: '803' }, 'impressions must be a whole number of at least 1'],
  'a day that is not on the calendar': [{ handledOn: '2026-02-30' }, 'handledOn must be a calendar day'],
  'a day with a time': [{ handledOn: '2026-11-10T07:00:00Z' }, 'handledOn must be a calendar day'],
  'no reason': [{ reason: undefined }, 'reason must say what was done to the route'],
  'a blank reason': [{ reason: '   ' }, 'reason must say what was done to the route'],
  'a field a row does not carry': [{ note: 'x' }, 'carries the field "note"'],
};

for (const [name, [change, expected]] of Object.entries(BAD)) {
  test(`a row with ${name} is a problem naming the row, and is not counted as handled`, () => {
    const reading = readingOf(JSON.stringify([row(change)]));
    assert.equal(reading.problems.length, 1, reading.problems.join('; '));
    assert.ok(reading.problems[0].includes(expected), reading.problems[0]);
    assert.deepEqual(reading.rows, []);
  });
}

test('a row that is not an object is a problem', () => {
  const reading = readingOf(JSON.stringify(['ai governance framework', null, [], row()]));
  assert.equal(reading.problems.length, 3);
  assert.equal(reading.rows.length, 1);
});

test('a pair recorded twice is a problem, because a pair has one record that is updated in place', () => {
  const reading = readingOf(JSON.stringify([row(), row({ impressions: 900 })]));
  assert.equal(reading.problems.length, 1);
  assert.ok(reading.problems[0].includes('is recorded twice'), reading.problems[0]);
});

test('the same phrase against two routes is two pairs and no problem', () => {
  const reading = readingOf(JSON.stringify([row(), row({ route: '/glossary/nist-ai-rmf' })]));
  assert.deepEqual(reading.problems, []);
  assert.equal(reading.rows.length, 2);
});

test('the gate finds each problem of the file as a handled-invalid finding naming the ledger', () => {
  const found = handledFindings(JSON.stringify([row({ reason: '' }), row({ phrase: 'dpia template' })]));
  assert.deepEqual(
    found.map(({ rule, path }) => [rule, path]),
    [['handled-invalid', HANDLED_PATH]]
  );
  assert.ok(found[0].detail.includes('"ai governance framework": reason must say'), found[0].detail);
  assert.deepEqual(handledFindings(''), []);
  assert.deepEqual(handledFindings(JSON.stringify([row()])), []);
});

test('a record whose phrase is no longer a candidate at all is dead, and one still listed is not', () => {
  const rows = [row(), row({ phrase: 'dpia template', route: '/glossary/dpia' })];
  const candidates = [{ phrase: 'dpia template', exact: 78, broad: 78 }];
  assert.deepEqual(
    deadRecords(rows, candidates).map(({ phrase }) => phrase),
    ['ai governance framework']
  );
  assert.deepEqual(deadRecords(rows, []), rows);
  assert.deepEqual(deadRecords([], candidates), []);
});

const ledgerOf = (rows) => `${JSON.stringify(rows, null, 2)}\n`;
const withCli = async (files, argv, body) => {
  const root = mkdtempSync(join(tmpdir(), 'keyword-handled-'));
  try {
    for (const [path, text] of Object.entries(files)) put(root, path, text);
    const [out, err] = [[], []];
    const exit = await runCli(argv, {
      repoRoot: root,
      stdout: (line) => out.push(line),
      stderr: (line) => err.push(line),
    });
    return body({ exit, out, err, read: (path) => readFileSync(join(root, path), 'utf8') });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

const LIVE = keywordReportText({ candidates: [['dpia template', 78, 78]] });
const LIVE_ROW = row({ phrase: 'dpia template', route: '/glossary/dpia', impressions: 78 });

test('the cleanup lists a dead record and leaves the file as it was', async () => {
  const text = ledgerOf([row(), LIVE_ROW]);
  await withCli({ [HANDLED_PATH]: text, [KEYWORD_REPORT_PATH]: LIVE }, [], ({ exit, out, err, read }) => {
    assert.equal(exit, 0, err.join('\n'));
    assert.deepEqual(err, []);
    assert.equal(out.length, 2, out.join('\n'));
    assert.ok(
      out[0].startsWith('dead: "ai governance framework", /glossary/ai-governance, handled 2026-11-10'),
      out[0]
    );
    assert.ok(out[0].includes('delete the row, or run with --prune'), out[0]);
    assert.equal(out[1], 'keyword-handled: 2 records, 1 dead');
    assert.equal(read(HANDLED_PATH), text);
  });
});

test('the cleanup with --prune removes the dead record and keeps the live one as it was written', async () => {
  const files = { [HANDLED_PATH]: ledgerOf([row(), LIVE_ROW]), [KEYWORD_REPORT_PATH]: LIVE };
  await withCli(files, ['--prune'], ({ exit, out, read }) => {
    assert.equal(exit, 0);
    assert.equal(out.at(-1), 'keyword-handled: 2 records, 1 dead, 1 pruned');
    assert.equal(read(HANDLED_PATH), ledgerOf([LIVE_ROW]));
  });
});

test('the cleanup of a ledger with nothing dead writes nothing', async () => {
  const text = ledgerOf([LIVE_ROW]);
  await withCli({ [HANDLED_PATH]: text, [KEYWORD_REPORT_PATH]: LIVE }, ['--prune'], ({ exit, out, read }) => {
    assert.equal(exit, 0);
    assert.deepEqual(out, ['keyword-handled: 1 record, 0 dead, 0 pruned']);
    assert.equal(read(HANDLED_PATH), text);
  });
});

test('the cleanup of a missing or empty ledger is no error and writes nothing', async () => {
  await withCli({ [KEYWORD_REPORT_PATH]: LIVE }, ['--prune'], ({ exit, out }) => {
    assert.equal(exit, 0);
    assert.deepEqual(out, ['keyword-handled: 0 records, 0 dead, 0 pruned']);
  });
  await withCli({ [HANDLED_PATH]: '', [KEYWORD_REPORT_PATH]: LIVE }, ['--prune'], ({ exit, read }) => {
    assert.equal(exit, 0);
    assert.equal(read(HANDLED_PATH), '');
  });
});

test('the cleanup never prunes against a report it cannot read, because every record would look dead', async () => {
  const text = ledgerOf([row()]);
  for (const files of [{ [HANDLED_PATH]: text }, { [HANDLED_PATH]: text, [KEYWORD_REPORT_PATH]: 'not a report\n' }]) {
    await withCli(files, ['--prune'], ({ exit, err, read }) => {
      assert.equal(exit, 1);
      assert.ok(err[0].includes(`${KEYWORD_REPORT_PATH} has no Measured day`), err[0]);
      assert.equal(read(HANDLED_PATH), text);
    });
  }
});

test('the cleanup of a ledger with a problem names it and writes nothing', async () => {
  const text = ledgerOf([row({ reason: '' })]);
  await withCli({ [HANDLED_PATH]: text, [KEYWORD_REPORT_PATH]: LIVE }, ['--prune'], ({ exit, err, read }) => {
    assert.equal(exit, 1);
    assert.ok(err[0].includes('reason must say what was done to the route'), err[0]);
    assert.equal(read(HANDLED_PATH), text);
  });
});

test('the cleanup refuses an argument it does not know', async () => {
  await withCli({ [KEYWORD_REPORT_PATH]: LIVE }, ['--force'], ({ exit, err }) => {
    assert.equal(exit, 1);
    assert.ok(err[0].includes('unknown argument --force'), err[0]);
  });
});
