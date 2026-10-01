import assert from 'node:assert/strict';
import { test } from 'node:test';

import { extractPage } from './content-html.mjs';

const PAGE = `<!doctype html><html><head><title>t</title></head><body>
<header><nav><a href="/services">Services</a></nav><p>Book a call today with the team</p></header>
<main>
  <h1>What is an AI register?</h1>
  <p>An AI register is the list of every AI system a company runs, who owns it, and what data it touches.</p>
  <h2>How do I build one?</h2>
  <p>Start with the tools people already pay for.</p>
  <h3>Sources</h3>
  <table><tr><td>a</td></tr></table>
  <ul data-takeaways><li>one</li><li>two</li><li>three</li></ul>
  <a href="/glossary/evals">evals</a>
  <a href="https://www.nist.gov/itl/ai-risk-management-framework">NIST</a>
  <a href="https://www.iso.org/standard/81230.html">ISO</a>
  <div data-gate-ignore><p>Filling them in against systems you already run is where it gets specific.</p></div>
  <time datetime="2026-09-08">8 September 2026</time>
</main>
<footer><p>Book a call today with the team</p></footer>
</body></html>`;

test('extraction keeps main content and drops chrome and ignored blocks', () => {
  const page = extractPage('/glossary/ai-register', PAGE);

  assert.equal(page.route, '/glossary/ai-register');
  assert.equal(page.headings.h1.length, 1);
  assert.equal(page.headings.h1[0], 'What is an AI register?');
  assert.match(page.text, /every AI system a company runs/);
  assert.doesNotMatch(page.text, /Book a call today/);
  assert.doesNotMatch(page.text, /Filling them in against systems/);
});

test('removing an inline element never leaves a space before punctuation', () => {
  const page = extractPage(
    '/x',
    `<!doctype html><html><head><title>t</title></head><body><main><p>I flag it inside the <a href="/services/x">risk assessment</a>, before legal asks.</p><p>Read the <em>register</em>. Then <strong>publish</strong>: nothing else.</p></main></body></html>`
  );

  assert.equal(page.paragraphs[0], 'I flag it inside the risk assessment, before legal asks.');
  assert.equal(page.paragraphs[1], 'Read the register. Then publish: nothing else.');
});

test('an ignored block is stripped whole, including nested elements of the same tag', () => {
  const html =
    '<html><body><main><h1>h</h1><p>Kept prose.</p>' +
    '<div data-gate-ignore><div><p>Boilerplate note that should never be gated.</p></div><p>Also boilerplate.</p></div>' +
    '<p>Kept after.</p></main></body></html>';
  const page = extractPage('/x', html);

  assert.deepEqual(page.paragraphs, ['Kept prose.', 'Kept after.']);
  assert.doesNotMatch(page.text, /boilerplate/i);
});

test('extraction reports paragraphs, sub-headings, links, tables, takeaways and the updated date', () => {
  const page = extractPage('/glossary/ai-register', PAGE);

  assert.equal(page.paragraphs.length, 2);
  assert.deepEqual(page.headings.sub, ['How do I build one?', 'Sources']);
  assert.deepEqual(page.links.internal, ['/services', '/glossary/evals']);
  assert.deepEqual(page.links.external, [
    'https://www.nist.gov/itl/ai-risk-management-framework',
    'https://www.iso.org/standard/81230.html',
  ]);
  assert.equal(page.tables, 1);
  assert.equal(page.takeaways, 3);
  assert.equal(page.updated, '2026-09-08');
});

test('the spec-mandated lead is reported apart from the paragraphs but still counts as the opening', () => {
  const html =
    '<html><body><main><h1>h</h1><p data-gate-lead>An AI register lists every AI system a company runs.</p><p>Then the detail.</p></main></body></html>';
  const page = extractPage('/blog/x', html);

  assert.equal(page.lead, 'An AI register lists every AI system a company runs.');
  assert.deepEqual(page.paragraphs, ['Then the detail.']);
  assert.match(page.opening, /^An AI register lists/);
  assert.match(page.text, /An AI register lists/);
});

test('the first hundred words stop at a hundred words', () => {
  const body = Array.from({ length: 150 }, (_, i) => `w${i}`).join(' ');
  const page = extractPage('/x', `<html><body><main><h1>h</h1><p>${body}</p></main></body></html>`);

  assert.equal(page.opening.split(/\s+/).length, 100);
  assert.match(page.opening, /^w0 /);
  assert.doesNotMatch(page.opening, /w100/);
});

test('entities and inline tags do not leak into the text', () => {
  const page = extractPage(
    '/x',
    '<html><body><main><h1>a</h1><p>Risk &amp; <em>reward</em>&nbsp;matter.</p></main></body></html>'
  );

  assert.equal(page.paragraphs[0], 'Risk & reward matter.');
});

test('a hex entity decodes, so an escaped ampersand is not read as a number', () => {
  const page = extractPage(
    '/x',
    '<html><body><main><h1>a</h1><p>AI Readiness &#x26; Risk Assessment.</p></main></body></html>'
  );

  assert.equal(page.paragraphs[0], 'AI Readiness & Risk Assessment.');
});

test('a rendered date inside an ignored chrome block still counts as the updated date', () => {
  const html = [
    '<main>',
    '<p>Real prose that the gate judges.</p>',
    '<p data-gate-ignore>Published <time datetime="2026-09-01">1 September 2026</time>',
    ' &middot; Updated <time datetime="2026-09-14">14 September 2026</time></p>',
    '</main>',
  ].join('');
  const page = extractPage('/x', html);
  assert.equal(page.updated, '2026-09-14');
  assert.ok(!page.text.includes('Published'));
});

test('the newest rendered date wins, not the first one in the markup', () => {
  const html =
    '<main><p data-gate-ignore>Published <time datetime="2026-01-02">x</time> &middot; Updated <time datetime="2026-08-09">y</time></p></main>';
  assert.equal(extractPage('/x', html).updated, '2026-08-09');
});

test('every paragraph marked as a citable answer is exempt from the prose caps, not only the first', () => {
  const html = `<main>
    <h1>Title</h1>
    <p data-gate-lead>The section lead, short.</p>
    <p data-gate-lead>${'word '.repeat(150)}</p>
    <p>Ordinary body prose.</p>
  </main>`;
  const page = extractPage('/x', html);
  assert.equal(page.paragraphs.length, 1);
  assert.equal(page.paragraphs[0], 'Ordinary body prose.');
  assert.match(page.opening, /The section lead/);
});

test('a JSON-LD or inline script inside main is never page text, so search and the prose rules read only what a person reads', () => {
  const html =
    '<main><script type="application/ld+json">{"@type":"BreadcrumbList","name":"Pricing"}</script>' +
    '<style>.x{color:red}</style><p>What it costs depends on the fit.</p></main>';
  const page = extractPage('/pricing', html);
  assert.equal(page.text, 'What it costs depends on the fit.');
});

test('markup written inside a script string is never read as a paragraph, a heading or a link', () => {
  const html =
    '<main><h1>Real</h1><p>Real prose.</p>' +
    '<script>box.innerHTML = \'<h2>Injected heading</h2><p>Injected prose.</p><a href="https://injected.example/x">x</a>\';</script>' +
    '</main>';
  const page = extractPage('/x', html);
  assert.deepEqual(page.paragraphs, ['Real prose.']);
  assert.deepEqual(page.headings.sub, []);
  assert.deepEqual(page.links.external, []);
  assert.doesNotMatch(page.text, /Injected/);
});
