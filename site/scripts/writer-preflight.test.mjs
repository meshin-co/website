import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { after, test } from 'node:test';

import { LENGTH_FILE } from './entry-length.mjs';
import { COLLECTION_OF, proseBlocks, proseSentences } from './entry-prose.mjs';
import { BAND_FILE } from './sentence-band.mjs';
import { claimFor, cleanDraft, RUN_DATE } from './fixtures/writer-drafts.mjs';
import { makeRepo, removeRepo } from './fixtures/writer-repo.mjs';
import { WriterError } from './writer-error.mjs';
import {
  claimProblems,
  correctionMessage,
  draftSentences,
  loadPreflightContext,
  preflight,
} from './writer-preflight.mjs';

const root = makeRepo();
after(() => removeRepo(root));
const context = loadPreflightContext(root);
const FORMATS = ['term', 'article'];

const words = (count, word = 'word') => Array.from({ length: count }, () => word).join(' ');
const run = (format, edit = () => {}, { claim = claimFor(format), runDate = RUN_DATE } = {}) => {
  const draft = cleanDraft(format);
  edit(draft);
  return preflight({ draft, claim, context, runDate });
};
const ruleList = (problems) => problems.map(({ rule }) => rule);

test('the context holds what the checks read, as plain data', () => {
  assert.deepEqual(Object.keys(context).sort(), [
    'bandRecord',
    'bannedPhrases',
    'controlledWords',
    'facts',
    'lengthRecord',
    'routes',
    'slugs',
    'tags',
  ]);
  assert.ok(context.bannedPhrases.includes('leverage'));
  assert.ok(context.facts.numbers.includes('42001'));
  assert.ok(context.routes.includes('/glossary/ai-register'));
  assert.ok(
    context.slugs.glossary.includes('ai-register') && context.slugs.post.length > 0 && context.slugs.resource.length > 0
  );
  assert.ok(context.tags.includes('ai-governance'));
  assert.deepEqual(Object.keys(context.bandRecord.bands).sort(), ['article', 'term']);
  assert.deepEqual(Object.keys(context.lengthRecord.limits).sort(), ['article', 'term']);
  assert.deepEqual(JSON.parse(JSON.stringify(context)), context);
});

test('a tree with no sentence band record is refused, naming the file and the command that writes it', () => {
  const bare = makeRepo({ band: false });
  after(() => removeRepo(bare));
  assert.throws(
    () => loadPreflightContext(bare),
    (error) =>
      error instanceof WriterError &&
      error.kind === 'config' &&
      error.message.includes(BAND_FILE) &&
      error.message.includes('measure-sentence-band.mjs --write')
  );
});

test('a tree with no entry length record is refused, naming the file and the command that writes it', () => {
  const bare = makeRepo({ length: false });
  after(() => removeRepo(bare));
  assert.throws(
    () => loadPreflightContext(bare),
    (error) =>
      error instanceof WriterError &&
      error.kind === 'config' &&
      error.message.includes(LENGTH_FILE) &&
      error.message.includes('measure-entry-length.mjs --write')
  );
});

test('a tree whose entry length record is not JSON is refused as a config error', () => {
  const broken = makeRepo({ length: '{ nope' });
  after(() => removeRepo(broken));
  assert.throws(
    () => loadPreflightContext(broken),
    (error) => error instanceof WriterError && error.kind === 'config' && error.message.includes(LENGTH_FILE)
  );
});

for (const format of FORMATS) {
  test('a clean ' + format + ' draft passes every rule', () => {
    assert.deepEqual(run(format), []);
  });
}

test('preflight does not change the draft it reads', () => {
  const draft = cleanDraft('article');
  const before = JSON.stringify(draft);
  preflight({ draft, claim: claimFor('article'), context, runDate: RUN_DATE });
  assert.equal(JSON.stringify(draft), before);
});

const CLONE = (draft, replacements) => {
  let text = JSON.stringify(draft);
  for (const [from, to] of replacements) text = text.replaceAll(from, to);
  return JSON.parse(text);
};
const append = (text) => (draft) => {
  draft.body += '\n\n' + text;
};

const PLANTED = [
  [
    'a description over the cap',
    'term',
    (d) => (d.fields.description = words(80, 'x')),
    'description-length',
    'description',
  ],
  ['an empty description', 'article', (d) => (d.fields.description = ''), 'description-length', 'description'],
  [
    'a short answer that is too short',
    'article',
    (d) => (d.fields.shortAnswer = 'Too short to count.'),
    'word-range',
    'shortAnswer',
  ],
  ['a full answer that is too long', 'article', (d) => (d.fields.fullAnswer = words(200)), 'word-range', 'fullAnswer'],
  [
    'a short definition over fifty words',
    'term',
    (d) => (d.fields.shortDefinition = words(60)),
    'word-range',
    'shortDefinition',
  ],
  [
    'a definition that is too short',
    'term',
    (d) => (d.fields.definition = 'Only a few words here.'),
    'word-range',
    'definition',
  ],
  ['too few takeaways', 'article', (d) => d.fields.keyTakeaways.splice(2), 'count-range', 'keyTakeaways'],
  ['too many takeaways', 'article', (d) => d.fields.keyTakeaways.push('a', 'b', 'c'), 'count-range', 'keyTakeaways'],
  ['too few faq entries', 'article', (d) => d.fields.faq.splice(1), 'count-range', 'faq'],
  [
    'too many faq entries',
    'article',
    (d) => (d.fields.faq = Array.from({ length: 6 }, () => d.fields.faq[0])),
    'count-range',
    'faq',
  ],
  ['a blank faq question', 'article', (d) => (d.fields.faq[0].q = ' '), 'faq-entry', 'faq[0]'],
  ['an unknown category', 'article', (d) => (d.fields.category = 'finance'), 'category', 'finance'],
  [
    'an unknown related term',
    'term',
    (d) => (d.fields.relatedTerms = ['not-a-term']),
    'unknown-related-term',
    'not-a-term',
  ],
  [
    'an unknown related resource',
    'article',
    (d) => (d.fields.relatedResources = ['nope']),
    'unknown-related-resource',
    'nope',
  ],
  ['an unknown tag', 'article', (d) => (d.fields.tags = ['nope']), 'unknown-tag', 'nope'],
  ['too few sources for an article', 'article', (d) => d.sources.splice(2), 'source-count', 'sources'],
  ['no source for a term', 'term', (d) => (d.sources = []), 'source-count', 'sources'],
  [
    'a source that is not https',
    'term',
    (d) => (d.sources[0].url = 'http://www.iso.org/standard/42001'),
    'source-url',
    'S1',
  ],
  ['a source that is not a url', 'term', (d) => (d.sources[0].url = 'iso'), 'source-url', 'S1'],
  ['a source with a blank title', 'term', (d) => (d.sources[0].title = ' '), 'source-title', 'S1'],
  ['two sources with one id', 'term', (d) => (d.sources[1].id = 'S1'), 'source-id', 'S1'],
  ['two sources with one url', 'term', (d) => (d.sources[1].url = d.sources[0].url), 'source-url-duplicate', 'S2'],
  ['a passage over forty words', 'term', (d) => (d.passage = words(41)), 'passage-length', '41 words'],
  [
    'a passage with a quotation mark',
    'term',
    (d) => (d.passage = 'A "gap assessment" is a list.'),
    'passage-characters',
    'quotation',
  ],
  [
    'a passage with markdown',
    'term',
    (d) => (d.passage = 'A gap assessment is a *list*.'),
    'passage-characters',
    'markdown',
  ],
  [
    'a passage that is not on the page',
    'term',
    (d) => (d.passage = 'This sentence is nowhere in the entry.'),
    'passage-missing',
    'passage',
  ],
  ['an empty body', 'term', (d) => (d.body = ''), 'body-empty', 'body'],
  ['an h1 in the body', 'article', (d) => (d.body = '# Title\n\n' + d.body), 'body-heading', 'h1'],
  ['raw html in the body', 'article', append('<div>raw</div>'), 'body-markup', 'html'],
  ['an image in the body', 'article', append('![alt](/a.png)'), 'body-markup', 'image'],
  ['a link to no route', 'article', append('See [it](/blog/nowhere).'), 'body-link', '/blog/nowhere'],
  [
    'a link that is not https',
    'article',
    append('See [it](http://example.org/a).'),
    'body-link',
    'http://example.org/a',
  ],
  ['a relative link', 'article', append('See [it](other-page).'), 'body-link', 'other-page'],
  ['a draft of the wrong format', 'term', (d) => (d.format = 'article'), 'format-mismatch', 'article'],
  [
    'a lead that points at the page around it',
    'article',
    (d) => (d.fields.shortAnswer = CLONE(d.fields.shortAnswer, [['An AI', 'In this article an AI']])),
    'self-containment',
    'in this article',
  ],
  ['a banned phrase', 'article', append('We leverage the register to plan.'), 'banned-phrase', 'leverage'],
  ['a number nobody allowed', 'article', append('The team closed 63 gaps last year.'), 'unsourced-number', '63'],
  [
    'a formulaic transition',
    'article',
    append('Furthermore the list is short.'),
    'formulaic-transition',
    'Furthermore',
  ],
  [
    'semicolons in a row',
    'article',
    append('One; two; three; four; five; six; seven; eight.'),
    'semicolon-density',
    'per 1000',
  ],
  [
    'a run of questions',
    'article',
    append('Is it ready? Is it tested? Is it owned?'),
    'rhetorical-question-run',
    'consecutive',
  ],
  [
    'a paragraph over seventy-five words',
    'article',
    append(Array.from({ length: 10 }, () => 'This sentence has exactly eight words in it.').join(' ')),
    'paragraph-words',
    'words',
  ],
  ['a sentence over forty words', 'article', append(words(45) + '.'), 'sentence-length', '45'],
  [
    'the query gone from the opening',
    'term',
    (d) => Object.assign(d, CLONE(d, [['gap assessment', 'review']])),
    'query-opening',
    'gap assessment',
  ],
  [
    'a table gone from an article',
    'article',
    (d) =>
      (d.body = d.body
        .split('\n')
        .filter((line) => !line.startsWith('|'))
        .join('\n')),
    'table-or-figure',
    'table',
  ],
  [
    'too few question headings',
    'article',
    (d) =>
      (d.body = d.body.replaceAll('?', '.')) && d.fields.faq.forEach((entry) => (entry.q = entry.q.replace('?', '.'))),
    'question-headings',
    'ask a question',
  ],
  [
    'the not-this-it-is-that template',
    'article',
    append('It is not a policy, it is a habit.'),
    'antithesis-template',
    'not X',
  ],
  ['a list item that opens in bold', 'article', append('- **Owner:** the system owner.'), 'bolded-lead', 'bold'],
  ['a controlled word', 'article', append('Review the plan prior to each change.'), 'controlled-word', 'prior to'],
  [
    'too many long sentences',
    'article',
    append(Array.from({ length: 8 }, () => words(26) + '.').join('\n\n')),
    'long-sentences',
    'over 25 words',
  ],
  [
    'mostly passive sentences',
    'article',
    append(Array.from({ length: 90 }, () => '- The plan was written.').join('\n')),
    'passive-voice',
    'passive',
  ],
  [
    'a median below the band',
    'term',
    (d) => (d.body = Array.from({ length: 60 }, () => 'The plan is short.').join('\n\n')),
    'median-below-band',
    'median',
  ],
  [
    'a median above the band',
    'term',
    (d) => (d.body = Array.from({ length: 30 }, () => words(30) + '.').join('\n\n')),
    'median-above-band',
    'median',
  ],
  [
    'a cluster of ten-word sentences',
    'term',
    (d) => (d.body = Array.from({ length: 40 }, () => 'The team writes the plan and then runs the plan.').join('\n\n')),
    'just-below-threshold-cluster',
    'sentences',
  ],
  ['a fact bound to nothing', 'term', (d) => (d.claims = []), 'fact-unbound', 'ISO/IEC 42001'],
  [
    'a claim row for a sentence the entry lacks',
    'term',
    (d) => (d.claims[0].sentence = 'Not in the entry.'),
    'sentence-not-in-entry',
    'Not in the entry.',
  ],
  ['a claim row for an unknown source', 'term', (d) => (d.claims[0].sourceId = 'S9'), 'source-unresolved', 'S9'],
  ['a sourced claim with no span', 'term', (d) => (d.claims[0].span = ''), 'span-missing', 'span'],
  [
    'an own-reading claim that carries a source',
    'term',
    (d) => (d.claims[1].sourceId = 'S1'),
    'own-reading-with-source',
    'own-reading',
  ],
  ['a sourced claim with no source', 'term', (d) => (d.claims[0].sourceId = null), 'sourced-without-source', 'source'],
  [
    'a standard sourced off a primary domain',
    'term',
    (d) => (d.sources[0].url = 'https://example.org/iso'),
    'standard-without-primary-source',
    'primary domain',
  ],
  [
    'an article body shorter than the shortest hand-written one',
    'article',
    (d) => (d.body = d.body.split('\n## ').slice(0, 2).join('\n## ')),
    'body-too-short',
    'no hand-written article has fewer than 160',
  ],
  [
    'an article body with one section too few',
    'article',
    (d) => (d.body = d.body.split('\n## ').slice(0, 3).join('\n## ')),
    'too-few-sections',
    '3 sections',
  ],
  [
    'an article section that is a stub',
    'article',
    (d) =>
      (d.body = d.body.replace(
        /## What do the standards say\?[\s\S]*?(?=\n## )/,
        '## What do the standards say?\n\nRead them.\n'
      )),
    'section-too-thin',
    '"What do the standards say?" has 2',
  ],
  [
    'a term body with no section',
    'term',
    (d) =>
      (d.body =
        'A gap assessment lists the distance to a standard. It names each gap and an owner. It does not certify anything at all.'),
    'too-few-sections',
    '0 sections',
  ],
];

for (const [label, format, edit, rule, detailPart] of PLANTED) {
  test('preflight refuses ' + label + ' as ' + rule, () => {
    const found = run(format, edit).filter((problem) => problem.rule === rule);
    assert.ok(found.length > 0, rule + ' was not reported');
    assert.ok(
      found.some((problem) => problem.detail.includes(detailPart)),
      'no ' + rule + ' detail names "' + detailPart + '": ' + found.map((problem) => problem.detail).join(' | ')
    );
  });
}

test('a run date that is not a calendar day is refused', () => {
  assert.ok(ruleList(run('term', () => {}, { runDate: '2026-13-45' })).includes('run-date'));
  assert.ok(ruleList(run('term', () => {}, { runDate: 'yesterday' })).includes('run-date'));
});

test('a query that the page heading lacks is refused as h1-query', () => {
  const claim = claimFor('article', { query: 'zebra crossing' });
  assert.ok(ruleList(run('article', () => {}, { claim })).includes('h1-query'));
});

test('a problem is reported once, however many rules see it', () => {
  const problems = run('article', append('We leverage the register to plan.'));
  const keys = problems.map(({ rule, detail }) => rule + '|' + detail);
  assert.equal(new Set(keys).size, keys.length);
});

test('the site chrome and the build own the rules the draft cannot show', () => {
  const found = ruleList(
    run(
      'article',
      (d) =>
        (d.body = d.body
          .replaceAll('(/glossary/ai-register)', '(/glossary/ai-register)')
          .replace('[handing over AI leadership](/blog/handing-over-ai-leadership-to-an-internal-owner)', 'it'))
    )
  );
  assert.ok(!found.includes('inbound-links'));
  assert.ok(!found.includes('updated-date'));
  assert.ok(!found.includes('list-variety') && !found.includes('heading-variety'));
});

test('draftSentences is the one extraction the band and the claim table read', () => {
  for (const format of FORMATS) {
    const draft = cleanDraft(format);
    const claim = claimFor(format);
    const expected = proseSentences(
      proseBlocks({ collection: COLLECTION_OF[format], frontmatter: draft.fields, body: draft.body })
    );
    assert.deepEqual(draftSentences({ draft, claim }), expected);
    assert.ok(expected.length >= 8);
  }
});

const claimRules = (claim) => ruleList(claimProblems({ claim, context }));

for (const format of FORMATS) {
  test('a valid ' + format + ' claim has no problem', () => {
    assert.deepEqual(claimProblems({ claim: claimFor(format), context }), []);
  });
}

test('claimProblems fails before any spend on a query the title lacks', () => {
  const found = claimProblems({ claim: claimFor('article', { query: 'zebra crossing' }), context });
  assert.deepEqual(ruleList(found), ['query-not-in-title']);
  assert.match(found[0].detail, /zebra crossing/);
});

test('claimProblems fails on a query that content-facts already targets', () => {
  const claim = claimFor('term', { title: 'What is an AI register?', slug: 'a-new-register-slug' });
  const found = claimProblems({ claim, context });
  assert.deepEqual(ruleList(found), ['query-already-targeted']);
  assert.match(found[0].detail, /ai register/);
});

test('claimProblems fails on a slug that is already an entry, in the collection of its format', () => {
  assert.deepEqual(claimRules(claimFor('term', { slug: 'ai-register' })), ['slug-exists']);
  assert.deepEqual(claimRules(claimFor('article', { slug: 'evals-in-ci-for-llm-agents' })), ['slug-exists']);
  assert.deepEqual(claimRules(claimFor('article', { slug: 'ai-register' })), []);
});

test('claimProblems fails on a title over the title limit', () => {
  const title = 'How to write an AI incident response plan ' + words(30);
  const found = claimProblems({ claim: claimFor('article', { title }), context });
  assert.deepEqual(ruleList(found), ['title-length']);
  assert.match(found[0].detail, /98/);
});

test('claimProblems names a format the writer does not write', () => {
  const found = claimProblems({ claim: claimFor('term', { format: 'faq-answer' }), context });
  assert.deepEqual(ruleList(found), ['format-unsupported']);
  assert.match(found[0].detail, /faq-answer/);
});

test('claimProblems lists every failing condition, not only the first', () => {
  const claim = claimFor('article', { query: 'zebra crossing', slug: 'evals-in-ci-for-llm-agents' });
  assert.deepEqual(ruleList(claimProblems({ claim, context })).sort(), ['query-not-in-title', 'slug-exists']);
});

const PROBLEMS = [
  { rule: 'word-range', detail: 'shortAnswer has 12 words; the schema allows 40-60' },
  {
    rule: 'fact-unbound',
    detail: '"The plan names 3 owners." the sentence asserts a fact and the table binds it to nothing',
  },
];

test('the correction message lists every problem and asks for the complete corrected output', () => {
  const message = correctionMessage(PROBLEMS);
  assert.equal(typeof message, 'string');
  for (const { rule, detail } of PROBLEMS) {
    assert.ok(message.includes(rule), 'the message names ' + rule);
    assert.ok(message.includes(detail), 'the message carries the detail of ' + rule);
  }
  assert.match(message, /complete/i);
  assert.match(message, /same (JSON )?(shape|schema|format)/i);
  assert.match(message, /not (add|invent)/i);
});

test('the correction message numbers the problems in order', () => {
  const lines = correctionMessage(PROBLEMS).split('\n');
  const first = lines.findIndex((line) => line.startsWith('1. '));
  assert.ok(first >= 0 && lines[first + 1].startsWith('2. '));
  assert.ok(lines[first].includes('word-range'));
});

test('a length problem is the one the correction message answers with more sections, never by cutting', () => {
  const message = correctionMessage([
    { rule: 'body-too-short', detail: 'the body has 300 words; no hand-written article has fewer than 885' },
  ]);
  assert.match(message, /more sections/);
  assert.match(message, /not (add|invent)/i);
});

test('a correction message with no length problem says nothing about sections', () => {
  assert.doesNotMatch(correctionMessage(PROBLEMS), /more sections/);
});

test('there is no correction message for no problems', () => {
  assert.throws(() => correctionMessage([]), /no problem/i);
});
