import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  brandLiteralPattern,
  discoverGatedFiles,
  escapeRegExp,
  findBrandLiterals,
  isGatedFile,
} from './brand-gate.mjs';

test('escapeRegExp neutralises the dot in a domain-shaped brand name', () => {
  const pattern = new RegExp(escapeRegExp('acme.io'));
  assert.equal(pattern.test('acmexio'), false);
  assert.equal(pattern.test('acme.io'), true);
});

test('brandLiteralPattern matches the brand name standing alone', () => {
  const pattern = brandLiteralPattern('acme.io');
  assert.equal(pattern.test('const name = "acme.io";'), true);
});

test('brandLiteralPattern matches the brand name embedded in an email or url', () => {
  assert.equal(brandLiteralPattern('acme.io').test('hello@acme.io'), true);
  assert.equal(brandLiteralPattern('acme.io').test('https://acme.io/about'), true);
});

test('brandLiteralPattern never matches a longer domain that merely starts with the brand name', () => {
  assert.equal(brandLiteralPattern('acme.io').test('acme.io.community'), false);
});

test('brandLiteralPattern never matches a personal handle that merely contains the brand word', () => {
  assert.equal(brandLiteralPattern('acme.io').test('cal.com/acme'), false);
  assert.equal(brandLiteralPattern('acme.io').test('github.com/acme-dev'), false);
});

test('brandLiteralPattern is case-insensitive, so a capitalised typo is still caught', () => {
  assert.equal(brandLiteralPattern('acme.io').test('Acme.IO'), true);
});

test('findBrandLiterals reports the 1-based line number and trimmed text of every hit', () => {
  const content = "const a = 1;\nconst ORG_NAME = 'acme.io';\nconst b = 2;";
  const findings = findBrandLiterals(content, brandLiteralPattern('acme.io'));
  assert.deepEqual(findings, [{ line: 2, text: "const ORG_NAME = 'acme.io';" }]);
});

test('findBrandLiterals reports every matching line, not only the first', () => {
  const content = "const a = 'acme.io';\nconst b = 'acme.io';";
  const findings = findBrandLiterals(content, brandLiteralPattern('acme.io'));
  assert.deepEqual(
    findings.map((f) => f.line),
    [1, 2]
  );
});

test('isGatedFile accepts an astro, ts or mjs source file under src or scripts', () => {
  assert.equal(isGatedFile('src/components/common/Metadata.astro'), true);
  assert.equal(isGatedFile('src/pages/og/[...slug].png.ts'), true);
  assert.equal(isGatedFile('scripts/jsonld-gate.mjs'), true);
});

test('isGatedFile excludes prose under src/data, where the brand legitimately appears in copy', () => {
  assert.equal(isGatedFile('src/data/home.ts'), false);
});

test('isGatedFile excludes every test file, since fixtures legitimately hardcode a stand-in value', () => {
  assert.equal(isGatedFile('src/utils/pipeline.test.mjs'), false);
  assert.equal(isGatedFile('scripts/brand-gate.test.mjs'), false);
});

test("isGatedFile excludes a file whose extension is outside the derive-don't-type surface", () => {
  assert.equal(isGatedFile('src/config.yaml'), false);
  assert.equal(isGatedFile('src/data/faq.json'), false);
});

test('discoverGatedFiles finds a planted literal in a fresh module under src, deriving the brand from config.yaml alone', () => {
  const root = mkdtempSync(join(tmpdir(), 'brand-gate-'));
  try {
    mkdirSync(join(root, 'src/utils'), { recursive: true });
    writeFileSync(join(root, 'src/config.yaml'), 'site:\n  name: acme.io\n  site: "https://acme.io"\n');
    writeFileSync(join(root, 'src/utils/broken.mjs'), "const name = 'acme.io';\n");
    const files = discoverGatedFiles(root);
    assert.ok(files.includes('src/utils/broken.mjs'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('discoverGatedFiles never surfaces a file under src/data or a test file', () => {
  const root = mkdtempSync(join(tmpdir(), 'brand-gate-'));
  try {
    mkdirSync(join(root, 'src/data'), { recursive: true });
    writeFileSync(join(root, 'src/config.yaml'), 'site:\n  name: acme.io\n  site: "https://acme.io"\n');
    writeFileSync(join(root, 'src/data/home.ts'), "export const brand = 'acme.io';\n");
    writeFileSync(join(root, 'src/data/home.test.mjs'), '// acme.io\n');
    const files = discoverGatedFiles(root);
    assert.equal(files.includes('src/data/home.ts'), false);
    assert.equal(files.includes('src/data/home.test.mjs'), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
