import assert from 'node:assert/strict';
import test from 'node:test';

import worker, { wantsMarkdown } from './markdown-negotiation.mjs';
import { pagesPlatform, request } from './fixtures/edge-platform.mjs';

const ANSWERS_THE_PAGE = [
  ['text/html, text/markdown;q=0', 'q=0 means markdown is not acceptable'],
  ['text/html;q=0.9, text/markdown;q=0.1', 'HTML is weighed higher than markdown'],
  ['text/markdown;q=abc', 'a weight that is not a number is no request'],
  ['text/markdown;q=', 'an empty weight is no request'],
  ['text/html;note="x, text/markdown, y"', 'a type inside a quoted parameter is not a media range'],
  ['text/html;note="a\\", text/markdown, b"', 'an escaped quote does not end the quoted parameter'],
  ['text/html;note="x, text/markdown', 'an unterminated quote swallows the rest of the header'],
  ['text/markdown;q=1.5', 'a weight above 1 is no request'],
  ['text/markdown;q=-1', 'a negative weight is no request'],
  ['text/markdown;q=0.1234', 'a weight with four decimals is no request'],
  ['text/markdown;q=.5', 'a weight without its leading digit is no request'],
  ['text/markdown;q="0.5"', 'a quoted weight is no request'],
  ['text/html;level=1, text/markdown;q=0.5', 'a parameter on the HTML range does not take the range away'],
  ['text/', 'a subtype is required'],
  ['*/markdown', 'a wildcard type cannot carry a subtype'],
  ['text/markdown/x', 'a media range has one slash'],
  ['*/*;q=0', 'nothing is acceptable'],
  ['text/markdown;q=0, text/*', 'a refusal of the exact type outranks a wildcard that admits it'],
  ['text/markdown, text/markdown;q=0', 'the lower weight of two equal ranges is the refusal'],
  ['*/*;q=0.1, text/markdown;q=0', 'an exact refusal outranks a weighted wildcard'],
];

const ANSWERS_MARKDOWN = [
  ['text/markdown', 'the plain request'],
  ['text/markdown, text/html;q=0.9', 'markdown weighs more than HTML'],
  ['text/markdown;q=0.9, text/html;q=0.1', 'a lower HTML weight does not tie'],
  ['*/*;q=0, text/markdown', 'markdown is the only acceptable type'],
  ['text/markdown;q=0.5, */*;q=0', 'a wildcard refusal leaves HTML unacceptable'],
  ['text/html;q=0, text/*', 'HTML is refused by name and markdown falls under the wildcard'],
  ['text/*;q=0.5, text/html;q=0.4', 'the exact range sets the weight of HTML, the wildcard that of markdown'],
  ['application/json, text/markdown;q=0.5', 'HTML is not listed at all'],
  ['TEXT/Markdown', 'type names are case-insensitive'],
  ['text/markdown ; q=0.8', 'whitespace around the semicolon is allowed'],
  ['text/markdown;charset=utf-8', 'a parameter other than the weight never decides'],
  ['text/markdown;variant="GFM, CommonMark"', 'a quoted parameter is read to its closing quote'],
  ['text/markdown;q=1.000', 'three decimals are a valid weight'],
  ['text/markdown,,', 'empty list elements are ignored'],
  ['text/markdown, garbage;q=abc', 'a malformed neighbour does not spoil a valid range'],
  ['text/markdown;q=abc, text/markdown', 'a malformed range is ignored, not read as a refusal'],
];

const TIES_GO_TO_THE_PAGE = [
  ['*/*', 'any type at all'],
  ['text/*', 'every text type at once'],
  ['text/markdown, text/html', 'equal weights'],
  ['text/markdown, */*', 'a wildcard weighs as much as the name'],
  ['text/html;q=0.8, text/markdown;q=0.8', 'equal lowered weights'],
  ['', 'no usable range'],
  ['image/png', 'a type neither representation has'],
];

for (const [accept, why] of ANSWERS_THE_PAGE) {
  test(`Accept: ${accept} keeps the page: ${why}`, () => {
    assert.equal(wantsMarkdown(accept), false);
  });
}

for (const [accept, why] of ANSWERS_MARKDOWN) {
  test(`Accept: ${accept} asks for markdown: ${why}`, () => {
    assert.equal(wantsMarkdown(accept), true);
  });
}

for (const [accept, why] of TIES_GO_TO_THE_PAGE) {
  test(`Accept: ${accept} keeps the page on a tie: ${why}`, () => {
    assert.equal(wantsMarkdown(accept), false);
  });
}

test('a request with no Accept header at all accepts everything and keeps the page', () => {
  assert.equal(wantsMarkdown(null), false);
  assert.equal(wantsMarkdown(undefined), false);
});

test('the worker serves what the weights choose, for the headers of the review', async () => {
  const reviewed = [
    ['text/html, text/markdown;q=0', 'text/html; charset=utf-8'],
    ['text/html;q=0.9, text/markdown;q=0.1', 'text/html; charset=utf-8'],
    ['*/*;q=0, text/markdown', 'text/markdown; charset=utf-8'],
    ['text/markdown;q=abc', 'text/html; charset=utf-8'],
    ['text/markdown;q=', 'text/html; charset=utf-8'],
    ['text/html;note="x, text/markdown, y"', 'text/html; charset=utf-8'],
  ];
  for (const [accept, served] of reviewed) {
    const response = await worker.fetch(request('/about', accept), { ASSETS: pagesPlatform() });
    assert.equal(response.status, 200, accept);
    assert.equal(response.headers.get('content-type'), served, accept);
    assert.match(response.headers.get('vary') ?? '', /(^|,)\s*Accept\s*(,|$)/i, accept);
  }
});
