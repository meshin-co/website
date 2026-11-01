import assert from 'node:assert/strict';
import { test } from 'node:test';

import { wonClaims } from './search-demand-claims.mjs';
import { claimFindings, readsForClaims } from './search-demand-gate.mjs';

const PROMPTS = [
  {
    number: 7,
    prompt: 'AI acceptable use policy template',
    mustWin: '/blog/ai-acceptable-use-policy-for-a-50-person-company',
  },
  { number: 8, prompt: 'EU AI Act obligations for deployers small business', mustWin: '/glossary/eu-ai-act' },
];
const rowsOf = () => [
  { number: 7, prompt: PROMPTS[0].prompt, impressions: 0 },
  { number: 8, prompt: PROMPTS[1].prompt, impressions: 28 },
];
const doc = (path, text) => ({ path, text });

const only = (findings) => {
  assert.equal(findings.length, 1, JSON.stringify(findings));
  return findings[0];
};

const CLAIMS = [
  ['Prompt 7 is won.', [7]],
  ['prompt 7 is won', [7]],
  ['Prompt #7 is now won.', [7]],
  ['Prompt 7 is already won, see the report.', [7]],
  ['Prompt 7 was won on 2026-12-06.', [7]],
  ['Prompt 7 has been won.', [7]],
  ['Prompts 3, 7 and 12 are won.', [3, 7, 12]],
  ['Prompts 3, 7, and 12 are won.', [3, 7, 12]],
  ['Prompts 7 & 8 were won.', [7, 8]],
  ['Prompt 7: won on 2026-12-06.', [7]],
  ['Prompt 7 - won.', [7]],
  ['Prompt 7 (AI acceptable use policy template) is won.', [7]],
  ['Prompt 7 ("AI acceptable use policy template") is won.', [7]],
  ['- Prompt 7 is won.', [7]],
  ['1. Prompt 7 is won.', [7]],
  ['> Prompt 7 is won.', [7]],
  ['- [x] Prompt 7 is won.', [7]],
  ['## Prompt 7 is won', [7]],
  ['**Prompt 7** is won.', [7]],
  ['| 7 | Prompt 7 is won | x |', [7]],
  ['Prompt 7 is unproven. Prompt 8 is won.', [8]],
  ['Notes for December.\nPrompt 7 is won.', [7]],
  ['Prompt 7\nis won.', [7]],
  ['Prompts 1 to 5 are won.', [1, 2, 3, 4, 5]],
  ['Prompts 3-5 and 9 are won.', [3, 4, 5, 9]],
  ['Prompts 3\u20135 are won.', [3, 4, 5]],
  ['Prompts 5 to 3 are won.', [5, 3]],
  ['Prompt 7 is won by `/blog/ai-acceptable-use-policy-for-a-50-person-company`.', [7]],
  ['Prompt 7 is won by /blog/ai-acceptable-use-policy-for-a-50-person-company.', [7]],
  ['Prompt 7 is won by March.', [7]],
];

test('the closed claim shapes are read, whatever list, quote, table or emphasis marker leads them', () => {
  for (const [text, numbers] of CLAIMS)
    assert.deepEqual(
      wonClaims(text).flatMap((claim) => claim.numbers),
      numbers,
      text
    );
});

const NOT_CLAIMS = [
  'Prompt 7 is not won.',
  'Prompt 7 is not yet won.',
  'Prompt 7 will be won by March.',
  'Prompt 7 is not won by anyone.',
  'Prompt 7 must be won first.',
  'Until prompt 7 is won, nothing changes.',
  'We wait until\nprompt 7 is won, then write.',
  'If prompt 7 is won, write the second article.',
  "Prompt 7 won't be won this quarter.",
  'Prompt 7: won’t happen.',
  'Is prompt 7 won?',
  'The route that must win prompt 7 is /blog/x.',
  'Prompt 7 is unproven.',
  'Prompt 7 was closed 2026-10-02.',
  'Prompt 7 is the one to win.',
  'A prompt is won when the report records impressions for it.',
  'We won prompt 7.',
  'Prompts are won in search.',
];

test('a negated, conditional, future, questioned or unnumbered sentence is not a claim', () => {
  assert.equal(wonClaims('Prompt 9 is won.').length, 1);
  for (const text of NOT_CLAIMS) assert.deepEqual(wonClaims(text), [], text);
});

test('a claim inside a fenced block or an inline code span is an example, not a claim', () => {
  const text = [
    'Write `Prompt 7 is won.` only with evidence.',
    '',
    '```',
    'Prompt 7 is won.',
    '```',
    '',
    'Prompt 8 is won.',
  ].join('\n');
  assert.deepEqual(wonClaims(text), [{ line: 7, numbers: [8] }]);
});

test('a claim reports the line its sentence starts on, also when the sentence wraps', () => {
  assert.deepEqual(wonClaims('# Title\n\nPrompt 7\nis won.\n'), [{ line: 3, numbers: [7] }]);
});

test('a claim reports its own line inside a paragraph, not the line the paragraph starts on', () => {
  const paragraph = 'First line of notes.\nSecond line of notes.\nPrompt 7 is won.\nFourth line.\n';
  assert.deepEqual(wonClaims(paragraph), [{ line: 3, numbers: [7] }]);
  assert.deepEqual(wonClaims('Notes. Prompt 7\nis won.\n'), [{ line: 1, numbers: [7] }]);
  assert.deepEqual(wonClaims('- an item\n- Prompt 7 is won.\n'), [{ line: 2, numbers: [7] }]);
});

test('line numbers stay exact when a long paragraph carries the claim across its own line break', () => {
  const notes = Array.from({ length: 11 }, (_, index) => `Line ${index + 1} of notes.`);
  const paragraph = [...notes, 'Notes. Prompt 7', 'is won.'].join('\n');
  assert.deepEqual(wonClaims(paragraph), [{ line: 12, numbers: [7] }]);
});

test('a claim about a prompt the report records no impressions for names the document, its line, the prompt and the number', () => {
  const text = '# Plan\n\nPrompt 7 is won.\n';
  const finding = only(claimFindings([doc('docs/plan.md', text)], PROMPTS, rowsOf()));
  assert.equal(finding.rule, 'claim-outruns-data');
  assert.equal(finding.path, 'docs/plan.md');
  assert.equal(finding.line, 3);
  assert.match(finding.detail, /says prompt 7 is won, but audits\/search-demand\.md records 0 impressions for it/);
  assert.match(
    finding.detail,
    /"AI acceptable use policy template", must win \/blog\/ai-acceptable-use-policy-for-a-50-person-company/
  );
});

test('a claim about a prompt with impressions stays green, because impressions are necessary and never sufficient', () => {
  assert.deepEqual(claimFindings([doc('docs/plan.md', 'Prompt 8 is won.')], PROMPTS, rowsOf()), []);
});

test('only the unproven number of a combined claim is named', () => {
  const finding = only(claimFindings([doc('docs/plan.md', 'Prompts 8 and 7 are won.')], PROMPTS, rowsOf()));
  assert.match(finding.detail, /says prompt 7 is won/);
  assert.doesNotMatch(finding.detail, /prompt 8/);
});

test('the same claim in two documents is two findings, and repeated in one document it is named once', () => {
  const documents = [
    doc('docs/a.md', 'Prompt 7 is won.'),
    doc('docs/b.md', 'Prompt 7 is won.\n\nLater: prompt 7 was won on 2026-12-06.\n\nPrompt 7 is won again.'),
  ];
  assert.deepEqual(
    claimFindings(documents, PROMPTS, rowsOf()).map((finding) => finding.path),
    ['docs/a.md', 'docs/b.md']
  );
});

test('a claim naming a prompt the report has no row for says so', () => {
  const finding = only(claimFindings([doc('docs/plan.md', 'Prompt 99 is won.')], PROMPTS, rowsOf()));
  assert.match(finding.detail, /says prompt 99 is won, but audits\/search-demand\.md has no row for it/);
});

test('a claim is held to the row that matches the core, never to a row that only shares its number', () => {
  const stale = rowsOf().map((row) => (row.number === 8 ? { ...row, prompt: 'EU AI Act duties' } : row));
  const finding = only(claimFindings([doc('docs/plan.md', 'Prompt 8 is won.')], PROMPTS, stale));
  assert.match(finding.detail, /says prompt 8 is won, but audits\/search-demand\.md has no row for it/);
});

test('archived changes are history and are not read, while an open change is', () => {
  assert.equal(readsForClaims('openspec/changes/archive/2026-10-13-09-x/proposal.md', '# x'), false);
  assert.equal(readsForClaims('openspec/changes/19-write-to-demand/proposal.md', '# x'), true);
});

test('a dated record is not read, the index never is exempt, and the marker elsewhere exempts nothing', () => {
  const marked = '---\nrecord: true\n---\n\n# Record\n';
  assert.equal(readsForClaims('investigation/02-research.md', marked), false);
  assert.equal(readsForClaims('investigation/00-INDEX.md', marked), true);
  assert.equal(readsForClaims('docs/guide.md', marked), true);
  assert.equal(readsForClaims('investigation/03-unmarked.md', '# Not a record\n'), true);
});

test('the documents that instruct are read', () => {
  for (const path of [
    'AGENTS.md',
    'docs/SEMANTIC-CORE.md',
    'docs/plan/reference/locked-decisions.md',
    'site/.agents/skills/choose-the-next-article.md',
    'openspec/specs/discovery/search-demand/spec.md',
  ])
    assert.equal(readsForClaims(path, '# x'), true, path);
});
