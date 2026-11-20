import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { validateLedger, verdictInForce } from './autowriter-ledger.mjs';
import { describeProblem } from './autowriter-records.mjs';
import { classifyAfterRepair } from './pr-classify.mjs';
import { RESUME_CAP, resumeDecision } from './pr-resume.mjs';
import { parseArguments } from './pr-watch-arguments.mjs';
import { repairFinding } from './pr-watch-repair.mjs';
import { runCli } from './repair-entry.mjs';
import { readFindings } from './repair-findings.mjs';
import { readJudgedFacts } from './repair-judged-run.mjs';
import { RepairStop } from './repair-outcome.mjs';
import { repairRun } from './repair-run.mjs';
import { MAIN_SHA, OWN_COMMITS, capture, withLastEscalation, withResumes } from './fixtures/resume-world.mjs';

const GIVEN_UP = capture('repair-found-no-findings');
const SPECIMEN = GIVEN_UP.ledger;
const FILED = SPECIMEN.escalations.at(-1);
const PRINTED = JSON.parse(GIVEN_UP.repairOutput);
const JUDGED = JSON.parse(readFileSync(new URL('./fixtures/repair-why/judged-run.json', import.meta.url), 'utf8'));
const TODAY = new Date('2026-11-20T17:00:00.000Z');
const RUN = { id: JUDGED.run.id, attempt: JUDGED.run.attempt };
const MEASURED_MAIN = 'd84805bc7ba18bc22bb17a8e1ceab775ab18abaa';
const SLUG = SPECIMEN.slug;
const SUBJECT = `/blog/${SLUG}`;
const REFUSAL = {
  gate: 'gate:orphans',
  rule: 'chrome-only',
  reason: 'not-prose',
  subjects: [SUBJECT],
  why: 'A page reached only from listings needs a sentence on another page that links to it.',
};
const WHY = { stop: 'no-artifact', gate: 'gate:orphans', ciRun: RUN.id, measuredMain: MEASURED_MAIN };
const LINKS = {
  run: 'https://github.com/meshin-co/website/actions/runs/44672959432',
  pullRequest: 'https://github.com/meshin-co/website/pull/145',
};

const planted = (why) => withLastEscalation(SPECIMEN, why);
const left = (reason) => ({ resume: false, reason });
const decide = (input) =>
  resumeDecision({
    ledger: planted(WHY),
    commitsOnBranch: OWN_COMMITS,
    mainChanges: [],
    forced: false,
    now: TODAY,
    mainTip: MAIN_SHA,
    ...input,
  });

const judgedApi = {
  get: async (path) => {
    if (path.startsWith(`actions/runs/${RUN.id}/artifacts`)) return { total_count: 0, artifacts: [] };
    if (path.startsWith(`actions/runs/${RUN.id}/attempts/${RUN.attempt}/jobs`))
      return { total_count: JUDGED.jobs.length, jobs: JUDGED.jobs };
    if (path === `commits/${JUDGED.mergeCommit.sha}`)
      return { parents: JUDGED.mergeCommit.parents.map((sha) => ({ sha })) };
    throw new Error(`unexpected GET ${path}`);
  },
  bytes: async (path) => {
    if (path === `actions/jobs/${JUDGED.jobs[0].id}/logs`) return Buffer.from(JUDGED.changesLog.join('\n'));
    throw new Error(`unexpected bytes ${path}`);
  },
};

const environment = () => ({
  WRITING_PROVIDER: 'openai',
  OPENAI_WRITING_MODEL: 'gpt-6.1-terra',
  OPENAI_WRITING_INPUT_USD_PER_MILLION: '1',
  OPENAI_WRITING_OUTPUT_USD_PER_MILLION: '5',
  GITHUB_REPOSITORY: 'meshin-co/website',
  GITHUB_TOKEN: 'gh-token-value',
  AUTOWRITER_OPENAI_API_KEY: 'sk-test-' + randomBytes(18).toString('hex'),
});

async function printedBy(io) {
  const out = [];
  await runCli(['--pr', '145', '--head', 'a'.repeat(40)], {
    env: environment(),
    stdout: (line) => out.push(line),
    stderr: () => {},
    now: () => TODAY,
    repair: async ({ repoRoot, now, run, secrets }) =>
      repairRun({
        repoRoot,
        now,
        run,
        secrets,
        api: judgedApi,
        adapter: {},
        kinds: {},
        open: async () => ({
          run: RUN,
          slug: SLUG,
          claim: { format: 'article', claimedAt: '2026-11-19T09:00:00.000Z' },
          ledger: { ...SPECIMEN, attempts: [] },
          route: SUBJECT,
        }),
        findingsOf: readFindings,
        judgedFacts: (found) => readJudgedFacts({ api: judgedApi, run: found }),
        ...io,
      }),
  });
  return JSON.parse(out.at(-1));
}

test('the specimen is the real ledger of pull request 145, valid as it stands, and its escalation names only the outcome', () => {
  assert.deepEqual(validateLedger(SPECIMEN).map(describeProblem), []);
  assert.equal(PRINTED.outcome, 'unrepairable');
  assert.equal(PRINTED.stop, undefined);
  for (const field of ['stop', 'gate', 'rule', 'subject', 'ciRun', 'measuredMain'])
    assert.equal(FILED[field], undefined);
});

test('a repair that found no artifact prints the class of its stop, the run it judged and the main that run measured', async () => {
  const line = await printedBy({});

  assert.equal(line.outcome, 'unrepairable');
  assert.equal(line.stop, 'no-artifact');
  assert.equal(line.gate, 'gate:orphans');
  assert.equal(line.ciRun, RUN.id);
  assert.equal(line.measuredMain, MEASURED_MAIN);
  assert.equal(line.rule, undefined);
  assert.equal(line.subject, undefined);
});

test('a repair that refused names the gate, the rule and the subject of the finding it refused', async () => {
  const line = await printedBy({
    findingsOf: async () => [{ gate: 'gate:orphans', findings: [{ rule: 'chrome-only', subjects: [SUBJECT] }] }],
    kinds: { judgeFindings: () => ({ refused: [REFUSAL], rewrite: [] }) },
  });

  assert.deepEqual(
    {
      stop: line.stop,
      gate: line.gate,
      rule: line.rule,
      subject: line.subject,
      ciRun: line.ciRun,
      measuredMain: line.measuredMain,
    },
    {
      stop: 'refused',
      gate: 'gate:orphans',
      rule: 'chrome-only',
      subject: SUBJECT,
      ciRun: RUN.id,
      measuredMain: MEASURED_MAIN,
    }
  );
});

test('a stop that is never stale names the run it judged and reads nothing about it', async () => {
  const line = await printedBy({
    findingsOf: async () => {
      throw new RepairStop('unrepairable', 'the rewrite broke the build: x', { why: { stop: 'build-broke' } });
    },
    judgedFacts: async () => assert.fail('a stop that is never stale reads nothing about the run'),
  });

  assert.equal(line.stop, 'build-broke');
  assert.equal(line.ciRun, RUN.id);
  assert.equal(line.measuredMain, undefined);
});

test('the watcher takes the whole line the repair printed, keeps the fields it knows and refuses a bare word', () => {
  const line = JSON.stringify({ ...PRINTED, ...WHY, rule: 'chrome-only', subject: SUBJECT, extra: 'dropped' });
  const parsed = parseArguments(['--pr', '145', '--after-repair', line]);

  assert.equal(parsed.afterRepair, 'unrepairable');
  assert.deepEqual(parsed.report, { ...WHY, rule: 'chrome-only', subject: SUBJECT });
  assert.throws(() => parseArguments(['--pr', '145', '--after-repair', 'unrepairable']), /--after-repair/);
  const invented = JSON.stringify({ outcome: 'unrepairable', stop: 'invented' });
  assert.equal(parseArguments(['--pr', '145', '--after-repair', invented]).report.stop, undefined);
});

test('the finding the watcher files carries the fields, and the entry that holds them is a valid ledger beside the old one', () => {
  const report = { ...WHY, rule: 'chrome-only', subject: SUBJECT };
  const result = classifyAfterRepair({
    ...capture('escalated-pull-request'),
    ledger: null,
    outcome: 'unrepairable',
  });
  const finding = repairFinding({ result, number: 145, report }, LINKS);
  const { kind, title, detail, ...fields } = finding;

  assert.equal(kind, 'unrepairable');
  assert.match(title, /^Autowriter pull request #145: /);
  assert.deepEqual(fields, report);
  assert.match(detail, /^The repair of pull request #145 ended as unrepairable: /);
  assert.match(detail, /^Stop: no-artifact at gate:orphans \(chrome-only on \/blog\//m);
  assert.deepEqual(validateLedger(planted(fields)).map(describeProblem), []);
  assert.notEqual(validateLedger(planted({ ...WHY, stop: 'invented' })).length, 0);
});

test('main against measuredMain decides, never the clock: stale means a re-measure, and main where it was measured means a person', () => {
  assert.deepEqual(decide({}), { resume: false, remeasure: true });
  assert.deepEqual(decide({ mainTip: MEASURED_MAIN }), left('not-resumable-kind'));
  assert.deepEqual(decide({ ledger: planted({ ...WHY, stop: 'build-broke' }) }), left('not-resumable-kind'));
  assert.deepEqual(decide({ ledger: planted({ ...WHY, stop: 'scope' }) }), left('not-resumable-kind'));
  assert.deepEqual(decide({ ledger: planted({ ...WHY, measuredMain: undefined }) }), left('not-resumable-kind'));
  assert.deepEqual(decide({ ledger: planted({ ...WHY, gate: undefined }) }), left('not-resumable-kind'));
});

test('the re-measure has its own counter: one per pull request, named remeasures in the ledger, outside the resume cap', () => {
  const entry = {
    at: '2026-11-20T09:00:00.000Z',
    gate: 'gate:orphans',
    measuredMain: MEASURED_MAIN,
    mainSha: MAIN_SHA,
    result: 'reproduced',
  };
  const spent = { ...planted(WHY), remeasures: [entry] };

  assert.deepEqual(validateLedger(spent).map(describeProblem), []);
  assert.equal(RESUME_CAP, 2);
  assert.equal(spent.resumes.filter(({ by }) => by !== 'owner').length, RESUME_CAP);
  assert.deepEqual(decide({ ledger: spent }), left('remeasure-spent'));
  assert.equal(verdictInForce(spent), true);
  const cleared = { ...spent, remeasures: [{ ...entry, at: '2026-11-20T18:00:00.000Z', result: 'clear' }] };
  assert.equal(verdictInForce(cleared), false);
});

test('the owner asking again after the cap is spent is answered when the verdict is stale, and still refused when it is not', () => {
  assert.deepEqual(decide({ forced: true }), { resume: true, by: 'owner' });
  assert.deepEqual(decide({ forced: true, mainTip: MEASURED_MAIN }), left('cap-reached'));
  assert.deepEqual(decide({ forced: true, ledger: planted({ ...WHY, stop: 'scope' }) }), left('cap-reached'));
  assert.deepEqual(decide({ forced: true, ledger: SPECIMEN }), left('cap-reached'));
  assert.deepEqual(decide({ forced: true, ledger: withResumes(planted(WHY)) }), { resume: true, by: 'owner' });
});
