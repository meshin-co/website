import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ACCEPT_PROBES, PATH_SHAPES, acceptVerdict, pathAgreementVerdict, varyVerdict } from './smoke-prod.mjs';

const HTML = 'text/html; charset=utf-8';
const MARKDOWN = 'text/markdown; charset=utf-8';

test('the Accept probes are the six headers the worker once misread, each with the type it must answer', () => {
  assert.deepEqual(ACCEPT_PROBES, [
    { accept: 'text/html, text/markdown;q=0', answers: 'text/html' },
    { accept: 'text/html;q=0.9, text/markdown;q=0.1', answers: 'text/html' },
    { accept: '*/*;q=0, text/markdown', answers: 'text/markdown' },
    { accept: 'text/markdown;q=abc', answers: 'text/html' },
    { accept: 'text/markdown;q=', answers: 'text/html' },
    { accept: 'text/html;note="x, text/markdown, y"', answers: 'text/html' },
  ]);
});

test('the path shapes are the forms the worker once answered differently for markdown than for HTML', () => {
  assert.deepEqual(PATH_SHAPES, ['/about/', '/index', '//about', '//x/about']);
});

test('a refused markdown that comes back as markdown is a failure naming both types', () => {
  const finding = acceptVerdict(ACCEPT_PROBES[0], { status: 200, contentType: MARKDOWN });

  assert.deepEqual(finding, {
    check: 'accept text/html, text/markdown;q=0',
    status: 'fail',
    detail: `answered ${MARKDOWN}, expected text/html`,
  });
});

test('a header that must be answered with markdown fails when the page comes back', () => {
  const finding = acceptVerdict(ACCEPT_PROBES[2], { status: 200, contentType: HTML });

  assert.equal(finding.status, 'fail');
  assert.match(finding.detail, /expected text\/markdown/);
});

test('the type a probe expects passes, and any status but 200 fails with the code', () => {
  assert.equal(acceptVerdict(ACCEPT_PROBES[1], { status: 200, contentType: HTML }).status, 'pass');
  assert.equal(acceptVerdict(ACCEPT_PROBES[2], { status: 200, contentType: MARKDOWN }).status, 'pass');
  const failure = acceptVerdict(ACCEPT_PROBES[1], { status: 308, contentType: '' });
  assert.equal(failure.status, 'fail');
  assert.match(failure.detail, /answered 308, expected 200/);
});

const observed = (status, extra = {}) => ({ status, location: undefined, contentLocation: undefined, ...extra });

test('markdown and HTML answering the same redirect agree', () => {
  const answer = observed(308, { location: '/about' });

  assert.deepEqual(pathAgreementVerdict('/about/', { html: answer, markdown: answer }), {
    check: 'markdown agrees with html /about/',
    status: 'pass',
    detail: 'both answered 308 to /about',
  });
});

test('markdown and HTML both answering 404 agree', () => {
  const finding = pathAgreementVerdict('//x/about', { html: observed(404), markdown: observed(404) });

  assert.equal(finding.status, 'pass');
  assert.equal(finding.detail, 'both answered 404');
});

test('a page that redirects as HTML and answers 200 as markdown is a failure, the slash form of a page', () => {
  const finding = pathAgreementVerdict('/about/', {
    html: observed(308, { location: '/about' }),
    markdown: observed(200, { contentLocation: '/about.md' }),
  });

  assert.equal(finding.status, 'fail');
  assert.match(finding.detail, /html answered 308, markdown answered 200/);
});

test('a path that is 404 as HTML and 200 as markdown is a failure, the host read out of a path', () => {
  const finding = pathAgreementVerdict('//x/about', {
    html: observed(404),
    markdown: observed(200, { contentLocation: '//x/about.md' }),
  });

  assert.equal(finding.status, 'fail');
});

test('a markdown answer labelled with two leading slashes is a failure even when both answer 200', () => {
  const finding = pathAgreementVerdict('//about', {
    html: observed(200),
    markdown: observed(200, { contentLocation: '//about.md' }),
  });

  assert.equal(finding.status, 'fail');
  assert.match(finding.detail, /content-location \/\/about\.md/);
});

test('a markdown answer labelled with its own single-slash address passes when both answer 200', () => {
  const finding = pathAgreementVerdict('//about', {
    html: observed(200),
    markdown: observed(200, { contentLocation: '/about.md' }),
  });

  assert.equal(finding.status, 'pass');
});

test('two redirects to different places are a failure', () => {
  const finding = pathAgreementVerdict('/about/', {
    html: observed(308, { location: '/about' }),
    markdown: observed(308, { location: '/about.md' }),
  });

  assert.equal(finding.status, 'fail');
  assert.match(finding.detail, /\/about\.md/);
});

test('a response that names Accept in Vary passes, however the list is written', () => {
  for (const vary of ['Accept', 'accept', 'Accept-Encoding, Accept', 'Accept , Origin']) {
    assert.equal(varyVerdict('html', vary).status, 'pass', vary);
  }
});

test('a response with no Vary, or one that names only another header, is a failure', () => {
  for (const vary of [null, '', 'Accept-Encoding', 'Origin']) {
    const finding = varyVerdict('markdown', vary);
    assert.equal(finding.check, 'vary / markdown');
    assert.equal(finding.status, 'fail', String(vary));
  }
});
