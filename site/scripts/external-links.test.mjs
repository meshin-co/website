import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { contactEmail } from '../src/utils/brand.mjs';

import { EXTERNAL_REL, externalAnchors, internalNofollowFindings, relFindings } from './external-links.mjs';
import { siteBrand } from './site-brand.mjs';

const RUNNER = fileURLToPath(new URL('./run-external-links.mjs', import.meta.url));
const BRAND = siteBrand();
const HOST = BRAND.name;
const DOTTED_LOOKALIKE = HOST.replace('.', '-');
const SUFFIXED_LOOKALIKE = `${HOST}.evil.example`;

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
  const anchors = externalAnchors(`<a href="https://${HOST}/x">a</a><a href="https://www.${HOST}/y">b</a>`);
  assert.deepEqual(anchors, []);
});

test('a mailto or tel link is not an outbound web link', () => {
  const html = `<a href="mailto:${contactEmail(BRAND)}">mail</a><a href="tel:+100">call</a>`;
  assert.deepEqual(externalAnchors(html), []);
});

test('an outbound link missing any required token is a finding that names the missing tokens', () => {
  const findings = relFindings('/now', '<a href="https://example.org/" rel="noopener">s</a>');
  assert.equal(findings.length, 1);
  assert.equal(findings[0].route, '/now');
  assert.deepEqual(findings[0].missing, ['nofollow', 'noreferrer']);
});

test('an outbound link with all three tokens in any order is clean', () => {
  assert.deepEqual(relFindings('/x', '<a href="https://iso.org" rel="noreferrer nofollow noopener">i</a>'), []);
});

test('an outbound link with no rel at all reports every token as missing', () => {
  const findings = relFindings('/x', '<a href="https://linkedin.com/in/someone">l</a>');
  assert.deepEqual(findings[0].missing, ['nofollow', 'noopener', 'noreferrer']);
});

test('extra tokens such as me or sponsored are allowed alongside the required three', () => {
  assert.deepEqual(
    relFindings('/x', '<a href="https://linkedin.com/in/someone" rel="me nofollow noopener noreferrer">l</a>'),
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
  assert.deepEqual(internalNofollowFindings('/x', `<a href="https://${HOST}/about">a</a>`), []);
});

test('an absolute link to our own host carrying nofollow is a finding, with or without www', () => {
  const html = `<a href="https://${HOST}/about" rel="nofollow">a</a><a href="https://www.${HOST}/faq" rel="nofollow">b</a>`;
  assert.deepEqual(
    internalNofollowFindings('/x', html).map(({ href }) => href),
    [`https://${HOST}/about`, `https://www.${HOST}/faq`]
  );
});

test('a host that only resembles ours is outbound, so nofollow on it is not an internal finding', () => {
  assert.notEqual(DOTTED_LOOKALIKE, HOST, 'the brand name must be a host with a dot');
  for (const lookalike of [DOTTED_LOOKALIKE, SUFFIXED_LOOKALIKE]) {
    const html = `<a href="https://${lookalike}/about" rel="nofollow">a</a>`;
    assert.deepEqual(internalNofollowFindings('/x', html), [], lookalike);
  }
});

test('a flat page whose file name ends in index is reported under its own route, not a truncated one', () => {
  const dist = mkdtempSync(join(tmpdir(), 'run-external-links-'));
  mkdirSync(join(dist, 'blog'), { recursive: true });
  writeFileSync(join(dist, 'index.html'), '<html></html>');
  writeFileSync(join(dist, 'blog', 'reindex.html'), '<a href="https://iso.org/" rel="noopener">iso</a>');

  const { stdout, status } = spawnSync(process.execPath, [RUNNER, dist], { encoding: 'utf8' });

  assert.equal(status, 1);
  assert.match(stdout, /missing nofollow, noreferrer on 1 route\(s\), e\.g\. \/blog\/reindex\n/);
});
