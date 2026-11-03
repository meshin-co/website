import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

import { newLedger, readLedger, writeLedger } from './autowriter-ledger.mjs';
import { readSchema } from './autowriter-records.mjs';
import { raiseOnRun } from './escalate-run.mjs';
import {
  GENERATED_AT,
  discardedLedger,
  escalatedLedger,
  filesOf,
  ledgerOf,
  mergedLedger,
  recordOf,
  stoppedLedger,
  writingCall,
} from './fixtures/spend-report-corpus.mjs';
import { ledgerWithGeneration } from './generation-record.mjs';
import { runCli } from './spend-report.mjs';
import { corpusOf, reportModel } from './spend-report-model.mjs';
import { REPORT_PATH, monthLine, reportMarkdown, slackMessage } from './spend-report-text.mjs';

const NEWEST = '2026-11-02T07:00:00.000Z';
const DRAFT = writingCall({ input: 12000, output: 3000, tag: 'draft' });
const CORRECTION = writingCall({ role: 'correction', input: 13000, output: 2000, tag: 'correction' });
const VERDICT_STATES = readSchema('autowriter-ledger.schema.json').$defs.verdict.properties.state.enum;

const modelOf = (parts) => reportModel(corpusOf(filesOf(parts)), { at: GENERATED_AT });
const MONTH_LINE = monthLine({ month: '2026-11', spentMicro: 77_000, ceilingMicro: 25_000_000 });
const NO_WARNINGS =
  'Warnings: 0 (every ledger agrees with its generation record; this does not say that every run produced an entry)';

function soleArticle() {
  const post = recordOf({ slug: 'a-post', at: NEWEST, calls: [DRAFT, CORRECTION] });
  return { post, ledger: ledgerOf({ slug: 'a-post', calls: post.calls }) };
}

const lostLedger = () => ledgerOf({ slug: 'lost-post', calls: [DRAFT] });

const OPEN_OR_MERGED = (state) =>
  'lost-post: its ledger records a generation of 0.027 USD (verdict: ' +
  state +
  ') but no generation record names this ledger, so no entry is counted for it';
const ENDED = (state) =>
  'lost-post: this run ended on 2026-11-03 with the verdict ' +
  state +
  ' and left no generation record, so no entry is counted for it; its ledger records 0.027 USD for the generation, and the monthly spend ceiling counts that cost';
const DISCARDED =
  'lost-post: a person discarded this attempt on 2026-11-03 and its generation record went with it, so no entry is counted for it and its cost cannot be checked against a record; its ledger records 0.027 USD for the generation, and the monthly spend ceiling counts that cost';
const MISMATCH =
  "a-post: its generation record's writing calls cost 0.05 USD but its ledger records 0.001 USD for the generation, so the record cost is counted";

const BUILDERS = {
  open: (ledger) => ledger,
  merged: mergedLedger,
  stopped: stoppedLedger,
  escalated: escalatedLedger,
  discarded: discardedLedger,
};
const KIND = { open: 'warning', merged: 'warning', stopped: 'note', escalated: 'note', discarded: 'note' };
const SENTENCE = {
  open: OPEN_OR_MERGED('open'),
  merged: OPEN_OR_MERGED('merged'),
  stopped: ENDED('stopped'),
  escalated: ENDED('escalated'),
  discarded: DISCARDED,
};

const headingsOf = (markdown) =>
  markdown
    .split('\n')
    .filter((line) => line.startsWith('## '))
    .map((line) => line.slice(3));

function sectionOf(markdown, title) {
  const lines = markdown.split('\n');
  const start = lines.indexOf(`## ${title}`);
  assert.notEqual(start, -1, `no section "${title}"`);
  const length = lines.slice(start + 1).findIndex((line) => line.startsWith('## '));
  return lines.slice(start + 1, length === -1 ? undefined : start + 1 + length);
}

const itemsOf = (markdown, title) => sectionOf(markdown, title).filter((line) => line.startsWith('- '));
const proseOf = (markdown, title) =>
  sectionOf(markdown, title)
    .filter((line) => line !== '' && !line.startsWith('- '))
    .join(' ');

test('every verdict a ledger can carry is classified, so spend with no entry is never silent', () => {
  assert.deepEqual(Object.keys(BUILDERS).sort(), [...VERDICT_STATES].sort());
  assert.deepEqual(Object.keys(KIND).sort(), [...VERDICT_STATES].sort());
  assert.deepEqual(Object.keys(SENTENCE).sort(), [...VERDICT_STATES].sort());
});

for (const state of VERDICT_STATES) {
  test(`a ledger with the verdict ${state} that spent and has no record is a ${KIND[state]}, in its own sentence`, () => {
    const model = modelOf({ ledgers: [BUILDERS[state](lostLedger())] });
    assert.deepEqual(KIND[state] === 'warning' ? model.warnings : model.notes, [SENTENCE[state]]);
    assert.deepEqual(KIND[state] === 'warning' ? model.notes : model.warnings, []);
    assert.equal(model.empty, true);
  });

  test(`a ledger with the verdict ${state} that has its record is neither a warning nor a note, and its entry is counted`, () => {
    const { post, ledger } = soleArticle();
    const model = modelOf({ ledgers: [BUILDERS[state](ledger)], records: [post] });
    assert.deepEqual(model.warnings, []);
    assert.deepEqual(model.notes, []);
    assert.equal(model.allTime.totals.all.entries, 1);
  });
}

test('a discarded attempt beside an entry that adds up is a note: the report states it, no warning is counted and the entry is still totalled', () => {
  const { post, ledger } = soleArticle();
  const model = modelOf({ ledgers: [ledger, discardedLedger(lostLedger())], records: [post] });
  assert.deepEqual(model.warnings, []);
  assert.deepEqual(model.notes, [DISCARDED]);
  const markdown = reportMarkdown(model);
  assert.deepEqual(headingsOf(markdown), [
    'This month',
    'About this file',
    'This entry',
    'Last 30 days',
    'All time',
    'Every entry',
    'Rates',
    'Notes',
  ]);
  assert.deepEqual(itemsOf(markdown, 'Notes'), [`- ${DISCARDED}`]);
  assert.match(
    proseOf(markdown, 'Notes'),
    /^These runs ended with no entry and together cost 0\.027 USD\. That spend is in no entry row; the paid tables count it under Runs that ended with no entry\. A note is not a warning: nothing a person does can clear it, because a run that ended will never gain a record\.$/
  );
  assert.equal(model.allTime.totals.all.entries, 1);
  assert.equal(model.allTime.totals.all.micro, 50000);
});

test('the Slack message of that corpus says zero warnings and does not carry the note', () => {
  const { post, ledger } = soleArticle();
  const model = modelOf({ ledgers: [ledger, discardedLedger(lostLedger())], records: [post] });
  const message = slackMessage(model, model.rows, MONTH_LINE);
  assert.deepEqual(message.split('\n\n').at(-1).split('\n'), [NO_WARNINGS]);
  assert.doesNotMatch(message, /lost-post/);
  assert.doesNotMatch(message, /discarded/);
  assert.doesNotMatch(message, /Notes/);
});

test('a ledger that records less than its record cost still warns and still counts, beside a discarded attempt that is only a note', () => {
  const { post } = soleArticle();
  const low = ledgerWithGeneration(newLedger({ slug: 'a-post', runId: 'run-1', pullRequest: null }), {
    tokens: { input: 1, output: 1 },
    costUsd: 0.001,
  });
  const model = modelOf({ ledgers: [low, discardedLedger(lostLedger())], records: [post] });
  assert.deepEqual(model.warnings, [MISMATCH]);
  assert.deepEqual(model.notes, [DISCARDED]);
  assert.equal(model.allTime.totals.all.micro, 50000, 'the entry is still counted');
  const markdown = reportMarkdown(model);
  assert.deepEqual(headingsOf(markdown).slice(-2), ['Warnings', 'Notes']);
  assert.deepEqual(itemsOf(markdown, 'Warnings'), [`- ${MISMATCH}`]);
  assert.match(proseOf(markdown, 'Warnings'), /needs a person to look at it/);
  const message = slackMessage(model, model.rows, MONTH_LINE);
  assert.deepEqual(message.split('\n\n').at(-1).split('\n'), [
    'Warnings: 1 (each needs a person to look at it)',
    MISMATCH,
  ]);
  assert.doesNotMatch(message, /lost-post/);
});

test('with only a discarded attempt no entry can be counted, and the file does not say that nothing was generated', () => {
  const model = modelOf({ ledgers: [discardedLedger(lostLedger())] });
  const markdown = reportMarkdown(model);
  assert.equal(model.empty, true);
  assert.deepEqual(headingsOf(markdown), ['This month', 'About this file', 'No entry yet', 'Notes']);
  assert.match(
    proseOf(markdown, 'No entry yet'),
    /^No generation record could be counted, so this file holds no entry row, no entry total and no rate\./
  );
  assert.doesNotMatch(markdown, /No entry has been generated/);
  assert.deepEqual(itemsOf(markdown, 'Notes'), [`- ${DISCARDED}`]);
});

test('the definitions name the attempt a person discarded among the runs that ended with no entry, and point to the notes', () => {
  const markdown = reportMarkdown(modelOf({}));
  assert.match(
    markdown,
    /a run that stopped before any entry existed and an attempt that a person discarded have no entry, so no row holds them/
  );
  assert.match(markdown, /the runs that ended with no entry, which the Notes name;/);
});

const FETCH_ANSWERS = () => {
  const answers = [
    new Response(JSON.stringify({ number: 12, html_url: 'https://github.test/meshin-co/website/issues/12' }), {
      status: 201,
    }),
    new Response('ok', { status: 200 }),
  ];
  return async () => answers.shift();
};

const ESCALATION_ENV = {
  GITHUB_TOKEN: 'ghp_SECRETtokenVALUE0123456789',
  GITHUB_REPOSITORY: 'meshin-co/website',
  GITHUB_SERVER_URL: 'https://github.test',
  GITHUB_RUN_ID: '777',
  SLACK_WEBHOOK_URL: 'https://hooks.slack.test/services/T0SECRET/B0SECRET/xoxSECRETpath',
};

test('the ledger that a failed write leaves on main once the workflow has escalated it is a note, not a warning nobody can clear', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'spend-report-notes-'));
  try {
    const path = join(directory, 'lost-post.json');
    writeLedger(path, stoppedLedger(lostLedger()));
    assert.equal(readLedger(path).verdict.state, 'stopped');
    await raiseOnRun({
      ledgerDir: directory,
      slug: 'lost-post',
      kind: 'hard-stop',
      title: 'Write daily stopped while writing lost-post (output)',
      detail: 'npm run write:entry failed with kind output: the response was cut off.',
      env: ESCALATION_ENV,
      fetch: FETCH_ANSWERS(),
      now: () => new Date('2026-11-03T09:00:00.000Z'),
    });
    const left = readLedger(path);
    assert.equal(left.verdict.state, 'escalated');
    const model = reportModel(corpusOf(filesOf({ ledgers: [left] })), { at: GENERATED_AT });
    assert.deepEqual(model.warnings, []);
    assert.deepEqual(model.notes, [ENDED('escalated')]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

async function inRepo(files, body) {
  const root = mkdtempSync(join(tmpdir(), 'spend-report-notes-'));
  try {
    for (const { path, text } of [...files.ledgers, ...files.records]) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), text);
    }
    const out = [];
    const err = [];
    const io = {
      env: {},
      fetch: async () => {
        throw new Error('the write command reads no network');
      },
      stdout: (line) => out.push(line),
      stderr: (line) => err.push(line),
      revisionOf: () => 'abc1234',
      now: () => new Date(GENERATED_AT),
    };
    const code = await runCli(['--repo-root', root], io);
    return await body({ code, out, err, read: (path) => readFileSync(join(root, path), 'utf8') });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('write counts a note in its summary, prints nothing on stderr for it and writes it into the file', () =>
  inRepo(filesOf({ ledgers: [discardedLedger(lostLedger())] }), ({ code, out, err, read }) => {
    assert.equal(code, 0);
    assert.deepEqual(err, []);
    assert.deepEqual(out, [`spend report: wrote ${REPORT_PATH} (no entry counted, 0 warnings, 1 note)`]);
    assert.deepEqual(itemsOf(read(REPORT_PATH), 'Notes'), [`- ${DISCARDED}`]);
  }));

test('write still prints the warning of a real mismatch on stderr, and only that, beside a note', () => {
  const { post } = soleArticle();
  const low = ledgerWithGeneration(newLedger({ slug: 'a-post', runId: 'run-1', pullRequest: null }), {
    tokens: { input: 1, output: 1 },
    costUsd: 0.001,
  });
  return inRepo(filesOf({ ledgers: [low, discardedLedger(lostLedger())], records: [post] }), ({ code, out, err }) => {
    assert.equal(code, 0);
    assert.deepEqual(err, [`spend report: warning: ${MISMATCH}`]);
    assert.deepEqual(out, [`spend report: wrote ${REPORT_PATH} (1 entry, 1 warning, 1 note)`]);
  });
});
