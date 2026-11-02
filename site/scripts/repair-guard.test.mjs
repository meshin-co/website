import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { cleanDraft } from './fixtures/writer-drafts.mjs';
import { MAY, WORD_FLOOR, WORD_FLOOR_WHOLE_ENTRY, removalProblems } from './repair-guard.mjs';

const article = () => cleanDraft('article');
const term = () => cleanDraft('term');

const rulesOf = (problems) => [...new Set(problems.map(({ rule }) => rule))].sort();

function inBody(draft, from, to) {
  assert.ok(draft.body.includes(from), `the fixture no longer holds: ${from}`);
  return { ...draft, body: draft.body.replace(from, to) };
}

const withFields = (draft, fields) => ({ ...draft, fields: { ...draft.fields, ...fields } });

const TRIGGER_PARAGRAPH =
  'Write each trigger as a sentence with a clear yes or no answer. Vague triggers such as serious harm invite a debate while the system keeps running.';
const COMMON_SENTENCE =
  'Do not look for the cause in the first hour, because the cause comes after the system is safe.';
const BULLET = 'Tell the affected customer in plain words and say what you know so far.';
const REVIEW_SENTENCE = 'Review the plan each quarter and after every change to a system that it covers.';
const STANDARDS_SECTION = (draft) =>
  draft.body.slice(
    draft.body.indexOf('## What do the standards say?'),
    draft.body.indexOf('## How do you keep the plan current?')
  );

const synthetic = (sentences) => ({
  format: 'article',
  fields: { shortAnswer: sentences[0], fullAnswer: sentences[1], keyTakeaways: [], faq: [] },
  body: sentences.slice(2).join('\n\n'),
  sources: [],
  claims: [],
  passage: 'A fixed passage that no test edits.',
});

const tenSentences = (trim = () => 0) =>
  'abcdefghij'.split('').map((tag, index) => {
    const kept = 10 - trim(index);
    return `${Array.from({ length: kept }, (_, at) => `${tag}w${at + 1}x`).join(' ')}.`;
  });

test('the floors and the allowances are the numbers the report states', () => {
  assert.equal(WORD_FLOOR, 0.9);
  assert.equal(WORD_FLOOR_WHOLE_ENTRY, 0.75);
  assert.deepEqual(MAY, ['takeaways', 'faq', 'sources', 'claims', 'headings', 'words-down']);
});

test('an entry handed back unchanged has nothing removed', () => {
  assert.deepEqual(removalProblems({ before: article(), after: article() }), []);
  assert.deepEqual(removalProblems({ before: term(), after: term() }), []);
});

test('one sentence reworded to about its own length is a repair, not a removal', () => {
  const after = inBody(
    article(),
    'A trigger is a fact that someone can observe.',
    'A trigger is a fact that a person can observe.'
  );
  assert.deepEqual(removalProblems({ before: article(), after }), []);
});

test('a sentence split in two keeps all its words, so it passes', () => {
  const after = inBody(
    article(),
    REVIEW_SENTENCE,
    'Review the plan each quarter. Review it again after every change to a system that it covers.'
  );
  assert.deepEqual(removalProblems({ before: article(), after }), []);
});

test('two passages swapped are moved, not removed', () => {
  const draft = article();
  const first =
    'The plan has five parts, and each part answers one question, so keep each part to a short paragraph or a short list.';
  const second = 'A trigger is a fact that someone can observe. One example is a customer who reports a wrong answer.';
  const swapped = inBody(inBody(draft, first, '@@'), second, first).body.replace('@@', second);
  assert.notEqual(swapped, draft.body);
  assert.deepEqual(removalProblems({ before: draft, after: { ...draft, body: swapped } }), []);
});

test('deleting the paragraph the gate complained about is refused, though the gate would then pass', () => {
  const after = inBody(article(), `${TRIGGER_PARAGRAPH}\n\n`, '');
  const problems = removalProblems({ before: article(), after });
  assert.deepEqual(rulesOf(problems), ['text-removed']);
  assert.equal(problems.length, 2);
  assert.match(problems[0].detail, /Write each trigger as a sentence with a clear yes or no answer\./);
  assert.match(problems[0].detail, /a repair rewrites a sentence; it never deletes one/);
});

test('deleting a single sentence is refused, however small the cut', () => {
  const after = inBody(article(), `${COMMON_SENTENCE}\n\n`, '');
  const problems = removalProblems({ before: article(), after });
  assert.deepEqual(rulesOf(problems), ['text-removed']);
  assert.equal(problems.length, 1);
});

test('deleting a list item is refused', () => {
  const after = inBody(article(), `- ${BULLET}\n`, '');
  assert.deepEqual(rulesOf(removalProblems({ before: article(), after })), ['text-removed']);
});

test('cutting a sentence down to a few words is a deletion in all but name', () => {
  const after = inBody(article(), BULLET, 'Tell the customer.');
  assert.deepEqual(rulesOf(removalProblems({ before: article(), after })), ['text-removed']);
});

test('replacing a sentence with filler that says something else is refused too', () => {
  const after = inBody(article(), COMMON_SENTENCE, 'Further guidance is available on request from the team.');
  assert.deepEqual(rulesOf(removalProblems({ before: article(), after })), ['text-removed']);
});

test('deleting a heading with its whole section is refused, and says so for the heading and for the text', () => {
  const draft = article();
  const after = { ...draft, body: draft.body.replace(STANDARDS_SECTION(draft), '') };
  assert.notEqual(after.body, draft.body);
  assert.deepEqual(rulesOf(removalProblems({ before: draft, after })), ['heading-removed', 'text-removed']);
});

test('deleting only a heading line is refused, and merging sections needs the headings allowance', () => {
  const after = inBody(article(), '## What do the standards say?\n\n', '');
  assert.deepEqual(rulesOf(removalProblems({ before: article(), after })), ['heading-removed']);
  assert.deepEqual(removalProblems({ before: article(), after, may: ['headings'] }), []);
});

test('a heading added is not a removal', () => {
  const after = inBody(
    article(),
    '## How do you keep the plan current?',
    '## One more question\n\nThe plan names an owner for each step.\n\n## How do you keep the plan current?'
  );
  assert.deepEqual(removalProblems({ before: article(), after }), []);
});

test('deleting a FAQ item is refused unless the finding is about the FAQ, and then only the FAQ may shrink', () => {
  const draft = article();
  const after = withFields(draft, { faq: draft.fields.faq.slice(0, -1) });
  assert.deepEqual(rulesOf(removalProblems({ before: draft, after })), ['faq-removed', 'text-removed']);
  assert.deepEqual(removalProblems({ before: draft, after, may: ['faq'] }), []);
  const paragraphGone = inBody(after, `${COMMON_SENTENCE}\n\n`, '');
  assert.deepEqual(rulesOf(removalProblems({ before: draft, after: paragraphGone, may: ['faq'] })), ['text-removed']);
});

test('deleting a key takeaway is refused unless the finding is about the takeaways', () => {
  const draft = article();
  const after = withFields(draft, { keyTakeaways: draft.fields.keyTakeaways.slice(0, -1) });
  assert.ok(rulesOf(removalProblems({ before: draft, after })).includes('takeaway-removed'));
  assert.deepEqual(removalProblems({ before: draft, after, may: ['takeaways'] }), []);
});

test('dropping a source is refused, and so is dropping the claims that rested on it, unless both are allowed', () => {
  const draft = article();
  const owasp = 'https://owasp.org/www-project-top-10-for-large-language-model-applications/';
  const after = {
    ...draft,
    sources: draft.sources.filter(({ url }) => url !== owasp),
    claims: draft.claims.filter(({ sourceId }) => sourceId !== 'S4'),
  };
  assert.deepEqual(rulesOf(removalProblems({ before: draft, after })), ['claim-removed', 'source-removed']);
  assert.deepEqual(rulesOf(removalProblems({ before: draft, after, may: ['sources'] })), ['claim-removed']);
  assert.deepEqual(removalProblems({ before: draft, after, may: ['sources', 'claims'] }), []);
});

test('a source added is not a removal', () => {
  const draft = article();
  const extra = { id: 'S9', title: 'Another page', url: 'https://www.nist.gov/another', publisher: 'NIST' };
  assert.deepEqual(removalProblems({ before: draft, after: { ...draft, sources: [...draft.sources, extra] } }), []);
});

test('removing the claim row of a sentence that stays is refused unless the finding is about the claims', () => {
  const draft = article();
  const after = { ...draft, claims: draft.claims.filter(({ sourceId }) => sourceId !== 'S3') };
  assert.deepEqual(rulesOf(removalProblems({ before: draft, after })), ['claim-removed']);
  assert.deepEqual(removalProblems({ before: draft, after, may: ['claims'] }), []);
});

test('a sentence that carried a claim may be dropped when the finding is about the claims', () => {
  const draft = article();
  const gone = 'The EU AI Act sets a duty for providers of high-risk systems to report serious incidents.';
  const after = {
    ...withFields(draft, {
      faq: draft.fields.faq.map((item) => ({ ...item, a: item.a.replace(gone, '').trim() })),
    }),
    claims: draft.claims.filter(({ sourceId }) => sourceId !== 'S3'),
  };
  assert.deepEqual(rulesOf(removalProblems({ before: draft, after })), ['claim-removed', 'text-removed']);
  assert.deepEqual(rulesOf(removalProblems({ before: draft, after, may: ['claims'] })), []);
});

test('the passage is the sentence a prompt is answered with, so a repair may not change it', () => {
  const draft = article();
  const after = { ...draft, passage: `${draft.passage.replace(/\.$/, '')} every time.` };
  assert.deepEqual(rulesOf(removalProblems({ before: draft, after })), ['passage-changed']);
});

test('a term loses a definition sentence: refused in the glossary format as well', () => {
  const draft = term();
  const gone =
    'The assessor does not ask for new documents, because the point is to see what the company already holds.';
  assert.deepEqual(rulesOf(removalProblems({ before: draft, after: inBody(draft, `\n\n${gone}`, '') })), [
    'text-removed',
  ]);
});

test('the word floor is exact: ninety of a hundred words pass and eighty-nine do not', () => {
  const before = synthetic(tenSentences());
  const atFloor = synthetic(tenSentences(() => 1));
  const oneUnder = synthetic(tenSentences((index) => (index === 0 ? 2 : 1)));
  assert.deepEqual(removalProblems({ before, after: atFloor }), []);
  const problems = removalProblems({ before, after: oneUnder });
  assert.deepEqual(rulesOf(problems), ['text-below-floor']);
  assert.match(problems[0].detail, /89 words/);
  assert.match(problems[0].detail, /at least 90 of the 100/);
});

test('a rule about the whole entry may shorten it, to seventy-five of a hundred words and no further', () => {
  const before = synthetic(tenSentences());
  const atFloor = synthetic(tenSentences((index) => (index < 5 ? 3 : 2)));
  const oneUnder = synthetic(tenSentences((index) => (index < 6 ? 3 : 2)));
  assert.deepEqual(rulesOf(removalProblems({ before, after: atFloor })), ['text-below-floor']);
  assert.deepEqual(removalProblems({ before, after: atFloor, may: ['words-down'] }), []);
  assert.deepEqual(rulesOf(removalProblems({ before, after: oneUnder, may: ['words-down'] })), ['text-below-floor']);
});

test('a whole-entry rule also lowers the share of each sentence that must survive', () => {
  const before = synthetic(tenSentences());
  const heavy = synthetic(tenSentences((index) => (index === 0 ? 6 : 0)));
  assert.deepEqual(rulesOf(removalProblems({ before, after: heavy })), ['text-removed']);
  assert.deepEqual(removalProblems({ before, after: heavy, may: ['words-down'] }), []);
});

test('an allowance opens only its own door', () => {
  const draft = article();
  const after = inBody(draft, `${COMMON_SENTENCE}\n\n`, '');
  for (const allowance of MAY)
    assert.deepEqual(rulesOf(removalProblems({ before: draft, after, may: [allowance] })), ['text-removed'], allowance);
});

test('an allowance the guard does not know is a programming error, never a silent pass', () => {
  assert.throws(
    () => removalProblems({ before: article(), after: article(), may: ['everything'] }),
    /unknown allowance everything/
  );
});

test('a whole-entry rewrite changes words and never the number of sentences, so a carried deletion still fails', () => {
  const draft = article();
  const after = inBody(draft, `${COMMON_SENTENCE}\n\n`, '');
  const problems = removalProblems({ before: draft, after, may: ['words-down'] });
  assert.deepEqual(rulesOf(problems), ['text-removed']);
  assert.match(problems[0].detail, /never the number of sentences/);
});
