import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  canonicalHostVerdict,
  checkHeaders,
  checkNoindex,
  markdownNegotiationVerdict,
  renderSmoke,
  verdictFor,
} from './smoke-prod.mjs';

test('a response missing a required security header is a failure, naming the header', () => {
  const finding = checkHeaders({ 'content-security-policy': "default-src 'self'" });
  assert.equal(finding.status, 'fail');
  assert.match(finding.detail, /strict-transport-security/);
});

test('a CSP that allows inline script is a failure even when every header is present', () => {
  const headers = {
    'content-security-policy': "script-src 'self' 'unsafe-inline'",
    'strict-transport-security': 'max-age=63072000',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'permissions-policy': 'camera=()',
    'cross-origin-opener-policy': 'same-origin',
  };
  const finding = checkHeaders(headers);
  assert.equal(finding.status, 'fail');
  assert.match(finding.detail, /unsafe-inline/);
});

test('a complete restrictive header set passes', () => {
  const headers = {
    'content-security-policy': "default-src 'self'; script-src 'self'",
    'strict-transport-security': 'max-age=63072000; includeSubDomains; preload',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'permissions-policy': 'camera=(), microphone=()',
    'cross-origin-opener-policy': 'same-origin',
  };
  assert.equal(checkHeaders(headers).status, 'pass');
});

test('a live page still carrying noindex is a failure, because the launch flip is what removes it', () => {
  assert.equal(checkNoindex('<meta name="robots" content="noindex, nofollow" />').status, 'fail');
  assert.equal(checkNoindex('<meta name="robots" content="index, follow" />').status, 'pass');
});

test('a route that answers 200 passes and any other status fails with the code', () => {
  assert.equal(verdictFor({ route: '/', status: 200 }).status, 'pass');
  const bad = verdictFor({ route: '/pricing', status: 404 });
  assert.equal(bad.status, 'fail');
  assert.match(bad.detail, /404/);
});

test('a redirect is a failure on a canonical route, because the flip should land it directly', () => {
  const finding = verdictFor({ route: '/', status: 301 });
  assert.equal(finding.status, 'fail');
  assert.match(finding.detail, /301/);
});

test('the report prints the origin it measured and every failing row', () => {
  const md = renderSmoke('https://meshin.co', [
    { check: 'route /', status: 'pass', detail: '200' },
    { check: 'headers', status: 'fail', detail: 'missing strict-transport-security' },
  ]);
  assert.match(md, /https:\/\/meshin\.co/);
  assert.match(md, /^failures: 1$/m);
  assert.match(md, /strict-transport-security/);
});

test('the smoke report names the revision it was run from', () => {
  assert.match(renderSmoke('https://meshin.co', [], 'abc1234'), /^Generated-from: abc1234$/m);
});

test('the www host must answer a 301 to the apex, keeping the path, or the site has two addresses', () => {
  assert.deepEqual(
    canonicalHostVerdict({ status: 301, location: 'https://meshin.co/about' }, 'https://meshin.co', '/about'),
    {
      check: 'www redirect /about',
      status: 'pass',
      detail: '301 to https://meshin.co/about',
    }
  );
  assert.equal(
    canonicalHostVerdict({ status: 200, location: undefined }, 'https://meshin.co', '/about').status,
    'fail'
  );
  assert.equal(
    canonicalHostVerdict({ status: 301, location: 'https://meshin.co/' }, 'https://meshin.co', '/about').status,
    'fail'
  );
  assert.equal(
    canonicalHostVerdict({ status: 302, location: 'https://meshin.co/about' }, 'https://meshin.co', '/about').status,
    'fail'
  );
});

test('the same URL answering markdown is what an agent asking for it must see', () => {
  assert.deepEqual(
    markdownNegotiationVerdict({ status: 200, contentType: 'text/markdown; charset=utf-8', body: '# Home' }),
    {
      check: 'markdown negotiation /',
      status: 'pass',
      detail: 'text/markdown; charset=utf-8',
    }
  );
});

test('HTML returned to an agent asking for markdown is a failure, not a fallback', () => {
  assert.deepEqual(
    markdownNegotiationVerdict({ status: 200, contentType: 'text/html; charset=utf-8', body: '<html>' }),
    {
      check: 'markdown negotiation /',
      status: 'fail',
      detail: 'answered text/html; charset=utf-8, expected text/markdown',
    }
  );
});

test('markdown that is not the page is caught, not counted', () => {
  assert.deepEqual(markdownNegotiationVerdict({ status: 404, contentType: 'text/markdown', body: 'not found' }), {
    check: 'markdown negotiation /',
    status: 'fail',
    detail: 'answered 404, expected 200',
  });
});
