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

const realFace = (family, hash, weight) =>
  `@font-face{font-family:"${family}-${hash}";src:url("/_astro/fonts/${hash}.woff2") format("woff2");font-weight:${weight};font-style:normal}`;
const fallbackFace = (family, hash, weight, localName) =>
  `@font-face{font-family:"${family}-${hash} fallback: ${localName}";src:local("${localName}");font-weight:${weight};font-style:normal}`;

test('the font policy counts real @font-face src:url rules, strips the content hash, and ignores the local() fallback', () => {
  const css =
    realFace('Fraunces', 'c376d5df76677c15', 600) +
    fallbackFace('Fraunces', 'c376d5df76677c15', 600, 'Times New Roman') +
    realFace('IBM Plex Sans', '0e3285ad6af1f8cc', 400) +
    realFace('IBM Plex Sans', '18e62b4625ad145f', 500) +
    fallbackFace('IBM Plex Sans', '0e3285ad6af1f8cc', 400, 'Arial');

  const finding = checkFontPolicy(css);
  assert.equal(finding.families, 2);
  assert.equal(finding.weights, 3);
  assert.deepEqual(finding.list, ['fraunces-600', 'ibm plex sans-400', 'ibm plex sans-500']);
  assert.equal(finding.status, 'pass');
});

test('a fontsource-shaped filename with no real @font-face rule is not counted, and is a failure, not a pass', () => {
  const finding = checkFontPolicy('a-400.woff2, b-500.woff2');
  assert.equal(finding.families, 0);
  assert.equal(finding.weights, 0);
  assert.deepEqual(finding.list, []);
  assert.equal(finding.status, 'fail');
});

test('an empty document is a failure, never a silent 0/0 pass', () => {
  const finding = checkFontPolicy('');
  assert.equal(finding.families, 0);
  assert.equal(finding.weights, 0);
  assert.equal(finding.status, 'fail');
  assert.match(finding.detail, /no @font-face/);
});

test('an extra shipped face changes the count, so the check reacts to what actually ships, and neither shape matches the locked L39 policy', () => {
  const oneFace = realFace('Fraunces', 'aaaa000000000000', 600);
  const twoFaces = oneFace + realFace('Mono', 'bbbb111111111111', 400);

  const one = checkFontPolicy(oneFace);
  assert.equal(one.families, 1);
  assert.equal(one.weights, 1);
  assert.deepEqual(one.list, ['fraunces-600']);
  assert.equal(one.status, 'fail');

  const two = checkFontPolicy(twoFaces);
  assert.equal(two.families, 2);
  assert.equal(two.weights, 2);
  assert.deepEqual(two.list, ['fraunces-600', 'mono-400']);
  assert.equal(two.status, 'fail');
});

const ASTRO_LATIN_RANGE =
  'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const astroEmittedFaces = [
  `@font-face{font-family:Fraunces-c376d5df76677c15;src:url("/_astro/fonts/22d5b0872539c73c.woff2") format("woff2");font-display:swap;unicode-range:${ASTRO_LATIN_RANGE};font-weight:600;font-style:normal}`,
  `@font-face{font-family:"Fraunces-c376d5df76677c15 fallback: Times New Roman";src:local("Times New Roman");font-display:swap;font-weight:600;font-style:normal;size-adjust:119.2615%;ascent-override:82.0046%;descent-override:21.3816%;line-gap-override:0%}`,
  `@font-face{font-family:"IBM Plex Sans-0e3285ad6af1f8cc";src:url("/_astro/fonts/0afc56df7fe9322d.woff2") format("woff2");font-display:swap;unicode-range:${ASTRO_LATIN_RANGE};font-weight:400;font-style:normal}`,
  `@font-face{font-family:"IBM Plex Sans-0e3285ad6af1f8cc";src:url("/_astro/fonts/18e62b4625ad145f.woff2") format("woff2");font-display:swap;unicode-range:${ASTRO_LATIN_RANGE};font-weight:500;font-style:normal}`,
  `@font-face{font-family:"IBM Plex Sans-0e3285ad6af1f8cc fallback: Arial";src:local("Arial");font-display:swap;font-weight:400;font-style:normal;size-adjust:101.1663%;ascent-override:101.3184%;descent-override:27.183%;line-gap-override:0%}`,
  `@font-face{font-family:"IBM Plex Sans-0e3285ad6af1f8cc fallback: Arial";src:local("Arial");font-display:swap;font-weight:500;font-style:normal;size-adjust:101.1663%;ascent-override:101.3184%;descent-override:27.183%;line-gap-override:0%}`,
];
const astroEmittedHead = `<html><head><style>${astroEmittedFaces.join('\n')}</style></head><body></body></html>`;

test('the font policy passes the @font-face blocks Astro emits, including the unquoted single-word family and both fallback faces', () => {
  const finding = checkFontPolicy(astroEmittedHead);

  assert.equal(finding.families, 2);
  assert.equal(finding.weights, 3);
  assert.deepEqual(finding.list, ['fraunces-600', 'ibm plex sans-400', 'ibm plex sans-500']);
  assert.equal(finding.status, 'pass');
});

test('two families and three faces that are not the locked L39 faces fail, because matching counts alone would pass them', () => {
  const css =
    realFace('Lora', 'aaaa000000000000', 600) +
    realFace('Inter', 'bbbb111111111111', 400) +
    realFace('Inter', 'bbbb111111111111', 500);

  const finding = checkFontPolicy(css);
  assert.equal(finding.families, 2);
  assert.equal(finding.weights, 3);
  assert.equal(finding.status, 'fail');
  assert.match(finding.detail, /L39 requires exactly fraunces-600, ibm plex sans-400, ibm plex sans-500/);
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

test('a raw Tailwind palette colour utility is a finding, because it bypasses the --aw-color-* token system', () => {
  const dirty = checkRawColour([{ file: 'x.astro', source: 'class="hover:bg-gray-100 dark:text-white"' }]);
  assert.equal(dirty.status, 'fail');
  assert.match(dirty.detail, /x\.astro/);

  const clean = checkRawColour([{ file: 'x.astro', source: 'class="hover:bg-surface text-heading"' }]);
  assert.equal(clean.status, 'pass');
});

test('a raw oklch() literal outside a token definition is a finding, but a --aw-color-* token definition using oklch() is not', () => {
  const dirty = checkRawColour([{ file: 'x.css', source: '::selection { background-color: oklch(88% 0.05 200); }' }]);
  assert.equal(dirty.status, 'fail');

  const clean = checkRawColour([{ file: 'x.css', source: ':root {\n  --aw-color-primary: oklch(45% 0.09 200);\n}' }]);
  assert.equal(clean.status, 'pass');
});

test('the checklist names the revision it was measured from', () => {
  assert.match(renderChecklist([], 'abc1234'), /^Generated-from: abc1234$/m);
});
