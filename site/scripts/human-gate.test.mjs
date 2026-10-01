import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { controlledWordHits, humanFindings, sentenceStats } from './human-gate.mjs';

const read = (relative) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
const CONTROLLED = JSON.parse(read('../controlled-words.json'));
const BANNED = JSON.parse(read('../banned-phrases.json'));

const PLAIN =
  'The register lists every AI system the company runs. Each row names an owner and a risk tier. Someone reviews the tiers every quarter and writes the review date next to each row. A first version takes a week.';
const PARAGRAPHS = [
  'The register lists every AI system the company runs, and each row names an owner and a risk tier.',
  'Someone reviews the tiers every quarter.',
  'A first version takes a week, and most of that week is interviews rather than spreadsheet work, because the hard part is finding the systems nobody wrote down.',
];
const COMPETENT =
  'ISO/IEC 42001 asks an organisation to run a management system that covers every AI system it builds or buys. The standard prescribes no single technical control, so each company records its own risk assessment, names who answers for each system, and keeps the evidence that the controls it chose are working as described. An auditor samples a few systems, and each one is traced from the register entry to the monitoring records. That is why the register has to stay current, and why an out-of-date entry counts as a finding rather than a typo.';
const UNIFORM = 'One two three four five six seven eight nine ten.';

const rules = (findings) => findings.map((finding) => finding.rule);
const findingsFor = (overrides) =>
  humanFindings(
    { route: '/specimen', text: PLAIN, paragraphs: PARAGRAPHS, headings: [], lists: [], html: '', ...overrides },
    CONTROLLED
  );
const rulesFor = (overrides) => rules(findingsFor(overrides));
const withText = (text) => ({ text, paragraphs: [text] });
const repeated = (sentence, count) => Array.from({ length: count }, () => sentence).join(' ');

test('plain technical prose passes every human rule', () => {
  assert.deepEqual(findingsFor({}), []);
});

test('a dense but competent compliance paragraph passes, where a consumer-app reading ceiling would refuse it', () => {
  const stats = sentenceStats(COMPETENT);
  assert.ok(stats.average > 20 && stats.longest > 30 && stats.passiveShare > 0.1);
  assert.deepEqual(findingsFor(withText(COMPETENT)), []);
});

test('syllable counting follows the vowel-group heuristic with a silent-e discount', () => {
  assert.equal(sentenceStats('table').words, 1);
  const stats = sentenceStats('The site map helps you plan the day in one view.');
  assert.equal(stats.sentences, 1);
  assert.ok(stats.syllables >= 10 && stats.syllables <= 13);
});

test('graduate-level prose is red on reading grade, reading ease and long-word share', () => {
  const prose = [
    'Organizations implementing comprehensive methodologies for productivity optimization demonstrate significantly elevated operational efficiencies.',
    'Subsequently, stakeholders evaluate multifaceted implementation strategies to facilitate organizational transformation initiatives.',
    'Consequently, executives prioritize strategic alignment mechanisms to maximize cross-functional synergistic outcomes.',
  ].join(' ');
  const found = rulesFor(withText(prose));
  for (const rule of ['reading-grade', 'reading-ease', 'long-word-share']) assert.ok(found.includes(rule), rule);
});

test('an oversized sentence trips the longest cap and quotes its start, and a run of them trips the average', () => {
  const clause = 'The register names an owner for each of the systems the company runs across every team';
  const oversized = `${Array.from({ length: 4 }, () => clause).join(' ')}.`;
  const longest = findingsFor(withText(`${PLAIN} ${oversized}`)).find((finding) => finding.rule === 'sentence-longest');
  assert.ok(longest, 'expected sentence-longest');
  assert.ok(longest.excerpt.startsWith('The register names an owner'), `excerpt was ${longest.excerpt}`);
  assert.ok(rulesFor(withText(repeated(oversized, 3))).includes('sentence-average'));
});

test('prose that is passive from end to end trips the passive ceiling', () => {
  const text = [
    'The plan was written by the team.',
    'The goals were set by the coach.',
    'The app was built by two people.',
    'The bug was found by a user.',
    'The bills were paid by the app.',
    'The day was saved by a list.',
  ].join(' ');
  assert.equal(sentenceStats(text).passiveShare, 1);
  assert.ok(rulesFor(withText(text)).includes('passive-voice'));
});

test('an adjective after a form of be is not passive voice, a participle is', () => {
  for (const sentence of [
    'The Assessment is a fixed fee for the two weeks.',
    'The register is open to every team.',
    'This policy is mine, published in public.',
    'The status is red.',
    'The tier is often wrong.',
  ])
    assert.equal(sentenceStats(sentence).passiveShare, 0, sentence);

  for (const sentence of [
    'Incidents are written down.',
    'Model output is never sent to a client.',
    'The vendor was not told about the change.',
    'A reviewer has been named.',
    'Every vendor is pre-approved.',
    'The entry is re-checked each quarter.',
  ])
    assert.equal(sentenceStats(sentence).passiveShare, 1, sentence);
});

test('uniform paragraph sentences trip the rhythm variance floor', () => {
  assert.ok(rulesFor(withText(repeated(UNIFORM, 8))).includes('sentence-variance'));
});

test('a run of parallel one-line list items is not judged for rhythm', () => {
  const items = repeated(UNIFORM, 10);
  assert.ok(!rulesFor({ text: items, prose: items, paragraphs: [] }).includes('sentence-variance'));
});

test('fewer than eight paragraph sentences are too few to call a rhythm', () => {
  assert.ok(!rulesFor(withText(repeated(UNIFORM, 7))).includes('sentence-variance'));
});

test('identical paragraphs trip the paragraph variance floor', () => {
  const same = 'Four short words here now.';
  assert.ok(rulesFor({ paragraphs: [same, same, same, same] }).includes('paragraph-variance'));
});

test('a page with fewer than three sentences is not graded for reading level', () => {
  const text = 'Institutionalization notwithstanding, interoperability considerations predominate.';
  assert.deepEqual(rulesFor(withText(text)), []);
});

test('three lists of one length trip the list-variety rule', () => {
  assert.ok(rulesFor({ lists: [3, 3, 3] }).includes('list-variety'));
});

test('lists of different lengths pass the list-variety rule', () => {
  assert.ok(!rulesFor({ lists: [2, 5, 9] }).includes('list-variety'));
});

test('three headings opening with the same word trip the heading-variety rule', () => {
  assert.ok(rulesFor({ headings: ['How to start', 'How to keep going', 'How to stop'] }).includes('heading-variety'));
});

test('headings opening on different words pass the heading-variety rule', () => {
  assert.ok(!rulesFor({ headings: ['How to start', 'What to keep', 'Who to ask'] }).includes('heading-variety'));
});

test('the not-X-it-is-Y antithesis is refused in every spelling', () => {
  for (const sentence of [
    'This is not a plan, it is a way of living.',
    "It isn't a plan, it's a way of living.",
    'It isn’t a plan, it’s a way of living.',
    'It is not a plan; it is a way of living.',
    'It is not a plan — it is a way of living.',
    'It is not a plan - it is a way of living.',
  ]) {
    const hit = findingsFor({ text: `${PLAIN} ${sentence}` }).find((finding) => finding.rule === 'antithesis-template');
    assert.ok(hit, `expected antithesis-template for: ${sentence}`);
    assert.match(hit.excerpt, /plan/);
  }
});

test('an ordinary negation is not read as the antithesis template', () => {
  for (const sentence of [
    'It is not a law, and it is not sector specific.',
    'It is not a compliance certificate, and it is not legal advice.',
    'A register is not reviewed because it is boring.',
    'The register is not perfect, but it is useful.',
    'It is not a plan, it is not a policy, and it is not finished.',
    'Do not paste client data into a tool until it is approved.',
    'What it is not It is the paperwork a buyer asks for.',
  ])
    assert.ok(!rulesFor({ text: `${PLAIN} ${sentence}` }).includes('antithesis-template'), sentence);
});

test('a bolded-lead bullet is refused and the finding quotes the label', () => {
  for (const html of [
    '<ul><li><strong>Governance:</strong> the owner signs it off.</li></ul>',
    '<ul><li><b>Risk tiers</b> are set once a quarter.</li></ul>',
    '<ol><li>\n  <strong>Evals</strong> run in CI.</li></ol>',
    '<ul><li><p><strong>Governance:</strong> the owner signs it off.</p></li></ul>',
  ]) {
    const hit = findingsFor({ html }).find((finding) => finding.rule === 'bolded-lead');
    assert.ok(hit, `expected bolded-lead for: ${html}`);
    assert.ok(hit.excerpt.length > 0);
  }
});

test('a schedule label or a bold phrase inside the item is not a bolded lead', () => {
  for (const html of [
    '<ul><li><strong>Monday.</strong> Create the sheet.</li><li><strong>Tuesday and Wednesday.</strong> Meet teams.</li></ul>',
    '<ol><li><strong>Week 2</strong> Fill in the tiers.</li><li><strong>Step 3:</strong> Assign owners.</li></ol>',
    '<ul><li>Plain text with a <strong>bold</strong> phrase inside.</li></ul>',
    '<ul><li><p><strong>Friday.</strong> Review the register.</p></li></ul>',
  ])
    assert.ok(!rulesFor({ html }).includes('bolded-lead'), html);
});

test('a symbol or emoji bullet is refused, also when the list is loose', () => {
  for (const mark of ['🚀', '✅', '✓', '→', '•'])
    for (const item of [`${mark} Start the day right.`, `<p>${mark} Start the day right.</p>`])
      assert.ok(rulesFor({ html: `<ul><li>${item}</li></ul>` }).includes('emoji-bullet'), item);
});

test('a quote, bracket or ampersand opening an item is not an emoji bullet', () => {
  for (const html of [
    '<ul><li>&#39;In production&#39; means serving real users.</li></ul>',
    '<ul><li>“Live” means serving real users.</li></ul>',
    '<ul><li>(Optional) Add a reviewer.</li></ul>',
    '<ul><li>&amp; so on down the list.</li></ul>',
  ])
    assert.ok(!rulesFor({ html }).includes('emoji-bullet'), html);
});

test('a controlled word is red and the finding names its shorter twin', () => {
  const hit = findingsFor({ text: `${PLAIN} You can commence the task now.` }).find(
    (finding) => finding.rule === 'controlled-word'
  );
  assert.ok(hit, 'expected a controlled-word finding');
  assert.match(hit.detail, /commence/);
  assert.ok(hit.detail.includes(CONTROLLED.commence), `${hit.detail} must name the twin`);
});

test('every controlled word names a shorter twin', () => {
  assert.ok(Object.keys(CONTROLLED).length >= 10);
  for (const [word, use] of Object.entries(CONTROLLED)) {
    assert.equal(typeof use, 'string');
    assert.ok(use.length > 0 && use.length < word.length, `${word} must name a shorter twin`);
  }
});

test('the controlled list never repeats a phrase the banned list already refuses', () => {
  const banned = new Set(BANNED.map((phrase) => phrase.toLowerCase()));
  assert.deepEqual(
    Object.keys(CONTROLLED).filter((word) => banned.has(word.toLowerCase())),
    []
  );
});

test('compliance terms of art are not controlled words', () => {
  const text =
    'Article 14 sets a requirement that each individual reviewer can demonstrate oversight. The purchase order is signed and a consultant will facilitate the workshop. The team is currently reviewing it. An auditor will obtain evidence that the level of AI literacy is sufficient.';
  assert.deepEqual(controlledWordHits(text, CONTROLLED), []);
});
