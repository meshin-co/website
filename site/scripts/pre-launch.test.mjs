import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  checkCookies,
  checkFontPolicy,
  checkMotion,
  checkRawColour,
  checkServiceWorker,
  renderChecklist,
} from './pre-launch.mjs';

test('a raw hex colour in a component is a finding, and a token reference is not', () => {
  const dirty = checkRawColour([{ file: 'x.astro', source: 'class="text-[#ff0000]"' }]);
  assert.equal(dirty.status, 'fail');
  assert.match(dirty.detail, /x\.astro/);

  const clean = checkRawColour([{ file: 'x.astro', source: 'class="text-heading"' }]);
  assert.equal(clean.status, 'pass');
});

test('a transition on a layout property is a finding, transform and opacity are not', () => {
  assert.equal(checkMotion('.a { transition: width 200ms; }').status, 'fail');
  assert.equal(
    checkMotion(
      '.a { transition: opacity 200ms, transform 200ms; }\n@media (prefers-reduced-motion: reduce) { * { transition: none; } }'
    ).status,
    'pass'
  );
});

test('a reduced-motion block is required, because the policy is unverifiable without it', () => {
  const finding = checkMotion('.a { transition: opacity 200ms; }');
  assert.equal(finding.status, 'fail');
  assert.match(finding.detail, /reduced-motion/);
});

test('any Set-Cookie or document.cookie write in the build is a finding', () => {
  assert.equal(checkCookies(['<script>document.cookie="a=1"</script>']).status, 'fail');
  assert.equal(checkCookies(['<p>no cookies</p>']).status, 'pass');
});

test('a service worker registration in the build is a finding, because no kill switch ships', () => {
  assert.equal(checkServiceWorker(['navigator.serviceWorker.register("/sw.js")']).status, 'fail');
  assert.equal(checkServiceWorker(['<p>none</p>']).status, 'pass');
});

test('the font policy counts families and weights from the shipped faces', () => {
  const finding = checkFontPolicy(['a-400.woff2', 'a-500.woff2', 'b-400.woff2', 'c-400.woff2', 'c-700.woff2']);
  assert.equal(finding.families, 3);
  assert.equal(finding.weights, 5);
});

test('the checklist renders every item with a status, and never leaves one blank', () => {
  const md = renderChecklist([
    { section: '1. Lighthouse', item: 'scores', status: 'pass', detail: '54 rows' },
    { section: '16. Privacy', item: 'consent', status: 'n/a', detail: 'no cookies ship' },
    { section: '15. Headers', item: 'HSTS', status: 'owner-blocked', detail: 'needs the live edge' },
  ]);
  assert.match(md, /54 rows/);
  assert.match(md, /n\/a/);
  assert.match(md, /owner-blocked/);
  assert.doesNotMatch(md, /\|\s*\|\s*$/m);
});

test('an issue reference in a comment is not a colour literal', () => {
  const finding = checkRawColour([{ file: 'x.astro', source: '// resolves to the current page, see #557\n' }]);
  assert.equal(finding.status, 'pass');
});

test('a theme-color meta and a mask-icon colour are not component colours, because no token can reach browser chrome', () => {
  const metas = [
    {
      file: 'Layout.astro',
      source: '<meta name="theme-color" content="#fbfaf7" media="(prefers-color-scheme: light)" />',
    },
    { file: 'Favicons.astro', source: '<link rel="mask-icon" href="/x.svg" color="#006469" />' },
  ];
  assert.equal(checkRawColour(metas).status, 'pass');
});

test('a generated file is not hand-authored, so its emitted gradient stops are not findings', () => {
  const generated = [
    { file: 'common/LogoSymbol.astro', source: '<stop stop-color="#d1d1d1"></stop>', generated: true },
  ];
  assert.equal(checkRawColour(generated).status, 'pass');
});

test('a colour in a live class or style attribute is still a finding', () => {
  const dirty = [{ file: 'x.astro', source: '<div style="color: #ff0000">hi</div>' }];
  assert.equal(checkRawColour(dirty).status, 'fail');
});

test('a hyphenated property that merely ends in a layout word is not a layout transition', () => {
  assert.equal(
    checkMotion(
      '.a { transition: border-bottom-color .16s ease-out; }\n@media (prefers-reduced-motion: reduce) { * { transition: none; } }'
    ).status,
    'pass'
  );
  assert.equal(checkMotion('.a { transition: margin-top .16s; }').status, 'fail');
});
