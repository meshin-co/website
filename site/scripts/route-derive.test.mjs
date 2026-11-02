import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { parse } from 'yaml';

import { applyDispositions, digestFor } from './dispositions.mjs';
import { termOf } from './entry-files.mjs';
import { recordPath } from './record-layout.mjs';
import { dispositionFor, targetQueryFor } from './route-derive.mjs';
import { WriterError } from './writer-error.mjs';
import { claimOf } from './fixtures/entry-drafts.mjs';

const SITE = fileURLToPath(new URL('..', import.meta.url));
const REPO = fileURLToPath(new URL('../..', import.meta.url));

const aim = (overrides) => targetQueryFor({ claim: { ...claimOf('term'), ...overrides } });
const CLAIMED = claimOf('term').claimedAt;
const rowFor = ({ slug = 'model-registry', ...overrides } = {}) =>
  dispositionFor({
    claimPath: recordPath('claim', slug, CLAIMED),
    generationPath: recordPath('generation', slug, CLAIMED),
    target: `src/data/glossary/${slug}.md`,
    digest: '0123456789ab',
    runDate: '2026-11-02',
    ...overrides,
  });

test('a term aims at its own name in lower case, whatever the query field says', () => {
  assert.equal(aim({ title: 'What is an AI register?', query: 'something else' }), 'ai register');
  assert.equal(aim({ title: 'What are guardrails?' }), 'guardrails');
  assert.equal(aim({ title: 'What is the EU AI Act?' }), 'eu ai act');
  assert.equal(aim({ title: 'What is ISO/IEC 42001?' }), 'iso/iec 42001');
});

test('an article aims at its query in lower case, whatever the title says', () => {
  const claim = { ...claimOf('article'), query: 'AI Incident Runbook' };

  assert.equal(targetQueryFor({ claim }), 'ai incident runbook');
});

test('no field of a draft is read, and none has to be given', () => {
  const draft = new Proxy({}, { get: () => assert.fail('the draft was read') });

  for (const format of ['term', 'article']) {
    const claim = claimOf(format);
    assert.equal(targetQueryFor({ claim, draft }), targetQueryFor({ claim }));
  }
});

test('a format the unattended writer does not write is refused', () => {
  assert.throws(
    () => aim({ format: 'faq-answer', title: 'Who signs it off?' }),
    (error) => error instanceof WriterError && error.kind === 'build' && error.message.includes('faq-answer')
  );
});

test('for the live terms whose title has the term shape, the row content-facts holds is the term in lower case', () => {
  const facts = JSON.parse(readFileSync(join(SITE, 'content-facts.json'), 'utf8')).targetQuery;
  const directory = join(REPO, 'site/src/data/glossary');
  const examples = readdirSync(directory)
    .map((file) => ({
      slug: file.replace(/\.md$/, ''),
      frontmatter: parse(/^---\n([\s\S]*?)\n---/.exec(readFileSync(join(directory, file), 'utf8'))[1]),
    }))
    .filter(({ frontmatter }) => {
      const named = /^What (?:is|are) /.test(frontmatter.title) ? termOf(frontmatter.title) : null;
      return named?.toLowerCase() === frontmatter.term.toLowerCase();
    });

  assert.ok(examples.length >= 15, `only ${examples.length} live terms follow the shape`);
  for (const { slug, frontmatter } of examples)
    assert.equal(
      facts[`/glossary/${slug}`],
      targetQueryFor({ claim: { format: 'term', title: frontmatter.title } }),
      slug
    );
});

test('the reason names the claim and the generation record at the paths it is given, month directory included', () => {
  const claimedAt = '2026-10-31T23:59:59.999Z';
  const { reason } = rowFor({
    claimPath: recordPath('claim', 'model-registry', claimedAt),
    generationPath: recordPath('generation', 'model-registry', claimedAt),
  });

  assert.ok(reason.includes('from the claim in audits/autowriter/claims/2026/10/model-registry.json on 2026-11-02.'));
  assert.ok(reason.endsWith('bound to a source in audits/autowriter/generations/2026/10/model-registry.json.'));
});

test('the disposition row names the target, the status, the digest and says plainly who wrote the text', () => {
  const row = rowFor();

  assert.deepEqual(Object.keys(row), ['target', 'status', 'reason', 'digest']);
  assert.equal(row.target, 'src/data/glossary/model-registry.md');
  assert.equal(row.status, 'rewritten');
  assert.equal(row.digest, '0123456789ab');
  assert.match(row.reason, /unattended writer/);
  assert.match(row.reason, /2026-11-02/);
  assert.match(row.reason, /No human has read/);
  assert.ok(row.reason.includes('audits/autowriter/claims/2026/11/model-registry.json'));
  assert.ok(row.reason.includes('audits/autowriter/generations/2026/11/model-registry.json'));
  assert.match(row.reason, /bound to a source/);
});

test('the reason is the same for every slug except for the slug and the date it names', () => {
  const reason = (slug, runDate) => rowFor({ slug, runDate }).reason;

  assert.equal(
    reason('one', '2026-11-02').replaceAll('one', 'SLUG').replaceAll('2026-11-02', 'DATE'),
    reason('two', '2026-12-31').replaceAll('two', 'SLUG').replaceAll('2026-12-31', 'DATE')
  );
});

test('the editorial ledger accepts the row for the text it was computed from and calls it stale for any other', () => {
  const target = 'src/data/glossary/model-registry.md';
  const rows = [
    {
      usedIn: [target],
      location: 'frontmatter.description',
      text: 'A model registry lists models.',
      status: 'unreviewed',
    },
  ];
  const fresh = rowFor({ target, digest: digestFor(rows, target) });
  const old = rowFor({ target, digest: '000000000000' });

  assert.deepEqual(applyDispositions(rows, [fresh]).stale, []);
  assert.equal(applyDispositions(rows, [fresh]).rows[0].status, 'rewritten');
  assert.equal(applyDispositions(rows, [old]).stale.length, 1);
});

test('the row has the keys and the order of the dispositions the repository already holds', () => {
  const directory = join(REPO, 'audits/phase-4.7/dispositions');
  const live = JSON.parse(
    readFileSync(
      join(
        directory,
        readdirSync(directory).find((name) => name === 'faq.json')
      ),
      'utf8'
    )
  );
  const row = rowFor({ slug: 'x', digest: 'a'.repeat(12) });

  assert.deepEqual(Object.keys(row), Object.keys(live[0]));
});
