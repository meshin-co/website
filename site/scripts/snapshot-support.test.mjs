import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { TITLE_COVERAGE, normalise, supportsCitation, visibleText } from './snapshot-support.mjs';

const RECORDED_PAGE = readFileSync(new URL('./fixtures/wayback/snapshot-page.html', import.meta.url), 'utf8');
const TEXT = visibleText(RECORDED_PAGE);
const TITLE = 'AI Risk Management Framework | NIST';
const SENTENCE =
  'a framework to better manage risks to individuals, organizations, and society associated with artificial intelligence';
const supports = (changes) => supportsCitation({ text: TEXT, title: TITLE, ...changes });

test('visible text drops scripts, styles, comments and what a reader never sees, and decodes entities', () => {
  const html = [
    '<!DOCTYPE html><html><head><title>Fish &amp; Chips</title>',
    '<style>.x { color: red }</style><script>var secret = "<p>not text</p>";</script></head>',
    '<body><!-- <b>hidden</b> --><p>Tom&nbsp;&amp;&nbsp;Jerry&#39;s &quot;best&quot; &lt;3 &#8212; &#x2019;ok&#x2019;</p>',
    '<noscript>enable scripts</noscript><template><p>template text</p></template>',
    '<svg viewBox="0 0 1 1"><title>icon</title><path d="M0 0"/></svg>',
    '<p>line one<br>line two</p>\n\n   <p>  spaced   out </p></body></html>',
  ].join('');

  assert.equal(visibleText(html), 'Fish & Chips Tom & Jerry\'s "best" <3 — ’ok’ line one line two spaced out');
});

test('the recorded page reads as a reader would read it: its words stay, its scripts, styles and comments go', () => {
  assert.ok(TEXT.startsWith('AI Risk Management Framework | NIST Skip to main content An official website'));
  assert.ok(TEXT.includes('Information Technology Laboratory AI Risk Management Framework In collaboration with'));
  assert.ok(TEXT.includes('News & Updates'));
  for (const leaked of ['dataLayer', 'schema.org', 'antibot', 'A locked padlock', 'nist-index-ignore', '&amp;']) {
    assert.equal(TEXT.includes(leaked), false, leaked);
  }
  assert.doesNotMatch(TEXT, /\s{2}|^\s|\s$/);
});

test('a document cut inside a script, a comment, a style or a tag does not leak what it was cut inside', () => {
  const cut = [
    '<p>kept</p><script>var leak = 1;',
    '<p>kept</p><!-- a comment that never ends',
    '<p>kept</p><style>.leak {',
    '<p>kept</p><div class="leak',
  ];

  for (const html of cut) assert.equal(visibleText(html), 'kept', html);
});

test('an element whose name only starts like a hidden one is kept, and tag names are not case sensitive', () => {
  assert.equal(visibleText('<p>a</p><svg-icon name="x">kept</svg-icon><p>b</p>'), 'a kept b');
  assert.equal(visibleText('<SCRIPT>leak()</SCRIPT>ok<Style>.leak{}</Style>'), 'ok');
});

test('entities are decoded once, and the ones that mean nothing are left as they were', () => {
  const html = '&amp;lt; &copy; &#99999999; &#0; &#x1F600; &constructor; &toString;';

  assert.equal(visibleText(html), '&lt; &copy; &#99999999; &#0; 😀 &constructor; &toString;');
});

test('normalise folds accents, case and punctuation into single spaces', () => {
  assert.equal(normalise('  Café — Résumé: “AI” & Co.  '), 'cafe resume ai co');
  assert.equal(normalise('ﬁnal ² AI-RMF 1.0'), 'final 2 ai rmf 1 0');
  assert.equal(normalise('Ünïcödé NAÏVE'), 'unicode naive');
});

test('normalise reads anything that is not a string as empty', () => {
  for (const odd of [undefined, null, 42, {}, []]) assert.equal(normalise(odd), '', String(odd));
});

test('the recorded page supports its own title, and a source title with a document number it does not carry', () => {
  assert.deepEqual(supports({}), { ok: true, coverage: 1, spansChecked: 0 });
  const entryTitle = 'Artificial Intelligence Risk Management Framework (AI RMF 1.0), NIST AI 100-1';
  assert.deepEqual(supports({ title: entryTitle }), { ok: true, coverage: 0.875, spansChecked: 0 });
});

test('a title of another document is refused, naming the coverage and the first five missing words', () => {
  const title =
    'Regulation (EU) 2024/1689 of the European Parliament and of the Council laying down harmonised rules on artificial intelligence';

  const verdict = supports({ title });

  assert.equal(verdict.ok, false);
  assert.match(verdict.reason, /2 of the 12 title words/);
  assert.match(verdict.reason, /coverage 0\.17/);
  assert.match(verdict.reason, /missing: regulation, 2024, 1689, european, parliament$/);
});

test('a near miss is refused: the framework page is not its generative AI profile', () => {
  const title = 'Artificial Intelligence Risk Management Framework: Generative Artificial Intelligence Profile';

  const verdict = supports({ title });

  assert.equal(verdict.ok, false);
  assert.match(verdict.reason, /coverage 0\.71/);
  assert.match(verdict.reason, /missing: generative, profile$/);
});

test('the coverage threshold is met at exactly three quarters and missed just below it', () => {
  assert.equal(TITLE_COVERAGE, 0.75);
  const atThreshold = supports({ title: 'Risk Management Framework Zebra' });
  assert.deepEqual(atThreshold, { ok: true, coverage: 0.75, spansChecked: 0 });
  assert.equal(supports({ title: 'Risk Framework Zebra' }).ok, false);
});

test('quoted spans that the page carries are checked, ignoring case, punctuation and spacing', () => {
  const spans = [SENTENCE, 'CONSENSUS-DRIVEN open,   transparent and collaborative process'];

  assert.deepEqual(supports({ spans }), { ok: true, coverage: 1, spansChecked: 2 });
});

test('a span the page does not carry is refused by name, the first of several, even when the title fits', () => {
  const verdict = supports({ spans: [SENTENCE, 'NIST banned the framework in 2019', 'a second missing quotation'] });

  assert.equal(verdict.ok, false);
  assert.match(verdict.reason, /quoted span/);
  assert.match(verdict.reason, /NIST banned the framework in 2019/);
  assert.doesNotMatch(verdict.reason, /second missing/);
});

test('a span must match whole words, so part of a word is not the quotation', () => {
  assert.equal(supports({ spans: ['risk management framework'] }).ok, true);
  assert.equal(supports({ spans: ['risk manage'] }).ok, false);
  assert.equal(supports({ spans: ['isk management'] }).ok, false);
});

test('a span that is empty once normalised is not checked and not counted', () => {
  const verdict = supports({ spans: ['', '   ', '—', null, 7, SENTENCE] });

  assert.deepEqual(verdict, { ok: true, coverage: 1, spansChecked: 1 });
});

test('spans that are not a list are ignored rather than thrown on', () => {
  for (const spans of ['a span', null, 7, { length: 1 }]) {
    assert.deepEqual(supports({ spans }), { ok: true, coverage: 1, spansChecked: 0 }, String(spans));
  }
});

test('the title and the spans must both hold', () => {
  assert.equal(supports({ title: 'Regulation of the European Parliament', spans: [SENTENCE] }).ok, false);
  assert.equal(supports({ spans: ['something the page never said'] }).ok, false);
});

test('synthetic: a snapshot of a page not found stub supports nothing', () => {
  const stub =
    '<html><head><title>Page not found</title></head><body><h1>404 Not Found</h1><p>The page you requested could not be found.</p></body></html>';

  const verdict = supportsCitation({ text: visibleText(stub), title: TITLE });

  assert.equal(verdict.ok, false);
  assert.match(verdict.reason, /0 of the 4 title words/);
  assert.match(verdict.reason, /missing: risk, management, framework, nist$/);
});

test('a title with fewer than two distinct words of three letters or more is too short to check against', () => {
  const short = ['NIST', 'AI RMF', 'The AI', 'Framework framework', '', 'the and for'];
  const tooShort = { ok: false, reason: 'the title is too short to check a page against' };

  for (const title of short) assert.deepEqual(supports({ title }), tooShort, title);
  assert.equal(supports({ title: 'Risk Framework' }).ok, true);
});

test('odd input is refused with a reason and never throws', () => {
  const odd = [
    undefined,
    null,
    {},
    { text: 5, title: {}, spans: 'x' },
    { text: null, title: ['Risk', 'Framework'], spans: [null, 7, {}] },
    { text: undefined, title: 'Risk Management Framework' },
  ];

  for (const input of odd) {
    const verdict = supportsCitation(input);
    assert.equal(verdict.ok, false, JSON.stringify(input));
    assert.equal(typeof verdict.reason, 'string', JSON.stringify(input));
  }
});
