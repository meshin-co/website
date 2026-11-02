import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { PRIMARY_DOMAINS, claimTableProblems, factualSentences, resolveClaimTable } from './claim-sources.mjs';

const SOURCES = [
  {
    id: 'S1',
    title: 'NIST AI RMF 1.0',
    url: 'https://www.nist.gov/itl/ai-risk-management-framework',
    publisher: 'NIST',
  },
  {
    id: 'S2',
    title: 'Regulation (EU) 2024/1689',
    url: 'https://eur-lex.europa.eu/eli/reg/2024/1689/oj',
    publisher: '',
  },
  { id: 'S3', title: 'A vendor blog post', url: 'https://vendor.example.com/blog/post', publisher: 'Vendor' },
];

const PLAIN = 'A pilot stalls when nobody owns the risk.';
const DATED = 'The framework was published in January 2023.';
const STANDARD = 'The NIST AI RMF defines four functions.';
const PERCENT = 'Fines can reach 7% of worldwide turnover.';

const SENTENCES = [PLAIN, DATED, STANDARD, 'Most teams already run an eval before release.', PERCENT];

const own = (sentence) => ({ sentence, marker: 'own-reading', sourceId: null, span: null });
const sourced = (sentence, sourceId, span) => ({ sentence, marker: 'sourced', sourceId, span });
const bound = (sentence, sourceId) => sourced(sentence, sourceId, 'a span of the source');

const CLAIMS = [
  own(PLAIN),
  sourced(DATED, 'S1', 'released on January 26, 2023'),
  sourced(STANDARD, 'S1', 'Govern, Map, Measure and Manage'),
  sourced(PERCENT, 'S2', 'up to 7 % of its total worldwide annual turnover'),
];

const problems = (claims, sentences = SENTENCES, sources = SOURCES) =>
  claimTableProblems({ claims, sources, sentences });
const named = (found) => found.map(({ rule, sentence }) => ({ rule, sentence }));
const rules = (found) => found.map(({ rule }) => rule);
const replaceRow = (sentence, row) => CLAIMS.map((claim) => (claim.sentence === sentence ? row : claim));

test('the primary domains are the standards bodies and the EU legal portals', () => {
  assert.deepEqual(PRIMARY_DOMAINS, ['nist.gov', 'iso.org', 'eur-lex.europa.eu', 'europa.eu', 'owasp.org', 'iec.ch']);
});

test('a table that binds every fact to a resolved source with a span has no problem', () => {
  assert.deepEqual(factualSentences(SENTENCES), [DATED, STANDARD, PERCENT]);
  assert.deepEqual(problems(CLAIMS), []);
});

test('a sentence that asserts a fact and is bound to nothing fails, named, because a sourced count is not a claim', () => {
  const found = problems(CLAIMS.filter((claim) => claim.sentence !== DATED));
  assert.deepEqual(named(found), [{ rule: 'fact-unbound', sentence: DATED }]);
  assert.match(found[0].detail, /binds it to nothing/);
});

test("a fact marked as the author's own reading is still unbound", () => {
  const found = problems(replaceRow(PERCENT, own(PERCENT)));
  assert.deepEqual(named(found), [{ rule: 'fact-unbound', sentence: PERCENT }]);
  assert.match(found[0].detail, /own reading/);
});

test('a fact stays unbound when one of the rows that name it is an own-reading row', () => {
  assert.deepEqual(named(problems([...CLAIMS, own(DATED)])), [{ rule: 'fact-unbound', sentence: DATED }]);
});

test('a sentence that is not a fact needs no row, and an own-reading row for it is fine', () => {
  assert.deepEqual(problems(CLAIMS.filter((claim) => claim.sentence !== PLAIN)), []);
});

test('a sourced row without exactly one source id fails as sourced-without-source and nothing else', () => {
  for (const sourceId of [null, '', '  ', undefined, ['S1', 'S2']])
    assert.deepEqual(named(problems(replaceRow(DATED, bound(DATED, sourceId)))), [
      { rule: 'sourced-without-source', sentence: DATED },
    ]);
});

test('a sourced row whose source is not among the entry sources fails as source-unresolved', () => {
  const found = problems(replaceRow(DATED, bound(DATED, 'S9')));
  assert.deepEqual(named(found), [{ rule: 'source-unresolved', sentence: DATED }]);
  assert.match(found[0].detail, /S9/);
  assert.match(found[0].detail, /S1, S2, S3/);
});

test('a sourced row with no span fails as span-missing', () => {
  for (const span of [null, '', '   ', undefined])
    assert.deepEqual(named(problems(replaceRow(DATED, sourced(DATED, 'S1', span)))), [
      { rule: 'span-missing', sentence: DATED },
    ]);
});

test('an own-reading row that names a source or a span fails as own-reading-with-source', () => {
  for (const row of [
    { ...own(PLAIN), sourceId: 'S1' },
    { ...own(PLAIN), span: 'a quoted span' },
  ])
    assert.deepEqual(named(problems(replaceRow(PLAIN, row))), [{ rule: 'own-reading-with-source', sentence: PLAIN }]);
});

test('a row whose sentence is not verbatim in the entry fails as sentence-not-in-entry', () => {
  const reworded = 'A pilot stalls when no one owns the risk.';
  assert.deepEqual(named(problems(replaceRow(PLAIN, own(reworded)))), [
    { rule: 'sentence-not-in-entry', sentence: reworded },
  ]);
});

test('a sentence about a standard needs a source on a primary domain', () => {
  const found = problems(replaceRow(STANDARD, bound(STANDARD, 'S3')));
  assert.deepEqual(named(found), [{ rule: 'standard-without-primary-source', sentence: STANDARD }]);
  assert.match(found[0].detail, /vendor\.example\.com/);
});

test('a fact that is not about a standard may rest on any source', () => {
  assert.deepEqual(problems(replaceRow(PERCENT, bound(PERCENT, 'S3'))), []);
});

test('a standard sentence bound by several rows needs one primary source among them, not all of them', () => {
  const without = CLAIMS.filter((claim) => claim.sentence !== STANDARD);
  assert.deepEqual(problems([...without, bound(STANDARD, 'S3'), bound(STANDARD, 'S1')]), []);
  assert.deepEqual(named(problems([...without, bound(STANDARD, 'S3'), bound(STANDARD, 'S3')])), [
    { rule: 'standard-without-primary-source', sentence: STANDARD },
  ]);
});

test('a standard sentence whose only row names an unknown source fails as source-unresolved and nothing else', () => {
  assert.deepEqual(named(problems(replaceRow(STANDARD, bound(STANDARD, 'S9')))), [
    { rule: 'source-unresolved', sentence: STANDARD },
  ]);
});

test('a resolved own-reading row that still carries a source object fails as own-reading-with-source', () => {
  const vendor = { title: SOURCES[2].title, url: SOURCES[2].url };
  const row = { sentence: PLAIN, marker: 'own-reading', source: vendor, span: null };
  assert.deepEqual(named(problems(replaceRow(PLAIN, row))), [{ rule: 'own-reading-with-source', sentence: PLAIN }]);
});

const LOOKALIKES = [
  'https://notnist.gov/a',
  'https://nist.gov.example.com/a',
  'https://example.com/nist.gov',
  'https://iso.org.evil.test/',
  'https://europa.eu.example.org/a',
  'https://eur-lex.europa.eu.example.org/a',
  'https://xowasp.org/',
  'https://iec.ch.example.net/',
  'not a url',
];

test('a primary domain matches the host or a subdomain of it and nothing that merely looks like it', () => {
  const standardOn = (url) =>
    problems(replaceRow(STANDARD, bound(STANDARD, 'S3')), SENTENCES, [...SOURCES.slice(0, 2), { ...SOURCES[2], url }]);
  for (const domain of PRIMARY_DOMAINS)
    for (const url of [
      `https://${domain}/a/b`,
      `https://deep.sub.${domain}/a?c=1#d`,
      `https://WWW.${domain.toUpperCase()}/a`,
    ])
      assert.deepEqual(standardOn(url), [], url);
  for (const url of LOOKALIKES) assert.deepEqual(rules(standardOn(url)), ['standard-without-primary-source'], url);
});

test('a table built from resolved rows is accepted and checked the same way', () => {
  const resolved = resolveClaimTable({ claims: CLAIMS, sources: SOURCES });
  assert.deepEqual(problems(resolved), []);
  const unknown = resolved.map((row) =>
    row.sentence === DATED ? { ...row, source: { ...row.source, id: 'S9' } } : row
  );
  assert.deepEqual(rules(problems(unknown)), ['source-unresolved']);
  const bare = resolved.map((row) => (row.sentence === DATED ? { ...row, source: null } : row));
  assert.deepEqual(rules(problems(bare)), ['sourced-without-source']);
});

test('resolveClaimTable stores the source id, title and url beside each sentence and span', () => {
  const nist = { id: 'S1', title: 'NIST AI RMF 1.0', url: 'https://www.nist.gov/itl/ai-risk-management-framework' };
  const eurLex = {
    id: 'S2',
    title: 'Regulation (EU) 2024/1689',
    url: 'https://eur-lex.europa.eu/eli/reg/2024/1689/oj',
  };
  assert.deepEqual(resolveClaimTable({ claims: CLAIMS, sources: SOURCES }), [
    { sentence: PLAIN, marker: 'own-reading', source: null, span: null },
    { sentence: DATED, marker: 'sourced', source: nist, span: 'released on January 26, 2023' },
    { sentence: STANDARD, marker: 'sourced', source: nist, span: 'Govern, Map, Measure and Manage' },
    { sentence: PERCENT, marker: 'sourced', source: eurLex, span: 'up to 7 % of its total worldwide annual turnover' },
  ]);
});

test('resolveClaimTable gives an own-reading row a null source and a null span, whatever the raw row leaves out', () => {
  const [row] = resolveClaimTable({ claims: [{ sentence: PLAIN, marker: 'own-reading' }], sources: SOURCES });
  assert.deepEqual(row, { sentence: PLAIN, marker: 'own-reading', source: null, span: null });
});

test('resolveClaimTable refuses a sourced row whose source is not among the entry sources', () => {
  assert.throws(() => resolveClaimTable({ claims: [bound(DATED, 'S9')], sources: SOURCES }), /S9/);
});

test('a repeated fact sentence is reported once', () => {
  assert.deepEqual(named(problems([], [DATED, DATED, PLAIN])), [{ rule: 'fact-unbound', sentence: DATED }]);
});

test('row problems come first in table order, then fact problems in entry order', () => {
  const claims = [own('Not in the entry at all.'), sourced(PERCENT, 'S9', '')];
  assert.deepEqual(
    problems(claims).map(({ rule, sentence }) => `${rule}: ${sentence}`),
    [
      'sentence-not-in-entry: Not in the entry at all.',
      `source-unresolved: ${PERCENT}`,
      `span-missing: ${PERCENT}`,
      `fact-unbound: ${DATED}`,
      `fact-unbound: ${STANDARD}`,
    ]
  );
});

const GENERAL_FACTS = [
  'There are 4 functions.',
  'It was published in 2023.',
  'The panel met in May.',
  'Agreement came in September.',
  'A large percent of teams skip it.',
  'About a third of teams skip it, near 33%.',
];

const STANDARD_FACTS = [
  'ISO sets the terms.',
  'IEC publishes the part.',
  'NIST wrote it.',
  'OWASP lists the risks.',
  'IEEE publishes a guide.',
  'ENISA reviewed it.',
  'The EDPB issued guidance.',
  'The GDPR applies.',
  'The EU AI Act applies.',
  'The AI Act applies.',
  'Regulation (EU) sets duties.',
  'Regulation 2024/1689 sets duties.',
  'A Directive 2022/2555 sets duties.',
  'Article 6 sets the rule.',
  'Annex III lists the uses.',
  'Annex IV lists the contents.',
  'A SOC 2 report helps.',
  'HIPAA applies to health data.',
  'The CCPA applies in California.',
  'PCI DSS covers cards.',
  'FedRAMP covers cloud.',
  'NIS2 covers operators.',
  'DORA covers banks.',
];

const NOT_FACTS = [
  'A pilot stalls when nobody owns the risk.',
  'You may start now.',
  'The march of the models continues.',
  'This article explains the isolation of regulations.',
  'The annex to the contract is short.',
  'The directive from the board was clear.',
  'Regulation of AI varies by country.',
  'A regulation of some kind applies.',
  'Use the iso format for dates.',
  'The framework has four functions.',
];

test('a digit, a year, a month or a percentage makes a sentence a fact, and any source will do for it', () => {
  for (const sentence of GENERAL_FACTS) {
    assert.deepEqual(factualSentences([sentence]), [sentence], sentence);
    assert.deepEqual(problems([bound(sentence, 'S3')], [sentence]), [], sentence);
  }
});

test('a named standard, regulation or body makes a sentence a fact held to the primary-domain rule', () => {
  for (const sentence of STANDARD_FACTS) {
    assert.deepEqual(factualSentences([sentence]), [sentence], sentence);
    assert.deepEqual(
      rules(problems([bound(sentence, 'S3')], [sentence])),
      ['standard-without-primary-source'],
      sentence
    );
    assert.deepEqual(problems([bound(sentence, 'S1')], [sentence]), [], sentence);
  }
});

test('prose without a digit, month, percentage or named standard is not a fact', () => {
  assert.deepEqual(factualSentences([...NOT_FACTS, DATED]), [DATED]);
});
