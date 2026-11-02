import assert from 'node:assert/strict';

import { ledgerWithAttempt, newLedger } from '../autowriter-ledger.mjs';
import { resolveClaimTable } from '../claim-sources.mjs';
import { buildRecord } from '../generation-record.mjs';
import { draftSentences } from '../writer-preflight.mjs';
import { recordInput } from './generation-input.mjs';
import { claimFor, cleanDraft } from './writer-drafts.mjs';
import { makeRepo, removeRepo } from './writer-repo.mjs';

export const HEAD = 'a'.repeat(40);
export const COMMIT = 'c'.repeat(40);
export const NOW = new Date('2026-11-02T08:00:00.000Z');
export const claim = claimFor('article');
export const before = cleanDraft('article');
export const ENTRY = 'site/src/data/post/' + claim.slug + '.md';
export const LEDGER = 'audits/autowriter/' + claim.slug + '.json';
export const RECORD = 'audits/autowriter/generations/' + claim.slug + '.json';
export const FAILURE = { rule: 'banned-phrase', path: ENTRY };
export const FINDING = {
  rule: FAILURE.rule,
  subjects: [FAILURE.path],
  detail: 'the entry says "leverage"',
  excerpt: 'we leverage the register',
};
export const DOCUMENTS = [{ gate: 'gate:content', findings: [FINDING] }];
export const GATES = ['gate:content', 'gate:human', 'gate:editorial', 'gate:registers', 'gate:machine'].map((name) => ({
  name,
  exit: 0,
}));
const PRICE = { inputPerMillion: 1, outputPerMillion: 5 };

const roots = [];
export const cleanup = () => roots.forEach(removeRepo);

const attemptOf = (failures) => ({
  judgedCommit: HEAD,
  recordedAt: '2026-11-02T07:00:00.000Z',
  failingRule: failures[0].rule,
  failingPath: failures[0].path,
  failures,
  tokens: { input: 10, output: 5 },
  costUsd: 0.1,
});
export const ledgerAfter = (...lists) =>
  lists.reduce(
    (ledger, failures) => ledgerWithAttempt(ledger, attemptOf(failures)),
    newLedger({ slug: claim.slug, runId: claim.runId, pullRequest: 7 })
  );

const recordOf = () =>
  buildRecord({
    ...recordInput(),
    claim,
    format: 'article',
    route: '/blog/' + claim.slug,
    entryPath: ENTRY,
    ledger: LEDGER,
    claimTable: resolveClaimTable(before),
    files: [ENTRY, RECORD, 'docs/SEMANTIC-CORE.md', 'site/content-facts.json'],
  });

const claimedSentences = () => new Set(before.claims.map(({ sentence }) => sentence));
const plainSentence = (wanted) =>
  draftSentences({ draft: before, claim }).find(
    (sentence) => !claimedSentences().has(sentence) && before.body.includes(sentence) && wanted(sentence)
  );

export function reworded() {
  const target = plainSentence((sentence) => sentence.includes(' the '));
  assert.ok(target, 'the fixture has a plain sentence to reword');
  const after = { ...structuredClone(before), body: before.body.replace(target, target.replace(' the ', ' this ')) };
  assert.notEqual(after.body, before.body);
  return after;
}

export function withoutASentence() {
  const target = plainSentence(() => true);
  assert.ok(target, 'the fixture has a plain sentence to drop');
  const after = { ...structuredClone(before), body: before.body.replace(target, '') };
  assert.notEqual(after.body, before.body);
  return after;
}

function adapterReturning(drafts) {
  const requests = [];
  const state = { verified: 0 };
  return {
    requests,
    state,
    id: 'openai',
    modelVariable: 'OPENAI_WRITING_MODEL',
    model: 'gpt-6.1-terra',
    verifyModel: async () => {
      state.verified += 1;
      return { id: 'gpt-6.1-terra', shutdownDate: null, note: null };
    },
    complete: async (request) => {
      requests.push(request);
      const json = drafts[Math.min(requests.length, drafts.length) - 1];
      return {
        json,
        text: JSON.stringify(json),
        responseId: 'resp_' + requests.length,
        resolvedModel: 'gpt-6.1-terra-2026-10-01',
        usage: { input: 1000, output: 500 },
        stopReason: 'completed',
        costUsd: 0.0035,
        price: PRICE,
        requestDigest: String(requests.length).padStart(64, '0'),
      };
    },
  };
}

const acceptEverything = {
  judgeFindings: ({ documents }) => ({
    rewrite: documents.flatMap(({ gate, findings }) => findings.map((finding) => ({ gate, ...finding }))),
    refused: [],
  }),
  allowancesOf: () => [],
};

export function world({
  ledger = ledgerAfter(),
  drafts = [reworded()],
  reached = false,
  kinds = acceptEverything,
  assemble,
} = {}) {
  const root = makeRepo();
  roots.push(root);
  const adapter = adapterReturning(drafts);
  const assembled = [];
  const committed = [];
  const counts = { ceiling: 0 };
  const io = {
    repoRoot: root,
    now: NOW,
    run: async () => ({ status: 0, stdout: '', stderr: '' }),
    api: {},
    adapter,
    secrets: [],
    open: async () => ({
      slug: claim.slug,
      branch: 'autowriter/' + claim.slug,
      run: { id: 99, attempt: 1 },
      claim,
      record: recordOf(),
      ledger,
      before,
      runDate: '2026-11-02',
      head: HEAD,
      route: '/blog/' + claim.slug,
    }),
    findingsOf: async () => DOCUMENTS,
    kinds,
    ceiling: () => {
      counts.ceiling += 1;
      return { reached, spentUsd: 50, ceilingUsd: 50 };
    },
    assemble:
      assemble ??
      (async (input) => {
        assembled.push(input);
        return {
          files: [
            { path: ENTRY, text: 'the entry as the build wrote it' },
            { path: 'docs/SEMANTIC-CORE.md', text: 'the semantic core' },
          ],
          gates: GATES,
        };
      }),
    commit: async (request) => {
      committed.push(request);
      return { commit: COMMIT };
    },
  };
  return { io, adapter, assembled, committed, counts };
}
