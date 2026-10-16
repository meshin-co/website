import assert from 'node:assert/strict';
import test from 'node:test';

import { ALLOWED_ORIGINS, analyticsClaimFindings, loadedOrigins, originFindings } from './third-party.mjs';

test('an origin the page loads is collected; one it only mentions is not', () => {
  const html = [
    '<script src="https://static.cloudflareinsights.com/beacon.min.js"></script>',
    '<link rel="stylesheet" href="/_astro/site.css">',
    '<p>We used to use plausible.io, which is paid.</p>',
    '<a href="https://example.com/article">a source</a>',
  ].join('');

  assert.deepEqual(loadedOrigins(html), ['https://static.cloudflareinsights.com']);
});

test('an undeclared vendor fails, even one nobody thought to ban', () => {
  const findings = originFindings([
    { route: '/about', html: '<script src="https://widget.some-paid-chat.example/w.js"></script>' },
  ]);

  assert.equal(findings.length, 1);
  assert.match(findings[0], /\/about/);
  assert.match(findings[0], /some-paid-chat\.example/);
});

test('a declared origin passes, and every declaration says why it is free', () => {
  assert.deepEqual(
    originFindings([
      { route: '/', html: '<script src="https://static.cloudflareinsights.com/beacon.min.js"></script>' },
    ]),
    []
  );
  for (const [origin, reason] of Object.entries(ALLOWED_ORIGINS)) {
    assert.match(origin, /^https:\/\//, `${origin} is not an origin`);
    assert.ok(reason.length > 20, `${origin} does not say why it is free`);
  }
});

test('prose that names a paid vendor is not a finding, because the page does not load it', () => {
  const findings = originFindings([
    { route: '/blog/post', html: '<p>Teams often pick plausible.io or segment.com for this.</p>' },
  ]);

  assert.deepEqual(findings, []);
});

test('naming the analytics service while loading no beacon is a false published claim', () => {
  const findings = analyticsClaimFindings([
    { route: '/privacy', html: '<p>Page views are counted by Cloudflare Web Analytics.</p>' },
  ]);

  assert.equal(findings.length, 1);
  assert.match(findings[0], /\/privacy/);
});

test('the claim and the beacon agree in both directions', () => {
  const withBoth = analyticsClaimFindings([
    {
      route: '/privacy',
      html: '<p>counted by Cloudflare Web Analytics</p><script src="https://static.cloudflareinsights.com/beacon.min.js"></script>',
    },
  ]);
  assert.deepEqual(withBoth, []);

  const withNeither = analyticsClaimFindings([{ route: '/privacy', html: '<p>No analytics runs here.</p>' }]);
  assert.deepEqual(withNeither, []);
});

test("the site's own origin is first party, however absolute the link", () => {
  const html = [
    '<link rel="canonical" href="https://meshin.co/terms">',
    '<meta property="og:image" content="https://meshin.co/og/terms.png">',
    '<script src="https://static.cloudflareinsights.com/beacon.min.js"></script>',
  ].join('');

  assert.deepEqual(loadedOrigins(html, 'https://meshin.co'), ['https://static.cloudflareinsights.com']);
  assert.deepEqual(originFindings([{ route: '/terms', html }], 'https://meshin.co'), []);
});

test('a beacon shipping while a page still denies analytics is a finding', () => {
  const privacy = '<p>No cookies are set, and no analytics runs at all on this site.</p>';
  const home = '<script src="https://static.cloudflareinsights.com/beacon.min.js"></script>';

  const findings = analyticsClaimFindings([
    { route: '/privacy', html: privacy },
    { route: '/', html: home },
  ]);

  assert.equal(findings.length, 1);
  assert.match(findings[0], /\/privacy/);
  assert.match(findings[0], /denies analytics/);
});

test("a beacon shipping while the imprint still reads 'None' is a finding", () => {
  const imprint = '<dt>Analytics</dt><dd class="text-muted">None</dd>';
  const home = '<script src="https://static.cloudflareinsights.com/beacon.min.js"></script>';

  const findings = analyticsClaimFindings([
    { route: '/imprint', html: imprint },
    { route: '/', html: home },
  ]);

  assert.equal(findings.length, 1);
  assert.match(findings[0], /\/imprint/);
});

test('both directions stay quiet when the copy matches the shipped build', () => {
  const withBeacon = [
    { route: '/', html: '<script src="https://static.cloudflareinsights.com/beacon.min.js"></script>' },
    { route: '/privacy', html: '<p>Page views are counted by Cloudflare Web Analytics.</p>' },
  ];
  const without = [
    { route: '/', html: '<p>nothing</p>' },
    { route: '/privacy', html: '<p>no analytics runs at all</p>' },
    { route: '/imprint', html: '<dt>Analytics</dt><dd>None</dd>' },
  ];

  assert.deepEqual(analyticsClaimFindings(withBeacon), []);
  assert.deepEqual(analyticsClaimFindings(without), []);
});

test('only resources the browser fetches count as a loaded origin', () => {
  const html = [
    '<link rel="alternate" type="application/rss+xml" href="https://elsewhere.example/rss.xml">',
    '<link rel="me" href="https://social.example/@someone">',
    '<link rel="stylesheet" href="https://fonts.example/sheet.css">',
    '<img src="https://images.example/a.png">',
  ].join('');

  assert.deepEqual(loadedOrigins(html).sort(), ['https://fonts.example', 'https://images.example']);
});

test('a protocol-relative script is a third-party load like any other', () => {
  const html = '<script src="//widget.unknown-vendor.example/w.js"></script>';

  assert.deepEqual(loadedOrigins(html), ['https://widget.unknown-vendor.example']);
  assert.equal(originFindings([{ route: '/', html }]).length, 1);
});

test('a lazy-loading data-src is not a load the browser has made', () => {
  const html = '<img data-src="https://images.example/a.png" src="/local.png">';

  assert.deepEqual(loadedOrigins(html), []);
});

test('an address no browser could fetch is skipped, not a crash that hides the rest', () => {
  const pages = [
    { route: '/broken', html: '<script src="https://[nope"></script>' },
    { route: '/vendor', html: '<script src="https://widget.unknown-vendor.example/w.js"></script>' },
  ];

  assert.deepEqual(loadedOrigins(pages[0].html), []);

  const findings = originFindings(pages);
  assert.equal(findings.length, 1);
  assert.match(findings[0], /\/vendor loads https:\/\/widget\.unknown-vendor\.example/);
});
