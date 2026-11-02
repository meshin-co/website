import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

import { brandFromDisk, titleSuffix } from '../src/utils/brand.mjs';
import { bookingCtaFinding } from './booking-cta.mjs';
import { gateFindings } from './content-gate.mjs';
import { PROFILES, judgePage } from './content-rows.mjs';
import { parseGateFindings, recordGateFindings } from './gate-findings.mjs';
import { contentRecords } from './gate-records.mjs';
import { knownRule, listRows } from './repair-kinds.mjs';
import {
  GENERATED_BEGIN,
  GENERATED_END,
  absenceFindings,
  docDriftFindings,
  duplicateQueryFindings,
  mustWinFindings,
  orphanFindings,
  passageFindings,
  titleFindings,
} from './semantic-core.mjs';

const GATE = 'gate:content';
const FILE = 'gate-content.json';
const DOC = ['docs/SEMANTIC-CORE.md'];
const ROUTE = '/blog/ai-register';
const SITE = resolve(import.meta.dirname, '..');
const SUFFIX = titleSuffix(brandFromDisk(join(SITE, 'src/config.yaml')));
const SOURCES = ['content-rows.mjs', 'prose-rules.mjs', 'content-gate.mjs', 'semantic-core.mjs', 'booking-cta.mjs'];
const RULE_LITERAL = /\brule: '([a-z0-9-]+)'|\badd\('([a-z0-9-]+)'/g;

const ARTICLE = {
  route: ROUTE,
  profile: 'article',
  text: 'An AI register lists every AI system a company runs. It names an owner for each one.',
  lead: null,
  opening: 'An AI register lists every AI system a company runs.',
  paragraphs: ['An AI register lists every AI system a company runs.', 'It names an owner for each one.'],
  headings: {
    h1: ['What is an AI register?'],
    sub: ['What goes in it?', 'How do I build one?', 'Who keeps it current?'],
  },
  links: {
    internal: ['/glossary/evals', '/services'],
    external: ['https://www.nist.gov/a', 'https://www.iso.org/b', 'https://eur-lex.europa.eu/c'],
  },
  tables: 1,
  figures: 0,
  takeaways: 3,
  updated: '2026-09-08',
};
const PAGE = { ...ARTICLE, route: '/pricing', profile: 'page' };
const FACTS = { targetQuery: { [ROUTE]: 'AI register' }, numbers: [] };
const SHARED = 'An AI register is the list of every AI system your company runs today.';
const SHARING = [
  { ...PAGE, route: '/pricing', paragraphs: [SHARED] },
  { ...PAGE, route: '/about', paragraphs: [SHARED] },
];
const WANTED = [{ number: 9, mustWinRoutes: ['/blog/missing'], passages: [] }];
const CITED = [{ number: 1, mustWinRoutes: ['/'], passages: [{ text: 'the exact sentence', route: '/' }] }];
const WITHOUT_IT = [{ route: '/', text: 'something else' }];
const DECIDED_AGAINST = [{ route: '/about', text: 'Based in Israel, remote worldwide.' }];
const NO_LINK = '<main><p>No link here.</p></main>';

const sentence = (count) => `${Array.from({ length: count }, () => 'plan').join(' ')}.`;
const paragraphOf = (...counts) => counts.map((count) => sentence(count)).join(' ');
const generated = (cell, heading = '### static (1)') =>
  [heading, '', '| Route | Query |', '|---|---|', `| \`/\` | ${cell} |`].join('\n');
const COMMITTED = ['# Semantic core', '', GENERATED_BEGIN, generated('old'), GENERATED_END].join('\n');

const onArticle = (change) => ({
  found: () => judgePage({ ...ARTICLE, ...change }, PROFILES.article, FACTS, ['leverage']),
  subjects: [ROUTE],
});
const onPages = (pages, subjects) => ({ found: () => gateFindings(pages, FACTS, []), subjects });
const onProse = (paragraph) => onPages([{ ...PAGE, paragraphs: [paragraph] }], ['/pricing']);
const onRoute = (route, found) => ({ found, subjects: [route] });
const onTitle = (route, title) => onRoute(route, () => titleFindings([{ route, title }]));
const onDocument = (found) => ({ found, subjects: DOC });

const PLANTED = {
  'h1-count': onArticle({ headings: { ...ARTICLE.headings, h1: ['One', 'Two'] } }),
  'h1-query': onArticle({ headings: { ...ARTICLE.headings, h1: ['Everything about governance'] } }),
  'query-opening': onArticle({ opening: 'Something else entirely for a hundred words.' }),
  'paragraph-words': onArticle({ paragraphs: [paragraphOf(...Array(10).fill(8))] }),
  'sentence-length': onArticle({ paragraphs: [paragraphOf(5, 5, 41)] }),
  'median-sentence': onArticle({ paragraphs: [paragraphOf(23, 23)] }),
  'banned-phrase': onArticle({ text: `${ARTICLE.text} We leverage it.` }),
  'unsourced-number': onArticle({ paragraphs: ['It cut review time by 87% across the board.'] }),
  takeaways: onArticle({ takeaways: 0 }),
  'table-or-figure': onArticle({ tables: 0 }),
  'inbound-links': onArticle({ links: { ...ARTICLE.links, internal: [] } }),
  'outbound-links': onArticle({ links: { ...ARTICLE.links, external: [] } }),
  'question-headings': onArticle({ headings: { ...ARTICLE.headings, sub: ['Governance', 'Tiers', 'Owners'] } }),
  'updated-date': onArticle({ updated: null }),
  'formulaic-transition': onProse('The register lists systems. Moreover, each row names an owner.'),
  'not-only-but-also': onProse('The register is not only a list but also a contract.'),
  'guide-preamble': onProse('This guide will show you the register.'),
  'hollow-credential': onProse('We are an industry-leading practice.'),
  'semicolon-density': onProse('One; two; three; four. Five words here.'),
  'em-dash-density': onProse('One — two — three — four. Five words here.'),
  'rhetorical-question-run': onProse('Who owns it? Who signs it? Who reviews it?'),
  'duplicate-sentence': onPages(SHARING, ['/pricing', '/about']),
  'query-without-route': onRoute('/gone', () => orphanFindings(['/'], ['/', '/gone'])),
  'route-without-query': onRoute('/x', () => orphanFindings(['/', '/x'], ['/'])),
  'duplicate-query': onRoute('/a', () => duplicateQueryFindings({ '/a': 'ai register', '/b': 'AI  Register ' })),
  'title-missing': onTitle('/a', ''),
  'title-suffix': onTitle('/pricing', 'Pricing'),
  'title-stem': onTitle('/glossary/x', `AI register${SUFFIX}`),
  'doc-drift': onDocument(() => docDriftFindings(COMMITTED, generated('new'))),
  'doc-drift-structure': onDocument(() => docDriftFindings(COMMITTED, generated('old', '### static (2)'))),
  'buyer-prompt-must-win-missing': onRoute('/blog/missing', () => mustWinFindings(WANTED, ['/'])),
  'buyer-prompt-passage-missing': onRoute('/', () => passageFindings(CITED, WITHOUT_IT)),
  'published-against-a-decision': onRoute('/about', () => absenceFindings(DECIDED_AGAINST)),
  'booking-cta-missing': onRoute('/', () => [bookingCtaFinding('/', NO_LINK)]),
};

for (const [rule, { found, subjects }] of Object.entries(PLANTED)) {
  test(`${rule} is emitted by the gate, recorded against ${subjects.join(', ')}, and known`, () => {
    const records = contentRecords(found());
    const emitted = records.map((record) => record.rule).join(', ') || 'nothing';

    const hit = records.find((record) => record.rule === rule);

    assert.ok(hit, `${GATE} emitted ${emitted}, never ${rule}`);
    assert.deepEqual(hit.subjects, subjects);
    assert.equal(knownRule({ gate: GATE, rule }), true, `${GATE} ${rule} is not a row of the repair table`);
  });
}

const ruleIdsIn = (source) => {
  const text = readFileSync(join(import.meta.dirname, source), 'utf8');
  return [...text.matchAll(RULE_LITERAL)].map((match) => match[1] ?? match[2]);
};

test('the gate sources hold no rule id without a planted test above', () => {
  const emitted = [...new Set(SOURCES.flatMap((source) => ruleIdsIn(source)))];

  assert.equal(emitted.length, 34);
  assert.deepEqual(emitted.sort(), Object.keys(PLANTED).sort());
});

test('the repair table holds a row for every rule planted above and for no other rule of this gate', () => {
  const rules = listRows()
    .filter((row) => row.gate === GATE)
    .map((row) => row.rule);

  assert.deepEqual(rules.sort(), Object.keys(PLANTED).sort());
});

test('every record the gate can emit is accepted by the strict findings schema and parses back', () => {
  const directory = mkdtempSync(join(tmpdir(), 'content-findings-write-'));
  try {
    const findings = Object.values(PLANTED).flatMap(({ found }) => contentRecords(found()));

    recordGateFindings({ gate: GATE, findings, env: { GATE_FINDINGS_DIR: directory } });

    const written = parseGateFindings(readFileSync(join(directory, FILE), 'utf8'));
    assert.ok(findings.length >= Object.keys(PLANTED).length);
    assert.deepEqual(written.findings, findings);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('the clean article the plants start from has no finding, so each plant owns the rule it plants', () => {
  assert.deepEqual(judgePage(ARTICLE, PROFILES.article, FACTS, ['leverage']), []);
  assert.deepEqual(gateFindings([PAGE], FACTS, []), []);
});
