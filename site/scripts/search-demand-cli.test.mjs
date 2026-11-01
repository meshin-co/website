import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

import { SPECIMENS } from './mutation-specimens.mjs';

const GATE = join(import.meta.dirname, 'search-demand-gate.mjs');

const CORE_DOC = [
  '### The 30 buyer prompts (PRD §17.3)',
  '',
  '**7. AI acceptable use policy template**',
  'Must win: `/blog/ai-acceptable-use-policy-for-a-50-person-company`.',
  '',
  '**8. EU AI Act obligations for deployers small business**',
  'Must win: `/glossary/eu-ai-act`.',
  '',
  '**17. fractional AI leader Europe remote**',
  'Must win: nothing. Retired 2026-10-02 by L57.',
  '',
  '### GAP register',
  '',
].join('\n');

const reportOf = (measured) =>
  [
    '# Search demand',
    '',
    'Measured: ' + measured + ' (window 2026-08-01 to 2026-10-30)',
    '',
    '| # | Prompt | Must win | Impressions | Position | Carried by |',
    '| --- | --- | --- | --- | --- | --- |',
    '| 7 | AI acceptable use policy template | `/blog/ai-acceptable-use-policy-for-a-50-person-company` | unproven | - | - |',
    '| 8 | EU AI Act obligations for deployers small business | `/glossary/eu-ai-act` | 28 | 77.0 | - |',
    '| 17 | fractional AI leader Europe remote | - | unproven | - | - |',
    '',
  ].join('\n');

const todayUtc = () => new Date().toISOString().slice(0, 10);

function fixtureRepo({ report = reportOf(todayUtc()), core = CORE_DOC, docs = {}, git = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'demand-gate-'));
  const put = (path, text) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  put('docs/SEMANTIC-CORE.md', core);
  if (report !== null) put('audits/search-demand.md', report);
  for (const [path, text] of Object.entries(docs)) put(path, text);
  if (git) {
    execFileSync('git', ['init', '-q'], { cwd: root });
    execFileSync('git', ['add', '-A'], { cwd: root });
  }
  return root;
}

const runGate = (root, options = {}) => {
  const { status, stdout, stderr } = spawnSync(process.execPath, [GATE, root], { encoding: 'utf8', ...options });
  return { status, stdout, stderr };
};

const inFixture = (options, check) => {
  const root = fixtureRepo(options);
  try {
    return check(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

test('a fresh report, a complete table and no claim exit 0 and print what was read', () => {
  inFixture({ docs: { 'docs/notes.md': '# Notes\n\nPrompt 8 is won.\n' } }, (root) => {
    const { status, stdout, stderr } = runGate(root);
    assert.equal(stderr, '');
    assert.equal(status, 0);
    assert.match(
      stdout,
      /^demand: audits\/search-demand\.md measured \d{4}-\d{2}-\d{2} \(\d+ days old, limit 35\), 3 of 3 core prompts have a row, 2 documents read for won-claims, 0 findings$/m
    );
  });
});

test('the gate needs no secret and no network: it gives the same verdict with an empty environment', () => {
  inFixture({}, (root) => {
    const { status, stdout } = runGate(root, { env: {} });
    assert.equal(status, 0);
    assert.match(stdout, /0 findings/);
  });
});

test('a stale report exits 1 naming the date and the command', () => {
  inFixture({ report: reportOf('2020-01-01') }, (root) => {
    const { status, stderr } = runGate(root);
    assert.equal(status, 1);
    assert.match(
      stderr,
      /^DEMAND report-stale audits\/search-demand\.md: measured 2020-01-01; refresh with npm run audit:demand \(\d+ days old, limit 35\)$/m
    );
  });
});

test('a missing report exits 1 and says how to make one', () => {
  inFixture({ report: null }, (root) => {
    const { status, stderr } = runGate(root);
    assert.equal(status, 1);
    assert.match(
      stderr,
      /DEMAND report-stale audits\/search-demand\.md: no "Measured: YYYY-MM-DD" line.*npm run audit:demand/
    );
  });
});

test('a prompt the report predates exits 1 naming the prompt', () => {
  const core = CORE_DOC.replace('### GAP register', '**31. zz new prompt**\nMust win: `/`.\n\n### GAP register');
  inFixture({ core }, (root) => {
    const { status, stderr } = runGate(root);
    assert.equal(status, 1);
    assert.match(
      stderr,
      /DEMAND prompt-without-row docs\/SEMANTIC-CORE\.md: prompt 31 "zz new prompt" \(must win \/\) has no row/
    );
  });
});

test('a claim in a document exits 1 naming the document, its line and the measured number', () => {
  inFixture({ docs: { 'docs/plan.md': '# Plan\n\nPrompt 7 is won.\n' } }, (root) => {
    const { status, stderr } = runGate(root);
    assert.equal(status, 1);
    assert.match(
      stderr,
      /DEMAND claim-outruns-data docs\/plan\.md:3: says prompt 7 is won, but audits\/search-demand\.md records 0 impressions for it/
    );
  });
});

test('a claim in an archived change, in a dated record or under audits/ is not read', () => {
  const claim = '\nPrompt 7 is won.\n';
  const docs = {
    'openspec/changes/archive/2026-10-13-09-x/proposal.md': '# Old' + claim,
    'investigation/02-record.md': '---\nrecord: true\n---\n\n# Record' + claim,
    'audits/phase-1/note.md': '# Note' + claim,
  };
  inFixture({ docs }, (root) => {
    const { status, stdout } = runGate(root);
    assert.equal(status, 0);
    assert.match(stdout, /1 documents read for won-claims/);
  });
});

test('a tracked document is read through git, and a document that git does not track is not', () => {
  inFixture({ docs: { 'docs/tracked.md': 'Prompt 7 is won.\n' }, git: true }, (root) => {
    writeFileSync(join(root, 'docs/untracked.md'), 'Prompt 8 and 7 are won.\n');
    const { status, stderr } = runGate(root);
    assert.equal(status, 1);
    assert.match(stderr, /docs\/tracked\.md/);
    assert.doesNotMatch(stderr, /docs\/untracked\.md/);
  });
});

const snapshot = (root) => ({
  core: readFileSync(join(root, 'docs/SEMANTIC-CORE.md'), 'utf8'),
  report: readFileSync(join(root, 'audits/search-demand.md'), 'utf8'),
  docs: readdirSync(join(root, 'docs')),
  tracked: execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }),
});

for (const name of ['demandReportStale', 'demandPromptWithoutRow', 'demandClaimOutrunsData']) {
  test(
    'specimen ' +
      name +
      ' turns the gate red naming its token, and restoring it turns the gate green and changes no byte',
    async () => {
      assert.ok(SPECIMENS[name], 'specimen ' + name + ' is registered');
      assert.equal(SPECIMENS[name].gate, 'gate:demand');
      const root = fixtureRepo({ git: true });
      mkdirSync(join(root, 'site'));
      try {
        const before = snapshot(root);
        const restore = await SPECIMENS[name].plant(join(root, 'site'));
        assert.equal(typeof restore, 'function');
        const planted = runGate(root);
        assert.equal(planted.status, 1);
        assert.ok(planted.stderr.replace(/\s+/g, ' ').includes(SPECIMENS[name].token), planted.stderr);
        await restore();
        assert.deepEqual(snapshot(root), before);
        assert.equal(runGate(root).status, 0);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  );
}
