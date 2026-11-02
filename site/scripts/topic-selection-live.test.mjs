import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { brandFromDisk, titleSuffix } from '../src/utils/brand.mjs';
import { TITLE_ROOM_CHARS } from '../src/utils/faq-meta.mjs';
import { newClaim, readClaims } from './autowriter-claim-store.mjs';
import { generatedTitles, isHolding, validateClaim } from './autowriter-claims.mjs';
import { validateLedger } from './autowriter-ledger.mjs';
import { readDemandReport } from './demand-report.mjs';
import { recordFiles, slugOfRecord } from './record-layout.mjs';
import { casedForms, casingTexts } from './topic-casing.mjs';
import { readPromptSources } from './topic-core.mjs';
import { buildRun } from './topic-entries.mjs';
import { readConceptRegister, routeOf } from './topic-owners.mjs';
import { selectTopic } from './topic-selection.mjs';

const root = new URL('../../', import.meta.url);
const NOW = new Date('2026-11-02T07:00:00.000Z');
const REPORT_PATH = 'audits/search-demand.md';

const read = (path) => readFileSync(new URL(path, root), 'utf8');

function liveInputs() {
  const core = read('docs/SEMANTIC-CORE.md');
  return {
    report: readDemandReport(read(REPORT_PATH)),
    concepts: readConceptRegister(core),
    generated: generatedTitles(core),
    promptSources: readPromptSources(core),
    forms: casedForms(casingTexts(core)),
    claims: readClaims(fileURLToPath(root)),
    ledgerPaths: recordFiles(fileURLToPath(root), 'ledger'),
    suffix: titleSuffix(brandFromDisk(fileURLToPath(new URL('site/src/config.yaml', root)))),
    now: NOW,
    settings: { termArm: true, termCap: 1 },
  };
}

function assertEntryIsUsable(entry, { claims, ledgerPaths, generated, promptSources }) {
  const { topic, prompt, format, demand } = entry;
  const claim = newClaim({ ...topic, format, demand, prompt, runId: 'live', now: NOW });
  const heldSlugs = claims.filter((filed) => isHolding(filed.claim, NOW)).map((filed) => filed.claim.slug);
  const route = routeOf(format, topic.slug);
  assert.deepEqual(validateClaim(claim), [], topic.title);
  assert.ok(topic.title.length <= TITLE_ROOM_CHARS, topic.title);
  assert.notEqual(promptSources.get(prompt.number)?.retired, true, 'prompt ' + prompt.number + ' is retired');
  assert.equal(heldSlugs.includes(topic.slug), false, 'slug held by a claim: ' + topic.slug);
  assert.equal(ledgerPaths.map(slugOfRecord).includes(topic.slug), false, 'slug held by a ledger: ' + topic.slug);
  assert.equal(
    generated.some((row) => row.route === route),
    false,
    'route already published: ' + route
  );
}

test('on the committed report and core the selection obeys the invariants that do not depend on their content', () => {
  const inputs = liveInputs();
  const decision = selectTopic(inputs);

  assert.ok(['write', 'strengthen', 'none'].includes(decision.decision), decision.decision);
  assert.deepEqual(selectTopic(inputs), decision);
  if (decision.decision !== 'write') {
    assert.deepEqual(decision.entries, []);
    assert.ok(decision.decision === 'strengthen' ? decision.strengthen && decision.choice : decision.reason);
    return;
  }

  assert.equal(decision.entries[0].format, 'article');
  for (const entry of decision.entries) assertEntryIsUsable(entry, inputs);
  const slugs = decision.entries.map(({ topic }) => topic.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  const run = buildRun({ decision, report: inputs.report, runId: 'live', now: NOW, reportPath: REPORT_PATH });
  assert.deepEqual(validateLedger(run.ledger), []);
  assert.equal(run.file.entries[0].claim.format, 'article');
});
