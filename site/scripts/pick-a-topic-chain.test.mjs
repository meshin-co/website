import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

import { renderEntry } from './entry-files.mjs';
import { NOW, provenPrompt, queryRow, reportText, withPickRepo } from './fixtures/pick-scene.mjs';
import { RUN_DATE, cleanDraft } from './fixtures/writer-drafts.mjs';
import { makeRepo, removeRepo } from './fixtures/writer-repo.mjs';
import { ROUTES, adapterOn, completed, reply } from './fixtures/writer-vendors.mjs';
import { validateRecord } from './generation-record.mjs';
import { recordPath } from './record-layout.mjs';
import { generateRun } from './write-run.mjs';
import { readWriterConfig } from './writer-config.mjs';

const WEAK_QUERY = 'how to budget for an ai pilot';

function draftAnswering(query) {
  const draft = cleanDraft('article');
  draft.fields.fullAnswer = `${query}: ${draft.fields.fullAnswer}`;
  return JSON.stringify(draft);
}

const assembled = ({ entries }) => ({
  files: [
    ...entries.map(({ claim, draft }) => {
      const { path, text } = renderEntry({ claim, draft, runDate: RUN_DATE });
      return { path, text };
    }),
    { path: 'site/content-facts.json', text: '{}\n' },
    { path: 'docs/SEMANTIC-CORE.md', text: 'core\n' },
  ],
  gates: [
    { name: 'gate:registers', exit: 0 },
    { name: 'gate:content', exit: 0 },
  ],
});

test('a weak-demand pick runs through the writer, and the generation record it writes carries the origin and the weakness', async () => {
  const report = reportText({
    prompts: [provenPrompt(1, 'fractional CAIO pricing')],
    queries: [queryRow(WEAK_QUERY, 1, 52.5)],
  });
  await withPickRepo({ report }, async (picker) => {
    const picked = await picker.run(['--write', '--output', join(picker.root, 'out', 'decision.json')]);
    assert.equal(picked.exit, 0, picked.stderr.join('\n'));
    const decision = picker.json('out/decision.json');
    const [entry] = decision.entries;
    const writerRoot = makeRepo();
    try {
      for (const path of [entry.claimPath, decision.ledgerPath]) {
        mkdirSync(dirname(join(writerRoot, path)), { recursive: true });
        writeFileSync(join(writerRoot, path), picker.read(path));
      }
      const text = draftAnswering(WEAK_QUERY);
      const answer = () => reply(completed({ text, input: 1000, output: 100 }));
      const vendor = adapterOn({ routes: { [ROUTES.responses]: answer } });
      let committed = null;
      await generateRun({
        repoRoot: writerRoot,
        decision,
        config: readWriterConfig(vendor.env),
        now: () => NOW,
        fetch: vendor.fetch,
        run: () => {
          throw new Error('no process may run');
        },
        assemble: async (input) => assembled(input),
        commit: async (input) => {
          committed = input;
          return { commit: 'a'.repeat(40), branch: input.branch };
        },
        treeOf: async () => ({ parent: 'b'.repeat(40), fingerprint: 'c'.repeat(64) }),
      });
      const filed = recordPath('generation', entry.claim.slug, entry.claim.claimedAt);
      const record = JSON.parse(committed.files.find(({ path }) => path === filed).text);
      assert.deepEqual(validateRecord(record), []);
      assert.equal(record.claim.origin, 'weak-demand');
      assert.deepEqual(record.claim.weakness, entry.claim.weakness);
      assert.equal(Object.hasOwn(record.claim, 'prompt'), false);
      assert.equal(record.demand.row.Query, WEAK_QUERY);
    } finally {
      removeRepo(writerRoot);
    }
  });
});
