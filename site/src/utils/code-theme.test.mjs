import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const MINIMUM_CONTRAST = 4.5;
const TOKENS = ['comment', 'keyword', 'string', 'constant', 'entity', 'tag', 'variable', 'deleted'].map(
  (name) => `code-${name}`
);
const THEMES = [
  ['light', ':root'],
  ['dark', '\\.dark'],
];

function linearSrgb(oklch) {
  const [, lightness, chroma, hue] = /oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)/.exec(oklch).map(Number);
  const a = chroma * Math.cos((hue * Math.PI) / 180);
  const b = chroma * Math.sin((hue * Math.PI) / 180);
  const l = (lightness / 100 + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness / 100 - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness / 100 - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((channel) => Math.min(1, Math.max(0, channel)));
}

const luminance = (oklch) => {
  const [red, green, blue] = linearSrgb(oklch);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

const contrastRatio = (foreground, background) => {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
};

const declarations = (css, selector) => {
  const body = new RegExp(`(?:^|\\n)${selector}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
  return Object.fromEntries(
    [...body.matchAll(/--aw-color-([a-z0-9-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value])
  );
};

const readStyle = (name) => readFile(new URL(`../assets/styles/${name}`, import.meta.url), 'utf8');

const stylesheet = await readStyle('tailwind.css');
const codeRules = await readStyle('code.css');

for (const [theme, selector] of THEMES) {
  const colours = declarations(stylesheet, selector);

  test(`the ${theme} theme declares every code token as OKLCH`, () => {
    for (const token of TOKENS) assert.match(colours[token] ?? '', /^oklch\(/, `--aw-color-${token}`);
  });

  test(`every code token reads at ${MINIMUM_CONTRAST}:1 on the ${theme} code block surface`, () => {
    for (const token of TOKENS) {
      const ratio = contrastRatio(colours[token], colours.surface);
      assert.ok(ratio >= MINIMUM_CONTRAST, `--aw-color-${token} is ${ratio.toFixed(2)}:1 on the ${theme} surface`);
    }
  });
}

test('the contrast check can fail: a mid grey on the light surface is refused', () => {
  const light = declarations(stylesheet, ':root');

  assert.ok(contrastRatio('oklch(60% 0 0)', light.surface) < MINIMUM_CONTRAST);
});

test('the highlight rules read only tokens the theme declares', () => {
  const used = new Set([...codeRules.matchAll(/var\(--aw-color-(code-[a-z]+)\)/g)].map(([, name]) => name));

  assert.deepEqual([...used].sort(), [...TOKENS].sort());
});

test('tailwind.css imports the code stylesheet', () => {
  assert.match(stylesheet, /^@import '\.\/code\.css';$/m);
});
