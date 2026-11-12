import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { llmsSummaryGaps, manifestSchemaGaps } from './agent-interfaces-gate.mjs';
import { renderAiCatalog } from './gen-agent-catalog.mjs';
import {
  EXECUTORS,
  exitCodeFor,
  FAMILIES,
  label,
  manifestFamilies,
  proveCompliantTwins,
  provesOf,
  runSmoke,
  stalePending,
  tally,
  unprovenGates,
} from './mutation-smoke.mjs';
import { PENDING } from './mutation-pending.mjs';
import { SPECIMENS } from './mutation-specimens.mjs';

const packageScripts = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).scripts;

test('every gate:* script is proven by a family or named as pending with the change that owes it', () => {
  assert.deepEqual(unprovenGates(packageScripts, manifestFamilies(FAMILIES), PENDING), []);
});

test('a gate with no family and no pending entry is reported, and a pending one is not', () => {
  const scripts = { 'gate:a': 'x', 'gate:b': 'x', 'gate:c': 'x', build: 'x' };
  const families = [{ id: 'f', kind: 'pure', proves: 'gate:a' }];
  const pending = [{ gate: 'gate:c', change: '11-launch', reason: 'no baselines yet' }];
  assert.deepEqual(unprovenGates(scripts, families, pending), ['gate:b']);
});

test('a specimen family proves the gate its specimen runs, so the two cannot disagree', () => {
  const [family] = manifestFamilies([{ id: 'h', kind: 'specimen', specimen: 'html' }]);
  assert.equal(provesOf(family), SPECIMENS.html.gate);
  assert.deepEqual(unprovenGates({ 'gate:html': 'x' }, [family], []), []);
});

test('a family naming a specimen that does not exist fails at collection, never at run time', () => {
  assert.throws(() => manifestFamilies([{ id: 'x', kind: 'specimen', specimen: 'nope' }]), /unknown specimen nope/);
});

test('a pagination family naming a scope that does not exist fails at collection, never by quietly running the blog family', () => {
  const family = { id: 'x', kind: 'pagination', proves: 'build', fixture: 'live-post.md' };
  assert.throws(() => manifestFamilies([{ ...family, scope: 'tags' }]), /unknown scope tags/);
  assert.deepEqual(
    manifestFamilies([{ ...family, scope: 'tag' }]).map((entry) => entry.scope),
    ['tag']
  );
});

test('the free pass is gone: a family kind that runs nothing is rejected', () => {
  assert.throws(() => manifestFamilies([{ id: 'x', kind: 'unit-covered' }]), /unknown kind unit-covered/);
});

test('a lighthouse record family must say what it proves, and the kind is known at collection', () => {
  assert.throws(() => manifestFamilies([{ id: 'x', kind: 'lh-record' }]), /family x \(lh-record\) is missing proves/);
  assert.deepEqual(
    manifestFamilies([{ id: 'x', kind: 'lh-record', proves: 'lh:record' }]).map((family) => provesOf(family)),
    ['lh:record']
  );
});

test('a family that does not say which gate it proves is rejected, because the coverage check reads that field', () => {
  assert.throws(
    () => manifestFamilies([{ id: 'x', kind: 'gate', gate: 'budget', tokens: ['OVER BUDGET'] }]),
    /family x \(gate\) is missing proves/
  );
});

test('a pending entry for a gate that has a family is stale, because the debt is paid and the entry would excuse a later removal', () => {
  const scripts = { 'gate:a': 'x', 'gate:b': 'x' };
  const families = [{ id: 'f', kind: 'pure', proves: 'gate:a' }];
  const pending = [
    { gate: 'gate:a', change: '11-launch', reason: 'paid' },
    { gate: 'gate:b', change: '11-launch', reason: 'owed' },
  ];
  assert.deepEqual(stalePending(scripts, families, pending), ['gate:a']);
});

test('a pending entry for a gate that no script defines is stale', () => {
  assert.deepEqual(stalePending({ 'gate:a': 'x' }, [], [{ gate: 'gate:gone', change: '11-launch', reason: 'x' }]), [
    'gate:gone',
  ]);
});

test('the real pending list owes only gates that exist and still have no family', () => {
  assert.deepEqual(stalePending(packageScripts, manifestFamilies(FAMILIES), PENDING), []);
});

test('every family proves the build or a gate the package defines', () => {
  for (const family of manifestFamilies(FAMILIES)) {
    const proves = provesOf(family);
    assert.ok(
      proves === 'build' || proves in packageScripts,
      `${family.id} proves ${proves}, which is neither the build nor a script in package.json`
    );
  }
});

test('every specimen in the registry is run by a family, because an unreferenced specimen proves nothing', () => {
  const used = manifestFamilies(FAMILIES)
    .filter((family) => family.kind === 'specimen')
    .map((family) => family.specimen);
  assert.deepEqual(Object.keys(SPECIMENS).sort(), [...new Set(used)].sort());
});

const proven = (id) => ({ id, ok: true, reason: 'guard failed on the specimen' });

test('the tally counts families proven, never the synthetic baseline row', () => {
  const results = [
    { id: 'baseline-green-copy', ok: true, reason: 'pristine copy builds green' },
    proven('a'),
    proven('b'),
  ];
  assert.equal(tally(results, 2, 40), 'mutation smoke: 2/2 families proven in 40s');
});

test('a skipped family is never reported as proven, because --fast must not read as a full run', () => {
  const results = [
    { id: 'baseline-green-copy', ok: true, reason: 'pristine copy builds green' },
    proven('a'),
    { id: 'slow-one', skipped: true, reason: 'skipped: --fast' },
  ];
  assert.equal(tally(results, 2, 9), 'mutation smoke: 1/2 families proven, 1 skipped in 9s');
  assert.equal(label(results[2]), 'skip');
});

test('a failed family is named in the tally', () => {
  const results = [proven('a'), { id: 'b', ok: false, reason: 'guard stayed green on the specimen' }];
  assert.equal(tally(results, 2, 30), 'mutation smoke: 1/2 families proven, 1 FAILED in 30s');
  assert.equal(label(results[1]), 'FAIL');
});

test('a partial run exits with its own code, so a skipped family cannot read as a proven one', () => {
  const proven = [{ id: 'a', ok: true }];
  const skippedOne = [
    { id: 'a', ok: true },
    { id: 'b', ok: true, skipped: true },
  ];
  const failedOne = [{ id: 'a', ok: false, reason: 'stayed green' }];

  assert.equal(exitCodeFor(proven), 0);
  assert.equal(exitCodeFor(skippedOne), 2);
  assert.equal(exitCodeFor(failedOne), 1);
  assert.equal(exitCodeFor([...skippedOne, ...failedOne]), 1);
});

test('each refusal of an unattended process has its own family, and each family names a specimen that exists', () => {
  const rows = {
    'unattended-process-cannot-seal-dispositions': 'unattendedSealsDispositions',
    'unattended-process-cannot-write-the-lighthouse-record': 'unattendedWritesLighthouseRecord',
    'unattended-process-cannot-run-the-lighthouse-gate': 'unattendedRunsTheLighthouseGate',
  };
  const families = manifestFamilies(FAMILIES);
  for (const [id, specimen] of Object.entries(rows)) {
    const family = families.find((entry) => entry.id === id);
    assert.equal(family?.kind, 'specimen', id);
    assert.equal(family.specimen, specimen, id);
  }
});

test('each rule the autowriter gate holds on the workflows has its own family, whose specimen names the rule and ci.yml', () => {
  const rows = {
    'autowriter-push-made-with-the-default-token': ['autowriterPushWithDefaultToken', 'bot-push-token'],
    'autowriter-classifier-judges-the-last-push': ['autowriterClassifierJudgesLastPush', 'classifier-judges-last-push'],
  };
  const families = manifestFamilies(FAMILIES);
  for (const [id, [specimen, rule]] of Object.entries(rows)) {
    const family = families.find((entry) => entry.id === id);
    assert.equal(family?.kind, 'specimen', id);
    assert.equal(family.specimen, specimen, id);
    assert.equal(SPECIMENS[specimen].token, `${rule} .github/workflows/ci.yml`, id);
  }
});

test('each bound on a generated machine index has its own family, and the two determinism plants run test:llms', () => {
  const rows = {
    'machine-llms-shard-over-budget': 'machineLlmsShardOverBudget',
    'machine-llms-full-over-budget': 'machineLlmsFullOverBudget',
    'machine-llms-full-inlines-entries': 'machineLlmsFullInlinesEntries',
    'machine-llms-shard-omits-entry': 'machineLlmsShardOmitsEntry',
    'machine-llms-index-carries-entry': 'machineLlmsIndexCarriesEntry',
    'machine-llms-full-count-drifts': 'machineLlmsFullCountDrifts',
    'machine-feed-over-window': 'machineFeedOverWindow',
    'machine-feed-over-budget': 'machineFeedOverBudget',
    'llms-drops-the-id-tie-break': 'llmsDropsTheIdTieBreak',
    'llms-appends-a-timestamp': 'llmsAppendsATimestamp',
    'parity-entry-leaves-its-llms-shards': 'parityEntryLeavesItsLlmsShards',
  };
  const families = manifestFamilies(FAMILIES);
  for (const [id, specimen] of Object.entries(rows)) {
    const family = families.find((entry) => entry.id === id);
    assert.equal(family?.kind, 'specimen', id);
    assert.equal(family.specimen, specimen, id);
  }
  assert.equal(provesOf(families.find((entry) => entry.id === 'llms-drops-the-id-tie-break')), 'test:llms');
  assert.equal(provesOf(families.find((entry) => entry.id === 'llms-appends-a-timestamp')), 'test:llms');
});

const synthetic = (id, ok = true) => ({ id, ok, reason: ok ? 'green' : 'red' });
const BASELINE = 'baseline-green-copy';
const TWINS = 'compliant-twins-green';

test('a red baseline build fails the run although no family ran, because the pre-push hook reads only the exit code', () => {
  assert.equal(exitCodeFor([synthetic(BASELINE, false)]), 1);
});

test('compliant twins that do not build fail the run, and the families that did run are still counted', () => {
  const results = [synthetic(BASELINE), synthetic(TWINS, false), proven('a'), proven('b')];
  assert.equal(exitCodeFor(results), 1);
  assert.equal(tally(results, 2, 7), 'mutation smoke: 2/2 families proven, 1 FAILED in 7s');
});

test('a run whose two synthetic rows and every family are proven exits zero', () => {
  assert.equal(exitCodeFor([synthetic(BASELINE), synthetic(TWINS), proven('a')]), 0);
});

test('a skip beside two proven synthetic rows exits two, and a failed family still beats it', () => {
  const skipped = { id: 'slow-one', ok: true, skipped: true, reason: 'skipped: --fast' };
  assert.equal(exitCodeFor([synthetic(BASELINE), synthetic(TWINS), proven('a'), skipped]), 2);
  assert.equal(exitCodeFor([synthetic(BASELINE), synthetic(TWINS), skipped, { id: 'b', ok: false, reason: 'x' }]), 1);
});

test('a red baseline reads as no family proven and one failure, never as a clean run', () => {
  assert.equal(tally([synthetic(BASELINE, false)], 195, 3), 'mutation smoke: 0/195 families proven, 1 FAILED in 3s');
});

test('neither synthetic row is counted as a proven family', () => {
  const results = [synthetic(BASELINE), synthetic(TWINS), proven('a')];
  assert.equal(tally(results, 1, 5), 'mutation smoke: 1/1 families proven in 5s');
});

const refusal = { id: 'x', kind: 'build', proves: 'build', fixture: 'a.md', plant: 'src/data/faq', tokens: ['token'] };

test('a family of kind build or build-then-gate without a control is refused at collection, never trusted on the baseline alone', () => {
  const gated = { ...refusal, kind: 'build-then-gate', gate: 'content-gate' };
  for (const family of [refusal, gated]) {
    assert.throws(() => manifestFamilies([family]), new RegExp(`family x \\(${family.kind}\\) is missing control`));
    assert.throws(() => manifestFamilies([{ ...family, control: [] }]), /is missing control/);
    assert.throws(() => manifestFamilies([{ ...family, control: 'a-control.md' }]), /is missing control/);
    assert.throws(() => manifestFamilies([{ ...family, control: ['a-control.md', ''] }]), /is missing control/);
    assert.equal(manifestFamilies([{ ...family, control: ['a-control.md'] }]).length, 1);
  }
});

test('the fixture of a build family may be a list of files, and every file of it must be named', () => {
  const family = { ...refusal, control: ['a-control.md'] };
  assert.deepEqual(manifestFamilies([{ ...family, fixture: ['a.md', 'b.md'] }])[0].fixture, ['a.md', 'b.md']);
  assert.throws(() => manifestFamilies([{ ...family, fixture: [] }]), /is missing fixture/);
  assert.throws(() => manifestFamilies([{ ...family, fixture: ['a.md', ''] }]), /is missing fixture/);
});

test('the fixture of a pagination family stays one file, because its runner reads it as a name', () => {
  const family = { id: 'p', kind: 'pagination', proves: 'build', fixture: 'live-post.md' };
  assert.equal(manifestFamilies([family]).length, 1);
  assert.throws(
    () => manifestFamilies([{ ...family, fixture: ['live-post.md'] }]),
    /family p \(pagination\) is missing fixture/
  );
});

test('an empty token is refused, because every output contains it and the family would prove nothing', () => {
  const family = { id: 'x', kind: 'gate', proves: 'gate:external', gate: 'external', tokens: [''] };
  assert.throws(() => manifestFamilies([family]), /family x \(gate\) is missing tokens/);
});

const FIXTURES = new URL('../tests/guard-mutations/fixtures/', import.meta.url);
const named = (value) => [value ?? []].flat();

test('every fixture and control a family names is a file in the fixtures directory, and a control is never a violating fixture', () => {
  const families = manifestFamilies(FAMILIES);
  const violating = new Set(families.flatMap((family) => named(family.fixture)));
  for (const family of families) {
    for (const name of [...named(family.fixture), ...named(family.control)]) {
      assert.ok(
        existsSync(new URL(name, FIXTURES)),
        `${family.id} names ${name}, which is not in the fixtures directory`
      );
    }
    for (const name of named(family.control)) {
      assert.ok(!violating.has(name), `${family.id} names the violating fixture ${name} as its control`);
    }
  }
});

const MOST_LINES_REPAIRED = 2;
const linesOf = (name) => readFileSync(new URL(name, FIXTURES), 'utf8').split('\n');

function linesMissingFrom(lines, others) {
  const left = [...others];
  return lines.filter((line) => {
    const at = left.indexOf(line);
    if (at !== -1) left.splice(at, 1);
    return at === -1;
  });
}

test('every control is its fixture with at most two lines repaired, so a twin cannot drift into another document', () => {
  for (const family of manifestFamilies(FAMILIES).filter((entry) => entry.control)) {
    const fixtures = named(family.fixture);
    const controls = named(family.control);
    assert.equal(controls.length, fixtures.length, `${family.id} needs one control for each fixture`);
    fixtures.forEach((fixture, index) => {
      const [before, after] = [linesOf(fixture), linesOf(controls[index])];
      const repaired = Math.max(linesMissingFrom(before, after).length, linesMissingFrom(after, before).length);
      assert.ok(repaired <= MOST_LINES_REPAIRED, `${controls[index]} repairs ${repaired} lines of ${fixture}`);
    });
  }
});

const scratch = (t, prefix) => {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
};

const AGENT_ROWS = {
  'agents-llms-summary-without-an-h1': 'agentsLlmsWithoutAnH1',
  'agents-llms-summary-under-the-floor': 'agentsLlmsUnderTheFloor',
  'agents-llms-summary-with-only-a-bare-url': 'agentsLlmsWithOnlyABareUrl',
  'agents-catalog-fails-the-ard-validator': 'agentsCatalogFailsTheArdValidator',
};

test('each rule the llms summaries and the catalogue schema hold has a specimen family of its own', () => {
  const families = manifestFamilies(FAMILIES);
  for (const [id, specimen] of Object.entries(AGENT_ROWS)) {
    const family = families.find((entry) => entry.id === id);
    assert.equal(family?.kind, 'specimen', id);
    assert.equal(family.specimen, specimen, id);
    assert.equal(provesOf(family), 'gate:agents', id);
  }
});

test('each llms specimen plants one shard that the real guard refuses for its own rule alone, and the restorer removes it', async (t) => {
  const copySite = scratch(t, 'smoke-llms-specimen-');
  const directory = join(copySite, 'dist/llms');
  mkdirSync(directory, { recursive: true });
  for (const name of ['agentsLlmsWithoutAnH1', 'agentsLlmsUnderTheFloor', 'agentsLlmsWithOnlyABareUrl']) {
    const specimen = SPECIMENS[name];
    const restore = await specimen.plant(copySite);
    const [file, ...others] = readdirSync(directory);
    const gaps = llmsSummaryGaps(`llms/${file}`, readFileSync(join(directory, file), 'utf8'));
    assert.deepEqual(others, [], name);
    assert.equal(gaps.length, 1, `${name}: ${gaps.join(' | ')}`);
    assert.ok(gaps[0].includes(specimen.token), `${name}: ${gaps[0]}`);
    await restore();
    assert.deepEqual(readdirSync(directory), [], name);
  }
});

test('the under-the-floor specimen is long enough in bytes and short in characters, so only a guard that counts characters refuses it', async (t) => {
  const copySite = scratch(t, 'smoke-llms-floor-');
  mkdirSync(join(copySite, 'dist/llms'), { recursive: true });
  await SPECIMENS.agentsLlmsUnderTheFloor.plant(copySite);
  const text = readFileSync(join(copySite, 'dist/llms/zz-specimen-under-the-floor.txt'), 'utf8');
  assert.ok(Buffer.byteLength(text) >= 50, `${Buffer.byteLength(text)} bytes`);
  assert.ok(text.length < 50, `${text.length} characters`);
});

test('the catalogue specimen takes specVersion out of a catalogue the validator accepts, and the restorer puts it back', async (t) => {
  const copySite = scratch(t, 'smoke-catalogue-specimen-');
  const file = join(copySite, 'dist/.well-known/ai-catalog.json');
  mkdirSync(join(copySite, 'dist/.well-known'), { recursive: true });
  const entry = { path: '/llms.txt', namespace: 'docs', name: 'llms', displayName: 'llms.txt', type: 'text/plain' };
  const document = renderAiCatalog({
    origin: 'https://example.test',
    entries: [{ ...entry, description: 'A plain text summary of the site.' }],
  });
  const pristine = `${JSON.stringify(document, null, 2)}\n`;
  writeFileSync(file, pristine);
  assert.deepEqual(manifestSchemaGaps(pristine), []);
  const restore = await SPECIMENS.agentsCatalogFailsTheArdValidator.plant(copySite);
  const gaps = manifestSchemaGaps(readFileSync(file, 'utf8'));
  assert.ok(
    gaps.some((gap) => gap.includes(SPECIMENS.agentsCatalogFailsTheArdValidator.token)),
    gaps.join(' | ')
  );
  await restore();
  assert.equal(readFileSync(file, 'utf8'), pristine);
});

test('a gate a family names must be one its kind can run, so a removed or misfiled gate fails at collection', () => {
  const gateFamily = { id: 'x', kind: 'gate', proves: 'gate:agents', gate: 'agents-llms', tokens: ['t'] };
  assert.throws(() => manifestFamilies([gateFamily]), /family x has unknown gate agents-llms/);
  assert.throws(() => manifestFamilies([{ ...gateFamily, gate: 'content-gate' }]), /unknown gate content-gate/);
  assert.throws(
    () => manifestFamilies([{ ...refusal, kind: 'build-then-gate', gate: 'budget', control: ['c.md'] }]),
    /unknown gate budget/
  );
});

const familyOf = (id) => manifestFamilies(FAMILIES).find((entry) => entry.id === id);
const BASELINE_ROW = 'baseline-green-copy';
const TWINS_ROW = 'compliant-twins-green';
const COLLECTIONS = ['faq', 'post', 'resource', 'glossary', 'spec'];
const PRISTINE_PAGE = '<!doctype html><title>pristine</title>';

const PRELUDE = [
  "import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';",
  "const entries = existsSync('src/data')",
  "  ? readdirSync('src/data', { recursive: true }).filter((name) => name.endsWith('.md'))",
  '  : [];',
];
const RENDER_ENTRIES =
  "mkdirSync('dist', { recursive: true }); " +
  "writeFileSync('dist/page.txt', entries.map((name) => readFileSync('src/data/' + name, 'utf8')).join('\\n'));";
const VIOLATING_ENTRY = "entries.some((name) => !name.endsWith('-control.md'))";
const ANY_ENTRY = 'entries.length > 0';
const NOINDEX_LINK = "readFileSync(process.argv[2] + '/index.html', 'utf8').includes('noopener')";
const STALE_DIST = "existsSync(process.argv[2] + '/stale.html')";
const BANNED_WORD_IN_PAGE = "existsSync('dist/page.txt') && readFileSync('dist/page.txt', 'utf8').includes('leverage')";

const guardSource = ({ violating, mode, token }) =>
  [
    ...PRELUDE,
    `const violating = ${violating};`,
    `const mode = ${JSON.stringify(mode)};`,
    "const red = mode === 'always' || (mode !== 'dead' && violating);",
    `if (mode === 'token' || (red && mode !== 'wrong')) console.log(${JSON.stringify(token)});`,
    "if (red && mode === 'wrong') console.log('an unrelated failure');",
    RENDER_ENTRIES,
    'if (red) process.exitCode = 1;',
  ].join('\n');

const recordingSource = (log, token) =>
  [
    "import { appendFileSync, existsSync } from 'node:fs';",
    `const first = !existsSync(${JSON.stringify(log)});`,
    `appendFileSync(${JSON.stringify(log)}, JSON.stringify({ cwd: process.cwd(), args: process.argv.slice(2) }) + '\\n');`,
    `if (!first) { console.log(${JSON.stringify(token)}); process.exitCode = 1; }`,
  ].join('\n');

const IDLE_BUILD = guardSource({ violating: 'false', mode: 'dead', token: 'unused' });

function world(t, { build = IDLE_BUILD, scripts = () => ({}) } = {}) {
  const root = scratch(t, 'smoke-executor-');
  const copySite = join(root, 'site');
  const work = join(root, 'work');
  for (const directory of ['scripts', 'dist', ...COLLECTIONS.map((name) => `src/data/${name}`)]) {
    mkdirSync(join(copySite, directory), { recursive: true });
  }
  mkdirSync(join(work, 'pristine-dist'), { recursive: true });
  writeFileSync(join(copySite, 'package.json'), JSON.stringify({ scripts: { build: 'node stub-build.mjs' } }));
  writeFileSync(join(copySite, 'stub-build.mjs'), build);
  for (const [name, source] of Object.entries(scripts({ copySite, work }))) {
    writeFileSync(join(copySite, 'scripts', name), source);
  }
  for (const directory of [join(copySite, 'dist'), join(work, 'pristine-dist')]) {
    writeFileSync(join(directory, 'index.html'), PRISTINE_PAGE);
  }
  return { copySite, work };
}

const buildOf = (copySite) => {
  const built = spawnSync('npm', ['run', 'build'], { cwd: copySite, encoding: 'utf8' });
  return { code: built.status, output: `${built.stdout}${built.stderr}` };
};

const FAQ = 'faq-question-length';
const BANNED = 'content-banned-phrase';
const EXTERNAL = 'external-link-rel';

const buildWorld = (t, mode, violating = VIOLATING_ENTRY) =>
  world(t, { build: guardSource({ violating, mode, token: familyOf(FAQ).tokens[0] }) });

test('a build family is proven when the compliant build is green and the planted one is red naming its token', async (t) => {
  const { copySite, work } = buildWorld(t, 'correct');
  const verdict = await EXECUTORS.build(copySite, familyOf(FAQ), work, buildOf(copySite));
  assert.equal(verdict.ok, true, verdict.reason);
  assert.deepEqual(readdirSync(join(copySite, 'src/data/faq')), []);
});

test('a build family fails when the compliant build is red, because a build that refuses everything is no evidence', async (t) => {
  const { copySite, work } = buildWorld(t, 'always');
  const verdict = await EXECUTORS.build(copySite, familyOf(FAQ), work, buildOf(copySite));
  assert.equal(verdict.ok, false);
  assert.match(verdict.reason, /compliant/);
});

test('a build family fails when the compliant build already prints its token, because the token then proves nothing', async (t) => {
  const { copySite, work } = buildWorld(t, 'token');
  const verdict = await EXECUTORS.build(copySite, familyOf(FAQ), work, buildOf(copySite));
  assert.equal(verdict.ok, false);
  assert.match(verdict.reason, /compliant/);
});

test('a build family fails when the build stays green on the planted fixture, and the fixture is removed', async (t) => {
  const { copySite, work } = buildWorld(t, 'dead');
  const verdict = await EXECUTORS.build(copySite, familyOf(FAQ), work, buildOf(copySite));
  assert.equal(verdict.ok, false);
  assert.match(verdict.reason, /zero/);
  assert.deepEqual(readdirSync(join(copySite, 'src/data/faq')), []);
});

const gateWorld = (t, { gate, build = IDLE_BUILD }) =>
  world(t, {
    build,
    scripts: () => ({
      'content-gate.mjs': guardSource({
        violating: BANNED_WORD_IN_PAGE,
        mode: gate,
        token: familyOf(BANNED).tokens[0],
      }),
    }),
  });

test('a build-then-gate family is proven when its gate is green on the pristine dist and red naming its token on the planted build', async (t) => {
  const { copySite, work } = gateWorld(t, { gate: 'correct' });
  const verdict = await EXECUTORS['build-then-gate'](copySite, familyOf(BANNED), work);
  assert.equal(verdict.ok, true, verdict.reason);
  assert.deepEqual(readdirSync(join(copySite, 'src/data/post')), []);
});

test('a build-then-gate family fails when its gate is red on the pristine dist, because an always-red gate is no evidence', async (t) => {
  const { copySite, work } = gateWorld(t, { gate: 'always' });
  const verdict = await EXECUTORS['build-then-gate'](copySite, familyOf(BANNED), work);
  assert.equal(verdict.ok, false);
  assert.match(verdict.reason, /compliant/);
});

test('a build-then-gate family fails when its gate prints the token on the pristine dist', async (t) => {
  const { copySite, work } = gateWorld(t, { gate: 'token' });
  const verdict = await EXECUTORS['build-then-gate'](copySite, familyOf(BANNED), work);
  assert.equal(verdict.ok, false);
  assert.match(verdict.reason, /compliant/);
});

test('a build-then-gate family fails when its gate stays green on the planted build', async (t) => {
  const { copySite, work } = gateWorld(t, { gate: 'dead' });
  const verdict = await EXECUTORS['build-then-gate'](copySite, familyOf(BANNED), work);
  assert.equal(verdict.ok, false);
  assert.match(verdict.reason, /zero/);
  assert.deepEqual(readdirSync(join(copySite, 'src/data/post')), []);
});

test('a build-then-gate family fails, naming the build, when the planted fixture breaks the build before the gate runs', async (t) => {
  const { copySite, work } = gateWorld(t, {
    gate: 'correct',
    build: guardSource({ violating: VIOLATING_ENTRY, mode: 'correct', token: 'schema refusal' }),
  });
  const verdict = await EXECUTORS['build-then-gate'](copySite, familyOf(BANNED), work);
  assert.equal(verdict.ok, false);
  assert.match(verdict.reason, /build/);
  assert.deepEqual(readdirSync(join(copySite, 'src/data/post')), []);
});

const externalWorld = (t, mode, extra = {}) => {
  const token = familyOf(EXTERNAL).tokens[0];
  const violating = `${NOINDEX_LINK} || ${STALE_DIST}`;
  const scripts = () => ({ 'run-external-links.mjs': guardSource({ violating, mode, token }) });
  const made = world(t, { scripts });
  for (const [file, text] of Object.entries(extra)) writeFileSync(join(made.copySite, 'dist', file), text);
  return made;
};

test('a gate family is proven when the real command is green on the real dist and red naming its token on the scene', async (t) => {
  const { copySite, work } = externalWorld(t, 'correct');
  const verdict = await EXECUTORS.gate(copySite, familyOf(EXTERNAL), work);
  assert.equal(verdict.ok, true, verdict.reason);
});

test('a gate family fails when its gate is red on the real dist, because an always-red gate is no evidence', async (t) => {
  const { copySite, work } = externalWorld(t, 'always');
  const verdict = await EXECUTORS.gate(copySite, familyOf(EXTERNAL), work);
  assert.equal(verdict.ok, false);
  assert.match(verdict.reason, /compliant/);
});

test('a gate family fails when its gate prints the token on the real dist, because the token then proves nothing', async (t) => {
  const { copySite, work } = externalWorld(t, 'token');
  const verdict = await EXECUTORS.gate(copySite, familyOf(EXTERNAL), work);
  assert.equal(verdict.ok, false);
  assert.match(verdict.reason, /compliant/);
});

test('a gate family fails when its gate stays green on the scene, or goes red for another reason', async (t) => {
  for (const [mode, reason] of [
    ['dead', /zero/],
    ['wrong', /did not name/],
  ]) {
    const { copySite, work } = externalWorld(t, mode);
    const verdict = await EXECUTORS.gate(copySite, familyOf(EXTERNAL), work);
    assert.equal(verdict.ok, false, mode);
    assert.match(verdict.reason, reason, mode);
  }
});

test('a gate family restores the dist from the pristine snapshot before it runs the real command on it', async (t) => {
  const { copySite, work } = externalWorld(t, 'correct', { 'stale.html': '<p>left by an earlier family</p>' });
  const verdict = await EXECUTORS.gate(copySite, familyOf(EXTERNAL), work);
  assert.equal(verdict.ok, true, verdict.reason);
  assert.equal(existsSync(join(copySite, 'dist/stale.html')), false);
});

const REAL_COMMANDS = {
  'budget-page-cap': ['gate.mjs', ['dist', 'budgets.json']],
  'docs-dead-path': ['run-docs-gate.mjs', ['..']],
  'external-link-rel': ['run-external-links.mjs', ['dist']],
  'jsonld-fail-closed': ['jsonld-gate.mjs', ['dist']],
  'jsonld-property-completeness': ['jsonld-gate.mjs', ['dist']],
};

for (const [id, [script, real]] of Object.entries(REAL_COMMANDS)) {
  test(`${id} runs ${script} on the real input first and on a scene of its own second`, async (t) => {
    const family = familyOf(id);
    const { copySite, work } = world(t, {
      scripts: ({ work: workDirectory }) => ({
        [script]: recordingSource(join(workDirectory, 'calls.jsonl'), family.tokens[0]),
      }),
    });
    const verdict = await EXECUTORS.gate(copySite, family, work);
    const calls = readFileSync(join(work, 'calls.jsonl'), 'utf8').trim().split('\n');
    const [compliant, planted] = calls.map((line) => JSON.parse(line));
    assert.equal(verdict.ok, true, verdict.reason);
    assert.equal(calls.length, 2);
    assert.deepEqual(compliant.args, real);
    assert.equal(compliant.cwd, realpathSync(copySite));
    assert.notDeepEqual(planted.args, real);
    assert.ok(planted.args[0].startsWith(work), planted.args[0]);
  });
}

const twinFamilies = () => [familyOf(FAQ), familyOf(BANNED)];
const plantedFiles = (copySite) => ['faq', 'post'].flatMap((name) => readdirSync(join(copySite, 'src/data', name)));

test('the compliant twins of every family are planted together, built once, and removed with the dist restored', async (t) => {
  const { copySite, work } = buildWorld(t, 'correct');
  const verdict = await proveCompliantTwins(copySite, work, twinFamilies());
  assert.equal(verdict.id, TWINS_ROW);
  assert.equal(verdict.ok, true, verdict.reason);
  assert.deepEqual(plantedFiles(copySite), []);
  assert.equal(existsSync(join(copySite, 'dist/page.txt')), false);
});

test('twins that a refusal-of-everything build rejects fail the row, and nothing stays planted', async (t) => {
  const { copySite, work } = buildWorld(t, 'correct', ANY_ENTRY);
  const verdict = await proveCompliantTwins(copySite, work, twinFamilies());
  assert.equal(verdict.ok, false);
  assert.match(verdict.reason, /compliant/);
  assert.deepEqual(plantedFiles(copySite), []);
  assert.equal(existsSync(join(copySite, 'dist/page.txt')), false);
});

test('twins that build green while the output names a family token fail the row', async (t) => {
  const { copySite, work } = buildWorld(t, 'token');
  const verdict = await proveCompliantTwins(copySite, work, twinFamilies());
  assert.equal(verdict.ok, false);
  assert.match(verdict.reason, /compliant/);
});

test('a control that cannot be planted rejects the row and leaves no twin behind', async (t) => {
  const { copySite, work } = buildWorld(t, 'correct');
  const family = { ...familyOf(FAQ), control: [...familyOf(FAQ).control, 'no-such-twin.md'] };
  await assert.rejects(proveCompliantTwins(copySite, work, [family]), /no-such-twin/);
  assert.deepEqual(plantedFiles(copySite), []);
});

const rowsOf = (results) => results.map(({ id, ok, skipped }) => [id, skipped ? 'skipped' : ok]);

test('a run whose baseline build is red reports that one row, runs no family, and exits one', async (t) => {
  const { copySite, work } = buildWorld(t, 'always');
  const results = [];
  await runSmoke({ copySite, work, fast: false, families: [familyOf(FAQ)], results });
  assert.deepEqual(rowsOf(results), [[BASELINE_ROW, false]]);
  assert.equal(exitCodeFor(results), 1);
});

test('twins that do not build fail the run, while the family beside them is still run and reported', async (t) => {
  const { copySite, work } = buildWorld(t, 'correct', ANY_ENTRY);
  const results = [];
  await runSmoke({ copySite, work, fast: false, families: [familyOf(FAQ)], results });
  assert.deepEqual(rowsOf(results), [
    [BASELINE_ROW, true],
    [TWINS_ROW, false],
    [FAQ, true],
  ]);
  assert.equal(exitCodeFor(results), 1);
});

test('a run whose baseline, twins and family are all proven exits zero', async (t) => {
  const { copySite, work } = buildWorld(t, 'correct');
  const results = [];
  await runSmoke({ copySite, work, fast: false, families: [familyOf(FAQ)], results });
  assert.deepEqual(rowsOf(results), [
    [BASELINE_ROW, true],
    [TWINS_ROW, true],
    [FAQ, true],
  ]);
  assert.equal(exitCodeFor(results), 0);
});

test('a slow family is skipped under --fast, the twins still run, and the run exits two', async (t) => {
  const { copySite, work } = buildWorld(t, 'correct');
  const results = [];
  await runSmoke({ copySite, work, fast: true, families: [{ ...familyOf(FAQ), slow: true }], results });
  assert.deepEqual(rowsOf(results), [
    [BASELINE_ROW, true],
    [TWINS_ROW, true],
    [FAQ, 'skipped'],
  ]);
  assert.equal(exitCodeFor(results), 2);
});
