import assert from 'node:assert/strict';
import { test } from 'node:test';

import { EXTERNAL_REL, externalAnchors, internalNofollowFindings, relFindings } from './external-links.mjs';

test('the required rel is exactly nofollow, noopener and noreferrer', () => {
  assert.deepEqual([...EXTERNAL_REL].sort(), ['nofollow', 'noopener', 'noreferrer']);
});

test('an outbound anchor is collected with its rel, and an internal one is ignored', () => {
  const anchors = externalAnchors('<a href="/about">a</a><a href="https://iso.org" rel="nofollow">b</a>');
  assert.equal(anchors.length, 1);
  assert.equal(anchors[0].href, 'https://iso.org');
  assert.deepEqual(anchors[0].rel, ['nofollow']);
});

test('our own host is never outbound, with or without www', () => {
  const anchors = externalAnchors('<a href="https://meshin.co/x">a</a><a href="https://www.meshin.co/y">b</a>');
  assert.deepEqual(anchors, []);
});

test('a mailto or tel link is not an outbound web link', () => {
  assert.deepEqual(externalAnchors('<a href="mailto:hello@meshin.co">mail</a><a href="tel:+100">call</a>'), []);
});

test('an outbound link missing any required token is a finding that names the missing tokens', () => {
  const findings = relFindings('/now', '<a href="https://smarter.day/" rel="noopener">s</a>');
  assert.equal(findings.length, 1);
  assert.equal(findings[0].route, '/now');
  assert.deepEqual(findings[0].missing, ['nofollow', 'noreferrer']);
});

test('an outbound link with all three tokens in any order is clean', () => {
  assert.deepEqual(relFindings('/x', '<a href="https://iso.org" rel="noreferrer nofollow noopener">i</a>'), []);
});

test('an outbound link with no rel at all reports every token as missing', () => {
  const findings = relFindings('/x', '<a href="https://linkedin.com/in/meshin">l</a>');
  assert.deepEqual(findings[0].missing, ['nofollow', 'noopener', 'noreferrer']);
});

test('extra tokens such as me or sponsored are allowed alongside the required three', () => {
  assert.deepEqual(
    relFindings('/x', '<a href="https://linkedin.com/in/meshin" rel="me nofollow noopener noreferrer">l</a>'),
    []
  );
});

test('an internal link carrying nofollow is a finding, because it throws away our own ranking signal', () => {
  const findings = internalNofollowFindings('/resources', '<a href="/resources/x" rel="nofollow noopener">x</a>');
  assert.equal(findings.length, 1);
  assert.equal(findings[0].href, '/resources/x');
});

test('an internal link without nofollow is clean, and an outbound one is not this rule\u2019s business', () => {
  assert.deepEqual(internalNofollowFindings('/x', '<a href="/about">a</a>'), []);
  assert.deepEqual(internalNofollowFindings('/x', '<a href="https://iso.org" rel="nofollow">i</a>'), []);
  assert.deepEqual(internalNofollowFindings('/x', '<a href="https://meshin.co/about">a</a>'), []);
});
