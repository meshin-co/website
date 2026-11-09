import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { newClaim, readClaim, writeClaim } from './autowriter-claim-store.mjs';
import { newLedger, readLedger } from './autowriter-ledger.mjs';
import { printedLines, runCli, runIdFor, summaryMarkdown } from './pick-a-topic.mjs';
import { recordDirectory, recordPath } from './record-layout.mjs';
import { BAND_FILE } from './sentence-band.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPORT = 'audits/search-demand.md';
const INPUT_KEYS =
  'claims concepts forms generated keywords ledgerPaths now order posts promptSources report rotation settings suffix'.split(
    ' '
  );
const NOW = new Date('2026-11-02T04:00:00.000Z');
const POST = 'fractional-caio-vs-full-time-caio-cost';
const TERM = 'what-is-a-model-card';
const CHOICE = 'Choice: signal 2, prompt 2, unproven, 0 impressions in the window to 2026-10-30';
const ADVISORY = { source: 'measured', route: '/services/fractional-caio', query: 'fractional caio', number: null };
const MEASURED = { ...ADVISORY, impressions: 12, position: 14.5, reason: 'it ranks at position 14.5' };
const STRENGTHEN_LINE =
  'Strengthen: /services/fractional-caio, "fractional caio", 12 impressions at position 14.5: it ranks at position 14.5';

async function inRepo(check) {
  const root = mkdtempSync(join(tmpdir(), 'pick-a-topic-'));
  try {
    for (const directory of ['audits', 'docs', 'site/src/data/post'])
      mkdirSync(join(root, directory), { recursive: true });
    cpSync(join(HERE, 'fixtures', 'search-demand-2026-11-01.md'), join(root, REPORT));
    cpSync(join(HERE, '..', '..', 'docs', 'SEMANTIC-CORE.md'), join(root, 'docs', 'SEMANTIC-CORE.md'));
    writeFileSync(join(root, 'site', 'src', 'config.yaml'), 'site:\n  name: meshin.co\n');
    writeFileSync(join(root, 'site', 'content-facts.json'), '{}\n');
    return await check(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function snapshot(root) {
  const files = readdirSync(root, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile());
  return Object.fromEntries(
    files.map(({ parentPath, name }) => [join(parentPath, name), readFileSync(join(parentPath, name), 'utf8')])
  );
}

const put = (root, path, text) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
};

const filesIn = (root, directory) =>
  readdirSync(join(root, directory), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map(({ parentPath, name }) => relative(root, join(parentPath, name)))
    .sort();

const flatPath = (family, slug) => `${recordDirectory(family)}/${slug}.json`;
const belowMonth = (path) => `${dirname(path)}/extra/${basename(path)}`;

const decisionOf = (overrides) => ({
  ...{ decision: 'none', choice: null, reason: null, entries: [], strengthen: null, advisories: [], fallback: null },
  ...{ refusals: [], concepts: { named: [] }, proposals: [], trail: [] },
  ...overrides,
});
const entryOf = (format, title, slug) => ({ format, topic: { title, slug }, prompt: { number: 2, text: 'p' } });

const WRITE = decisionOf({
  decision: 'write',
  choice: CHOICE,
  entries: [
    entryOf('article', 'Fractional CAIO vs full-time CAIO cost?', POST),
    entryOf('term', 'What is a model card?', TERM),
  ],
  advisories: [MEASURED],
  refusals: [{ title: 'Fractional CAIO?', reason: 'slug-held', against: 'claims/x.json', detail: 'held' }],
  concepts: { named: [{ query: 'what is a data contract', title: 'What is a data contract?', why: 'cap' }] },
  proposals: [{ query: 'how to audit an ai vendor', impressions: 4, position: 20, page: '/' }],
  trail: [{ outcome: 'title-too-long' }, { outcome: 'chosen' }, { outcome: 'cap' }],
});
const STRENGTHEN = decisionOf({
  decision: 'strengthen',
  choice: 'Choice: strengthen /services/fractional-caio',
  strengthen: MEASURED,
  advisories: [{ ...MEASURED, query: 'ai governance', impressions: 3, position: null }],
  trail: [{ outcome: 'register-owner' }],
});
const NONE = decisionOf({ decision: 'none', reason: 'No candidate: 45 examined', trail: [{ outcome: 'retired' }] });

function fakeRun({ runId, now }) {
  const claim = (slug, format, demand) =>
    newClaim({ slug, title: slug, format, query: 'q', demand, prompt: { number: 2, text: 'p' }, runId, now });
  const entries = [
    claim(POST, 'article', { impressions: 0, position: null }),
    claim(TERM, 'term', { impressions: 14, position: 11.2 }),
  ].map((entryClaim) => ({
    claimPath: recordPath('claim', entryClaim.slug, entryClaim.claimedAt),
    claim: entryClaim,
    row: {},
    table: 'Queries',
    choice: CHOICE,
  }));
  const ledgerPath = recordPath('ledger', POST, entries[0].claim.claimedAt);
  return {
    ledgerPath,
    ledger: newLedger({ slug: POST, runId, pullRequest: null }),
    claims: entries.map(({ claimPath, claim: entryClaim }) => ({ claimPath, claim: entryClaim })),
    file: { schema: 1, decision: 'write', ledgerPath, entries, report: { path: REPORT }, refusals: [] },
  };
}

const claimNamed = (slug) => ({ ...fakeRun({ runId: 'r-0', now: NOW }).claims[0].claim, slug, title: slug });

async function scenario(decision, options, body) {
  await inRepo(async (root) => {
    const seen = { inputs: null, builds: [], out: [], err: [] };
    const run = (argv) =>
      runCli(argv, {
        repoRoot: root,
        env: options.env ?? {},
        now: options.now ?? (() => NOW),
        stdout: (line) => seen.out.push(line),
        stderr: (line) => seen.err.push(line),
        select: (inputs) => Object.assign(seen, { inputs }) && decision,
        build: (args) => seen.builds.push(args) && fakeRun(args),
      });
    await body({ root, run, seen, output: join(root, 'out', 'decision.json'), message: () => seen.err.join('\n') });
  });
}

test('previewing prints the decision and writes nothing anywhere, not even the decision file', async () => {
  for (const decision of [WRITE, STRENGTHEN, NONE]) {
    await scenario(decision, {}, async ({ root, run, seen, output }) => {
      const before = snapshot(root);
      assert.equal(await run(['--output', output]), 0);
      assert.deepEqual(seen.out, printedLines(decision));
      assert.equal(seen.builds.length, 0);
      assert.deepEqual(snapshot(root), before);
    });
  }
});

test('--write of a write decision writes the claims, the ledger and the decision file at the paths of the run', async () => {
  await scenario(WRITE, {}, async ({ root, run, seen, output, message }) => {
    assert.equal(await run(['--write', '--output', output, '--run-id', 'r-1']), 0, message());
    assert.equal(seen.builds[0].runId, 'r-1');
    const built = fakeRun({ runId: 'r-1', now: NOW });
    assert.deepEqual(JSON.parse(readFileSync(output, 'utf8')), JSON.parse(JSON.stringify(built.file)));
    for (const { claimPath, claim } of built.claims) assert.deepEqual(readClaim(join(root, claimPath)), claim);
    assert.deepEqual(readLedger(join(root, built.ledgerPath)), built.ledger);
    const claimPaths = [recordPath('claim', POST, NOW), recordPath('claim', TERM, NOW)];
    assert.deepEqual(filesIn(root, recordDirectory('claim')), claimPaths);
    assert.deepEqual(filesIn(root, recordDirectory('ledger')), [recordPath('ledger', POST, NOW), ...claimPaths]);
  });
});

test('--write of a strengthen or none decision writes the small decision file and no claim or ledger', async () => {
  const small = [
    [STRENGTHEN, { choice: STRENGTHEN.choice, advisories: [STRENGTHEN.strengthen, ...STRENGTHEN.advisories] }],
    [NONE, { reason: NONE.reason, advisories: [] }],
  ];
  for (const [decision, expected] of small) {
    await scenario(decision, {}, async ({ root, run, seen, output, message }) => {
      assert.equal(await run(['--write', '--output', output]), 0, message());
      const file = JSON.parse(readFileSync(output, 'utf8'));
      assert.deepEqual(file, { schema: 1, decision: decision.decision, ...expected });
      assert.equal(existsSync(join(root, recordDirectory('ledger'))), false);
      assert.equal(seen.builds.length, 0);
    });
  }
});

test('--write without --output exits 2 naming --output and writes nothing', async () => {
  await scenario(WRITE, {}, async ({ root, run, message }) => {
    const before = snapshot(root);
    assert.equal(await run(['--write']), 2);
    assert.match(message(), /--output/);
    assert.deepEqual(snapshot(root), before);
  });
});

test('an unknown flag, a flag without its value and a bad --now exit 2 and name the flag', async () => {
  const cases = [
    ['--force'],
    ['--run-id'],
    ['--summary', '--write'],
    ['--output'],
    ['--now'],
    ['--now', 'yesterday'],
    ['--order-prompt'],
    ['--order-title'],
    ['--order-prompt', '--write'],
    ['--order-title', '--write'],
  ];
  for (const argv of cases) {
    await scenario(NONE, {}, async ({ run, seen, message }) => {
      assert.equal(await run(argv), 2, argv.join(' '));
      assert.ok(message().includes(argv[0]), argv.join(' '));
      assert.deepEqual(seen.out, [], argv.join(' '));
    });
  }
});

test('--order-prompt and --order-title hand the selection an order, and no order flag hands it none', async () => {
  const cases = [
    [[], null],
    [['--order-prompt', '30'], { kind: 'prompt', number: 30 }],
    [['--order-prompt', '31'], { kind: 'prompt', number: 31 }],
    [
      ['--order-title', 'Why AI steering committees stall'],
      { kind: 'title', text: 'Why AI steering committees stall' },
    ],
    [
      ['--order-title', '  Why   AI\nsteering committees  stall '],
      { kind: 'title', text: 'Why AI steering committees stall' },
    ],
  ];
  for (const [argv, order] of cases) {
    await scenario(NONE, {}, async ({ run, seen, message }) => {
      assert.equal(await run(argv), 0, message());
      assert.deepEqual(seen.inputs.order, order, argv.join(' '));
    });
  }
});

test('--order-prompt and --order-title together exit 2 naming both flags, before any input is read, in either order', async () => {
  const cases = [
    ['--order-prompt', '3', '--order-title', 'x'],
    ['--order-title', 'x', '--order-prompt', '3'],
  ];
  for (const argv of cases) {
    await scenario(NONE, {}, async ({ root, run, seen, message }) => {
      rmSync(join(root, REPORT));
      assert.equal(await run(argv), 2, argv.join(' '));
      assert.match(message(), /--order-prompt/);
      assert.match(message(), /--order-title/);
      assert.equal(seen.inputs, null);
      assert.deepEqual(seen.out, []);
    });
  }
});

test('--order-prompt with anything but a positive whole number exits 2 naming the flag and the value', async () => {
  const values = ['0', '-1', '3.5', 'three', '', ' 3', '03', '+3', '1e1', '0x10', '99999999999999999999'];
  for (const value of values) {
    await scenario(NONE, {}, async ({ root, run, seen, message }) => {
      rmSync(join(root, REPORT));
      assert.equal(await run(['--order-prompt', value]), 2, value);
      assert.ok(message().includes('--order-prompt'), value);
      assert.ok(message().includes(JSON.stringify(value)), value);
      assert.equal(seen.inputs, null, value);
    });
  }
});

test('--order-title with nothing in it but white space exits 2 naming the flag', async () => {
  for (const value of ['', ' ', '\n\t ']) {
    await scenario(NONE, {}, async ({ root, run, seen, message }) => {
      rmSync(join(root, REPORT));
      assert.equal(await run(['--order-title', value]), 2, JSON.stringify(value));
      assert.ok(message().includes('--order-title'), JSON.stringify(value));
      assert.equal(seen.inputs, null);
    });
  }
});

test('an unreadable report, semantic core or config exits 1 naming the file', async () => {
  for (const path of ['audits/search-demand.md', 'docs/SEMANTIC-CORE.md', 'site/src/config.yaml']) {
    await scenario(NONE, {}, async ({ root, run, message }) => {
      rmSync(join(root, path));
      assert.equal(await run([]), 1, path);
      assert.ok(message().includes(path), path);
    });
  }
});

test('a decision file that cannot be written exits 1 naming it', async () => {
  await scenario(STRENGTHEN, {}, async ({ root, run, message }) => {
    writeFileSync(join(root, 'in-the-way'), 'a file, not a directory');
    const output = join(root, 'in-the-way', 'decision.json');
    assert.equal(await run(['--write', '--output', output]), 1);
    assert.ok(message().includes(output));
  });
});

test('invalid settings exit 2 naming each variable before any input is read', async () => {
  const env = { WRITING_TERM_CAP: 'many', WRITING_TERM_ARM: 'maybe' };
  await scenario(NONE, { env }, async ({ root, run, message }) => {
    rmSync(join(root, 'audits', 'search-demand.md'));
    assert.equal(await run([]), 2);
    assert.match(message(), /WRITING_TERM_CAP/);
    assert.match(message(), /WRITING_TERM_ARM/);
  });
});

test('the selection receives every input, the settings and the instant', async () => {
  const env = { WRITING_TERM_ARM: 'off', WRITING_TERM_CAP: '3' };
  await scenario(NONE, { env }, async ({ root, run, seen, message }) => {
    const held = fakeRun({ runId: 'r-0', now: NOW }).claims[1];
    writeClaim(join(root, held.claimPath), held.claim);
    const older = recordPath('ledger', 'older-post', NOW);
    for (const path of [older, flatPath('ledger', 'sentence-band'), `${recordDirectory('ledger')}/notes.txt`])
      put(root, path, '{}');
    assert.equal(await run([]), 0, message());
    const { inputs } = seen;
    assert.deepEqual(Object.keys(inputs).sort(), INPUT_KEYS);
    assert.deepEqual(inputs.ledgerPaths, [older]);
    assert.deepEqual(inputs.claims, [{ path: held.claimPath, claim: held.claim }]);
    assert.equal(inputs.suffix, ' — meshin.co');
    assert.deepEqual(inputs.settings, { termArm: false, termCap: 3 });
    assert.equal(inputs.now.toISOString(), NOW.toISOString());
    assert.equal(inputs.report.measured, '2026-11-01');
    assert.deepEqual(inputs.keywords.candidates, []);
    assert.ok(inputs.concepts.length > 0 && inputs.generated.length > 0 && inputs.promptSources.size > 0);
  });
});

test('the selection receives every ledger and every claim, filed flat, in a month or below it, and no other record', async () => {
  const ledgers = [
    flatPath('ledger', 'flat-post'),
    recordPath('ledger', 'month-post', NOW),
    belowMonth(recordPath('ledger', 'deeper-post', NOW)),
  ];
  const claims = [
    flatPath('claim', 'flat-claim'),
    recordPath('claim', 'month-claim', NOW),
    belowMonth(recordPath('claim', 'deeper-claim', NOW)),
  ];
  const others = [BAND_FILE, flatPath('ledger', 'sentence-band'), recordPath('generation', 'month-post', NOW)];
  await scenario(NONE, {}, async ({ root, run, seen, message }) => {
    for (const path of [...ledgers, ...others]) put(root, path, '{}');
    for (const path of claims) writeClaim(join(root, path), claimNamed(basename(path, '.json')));
    assert.equal(await run([]), 0, message());
    const { ledgerPaths, claims: held } = seen.inputs;
    assert.equal(ledgerPaths.length, 3);
    assert.deepEqual(ledgerPaths, [...ledgers].sort());
    assert.equal(held.length, 3);
    assert.deepEqual(
      held.map(({ path }) => path),
      [...claims].sort()
    );
  });
});

test('--now sets the instant the selection and the run use', async () => {
  await scenario(WRITE, { now: () => new Date('2030-01-01T00:00:00Z') }, async ({ run, seen, output, message }) => {
    assert.equal(await run(['--write', '--output', output, '--now', '2026-11-02T04:00:00Z']), 0, message());
    assert.equal(seen.inputs.now.toISOString(), NOW.toISOString());
    const [request] = seen.builds;
    assert.equal(request.now.toISOString(), NOW.toISOString());
    assert.equal(request.reportPath, REPORT);
    assert.equal(request.decision, WRITE);
    assert.equal(request.report.measured, '2026-11-01');
  });
});

test('the run id is --run-id, else the GitHub run and attempt, else local- plus the compact UTC time', () => {
  const github = { GITHUB_RUN_ID: '9', GITHUB_RUN_ATTEMPT: '2' };
  assert.equal(runIdFor({ runId: 'mine', env: github, now: NOW }), 'mine');
  assert.equal(runIdFor({ runId: null, env: github, now: NOW }), '9-2');
  for (const env of [{ GITHUB_RUN_ID: '9' }, { GITHUB_RUN_ATTEMPT: '2' }, {}]) {
    assert.equal(runIdFor({ runId: null, env, now: new Date('2026-11-02T04:00:00.987Z') }), 'local-20261102T040000Z');
  }
});

test('the printed lines are the primary line, then entries, advisories, named concepts, proposals and the tally', () => {
  assert.deepEqual(printedLines(WRITE), [
    CHOICE,
    'article: Fractional CAIO vs full-time CAIO cost?, /blog/fractional-caio-vs-full-time-caio-cost, prompt 2',
    'term: What is a model card?, /glossary/what-is-a-model-card, prompt 2',
    STRENGTHEN_LINE,
    'Missing concept left unwritten (cap): What is a data contract?',
    'Proposal for the owner to adopt as a buyer prompt: "how to audit an ai vendor"',
    'Examined 3 candidates, set aside 2.',
  ]);
  assert.deepEqual(printedLines(STRENGTHEN), [
    STRENGTHEN.choice,
    STRENGTHEN_LINE,
    'Strengthen: /services/fractional-caio, "ai governance", 3 impressions at position n/a: it ranks at position 14.5',
    'Examined 1 candidate, set aside 1.',
  ]);
  assert.deepEqual(printedLines(NONE), [NONE.reason, 'Examined 1 candidate, set aside 1.']);
});

test('the summary is Markdown with a heading, the primary line and one list per kind', () => {
  const markdown = summaryMarkdown(WRITE);
  assert.match(markdown, /^## Topic selection\n\n/);
  assert.ok(markdown.includes('\n\n' + CHOICE + '\n\n'));
  assert.ok(markdown.includes('- article: Fractional CAIO vs full-time CAIO cost?'));
  assert.ok(markdown.includes('- ' + STRENGTHEN_LINE));
  assert.ok(markdown.includes('- Missing concept left unwritten (cap): What is a data contract?'));
  assert.ok(markdown.includes('- Proposal for the owner to adopt as a buyer prompt: "how to audit an ai vendor"'));
  assert.ok(markdown.endsWith('Examined 3 candidates, set aside 2.\n'));
  assert.equal(summaryMarkdown(NONE).includes('###'), false);
});

test('--summary appends to the file and never overwrites what is there', async () => {
  for (const decision of [NONE, STRENGTHEN]) {
    await scenario(decision, {}, async ({ root, run, message }) => {
      const path = join(root, 'step-summary.md');
      writeFileSync(path, '# Earlier step\n');
      assert.equal(await run(['--summary', path]), 0, message());
      assert.equal(await run(['--summary', path]), 0, message());
      const text = readFileSync(path, 'utf8');
      assert.ok(text.startsWith('# Earlier step\n## Topic selection'));
      assert.equal(text.split('## Topic selection').length - 1, 2);
      assert.ok(text.includes(decision.reason ?? decision.choice));
    });
  }
});

test('end to end, the frozen report and the live semantic core give a decision that obeys the invariants', async () => {
  await inRepo(async (root) => {
    const before = snapshot(root);
    const out = [];
    const err = [];
    const io = { repoRoot: root, env: {}, stdout: (line) => out.push(line), stderr: (line) => err.push(line) };
    assert.equal(await runCli(['--now', '2026-11-02T04:00:00Z'], io), 0, err.join('\n'));
    assert.deepEqual(err, []);
    assert.match(out[0], /^(Choice:|No candidate|Strengthen:)/);
    assert.match(out.at(-1), /^Examined \d+ candidates?, set aside \d+\.$/);
    assert.deepEqual(snapshot(root), before);
  });
});

test('an ordered entry is printed after its choice line with the prompt it serves, or with the word ordered when it has none', () => {
  const entry = (extra) => ({ format: 'article', topic: { title: 'T', slug: 't' }, origin: 'ordered', ...extra });
  const written = (choice, entries) =>
    decisionOf({ decision: 'write', choice, entries, trail: [{ outcome: 'chosen' }] });
  const byPrompt = written('Choice: ordered, prompt 30, requested by hand', [
    entry({ prompt: { number: 30, text: 'p' } }),
  ]);
  const byTitle = written('Choice: ordered, "T", requested by hand', [entry({})]);
  const tally = 'Examined 1 candidate, set aside 0.';
  assert.deepEqual(printedLines(byPrompt), [byPrompt.choice, 'article: T, /blog/t, prompt 30', tally]);
  assert.deepEqual(printedLines(byTitle), [byTitle.choice, 'article: T, /blog/t, ordered', tally]);
});
