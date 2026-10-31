import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { resourceNode } from './jsonld.mjs';
import { LICENSE_ID, licenseHasText, licenseTextPath, licenseTextShips } from './resource-license.mjs';

const SITE = 'https://meshin.co';
const SITE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const SPECIMEN = join(SITE_ROOT, 'tests/guard-mutations/fixtures/resource-license-without-text.md');

function siteRoot(licenses = {}) {
  const root = mkdtempSync(join(tmpdir(), 'resource-license-'));
  mkdirSync(join(root, 'public', 'licenses'), { recursive: true });
  for (const [id, text] of Object.entries(licenses)) writeFileSync(join(root, 'public', 'licenses', `${id}.txt`), text);
  return root;
}

test('an entry that declares no license needs no text', (t) => {
  const root = siteRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));

  assert.equal(licenseHasText({}, root), true);
  assert.equal(licenseHasText({ license: undefined }, root), true);
});

test('a declared license is backed by a file under public/licenses with readable text in it, and by nothing else', (t) => {
  const root = siteRoot({ MIT: 'MIT License\n\nCopyright (c) 2026 Holder\n', Empty: '', Blank: ' \n\t\n' });
  t.after(() => rmSync(root, { recursive: true, force: true }));

  assert.equal(licenseHasText({ license: 'MIT' }, root), true);
  assert.equal(licenseHasText({ license: 'Apache-2.0' }, root), false);
  assert.equal(licenseHasText({ license: 'Empty' }, root), false);
  assert.equal(licenseHasText({ license: 'Blank' }, root), false);
});

test('the text path is built from the id under public/licenses of the given root', () => {
  assert.equal(licenseTextPath('Apache-2.0', '/site'), '/site/public/licenses/Apache-2.0.txt');
});

test('text ships only when the file holds more than whitespace', (t) => {
  const root = siteRoot({ MIT: 'x' });
  t.after(() => rmSync(root, { recursive: true, force: true }));

  assert.equal(licenseTextShips('MIT', root), true);
  assert.equal(licenseTextShips('GPL-3.0', root), false);
});

test('a license id is a plain identifier, never a path or a sentence', () => {
  for (const id of ['MIT', 'Apache-2.0', 'CC-BY-4.0', 'GPL-3.0+']) {
    assert.equal(LICENSE_ID.test(id), true, id);
  }
  for (const id of ['', '../MIT', 'a/b', 'MIT License', '.MIT', '-MIT']) {
    assert.equal(LICENSE_ID.test(id), false, JSON.stringify(id));
  }
});

test('the planted specimen declares a valid id that no text backs, and the same id passes once text ships', (t) => {
  const id = readFileSync(SPECIMEN, 'utf8').match(/^license: (\S+)$/m)?.[1];
  assert.ok(id, 'fixture carries a license line');
  assert.equal(LICENSE_ID.test(id), true);
  assert.equal(licenseHasText({ license: id }, SITE_ROOT), false);

  const root = siteRoot({ [id]: 'licence text' });
  t.after(() => rmSync(root, { recursive: true, force: true }));
  assert.equal(licenseHasText({ license: id }, root), true);
});

test('a resource node carries license only when its entry declares one', () => {
  const base = { id: 'x', name: 'N', description: 'D.', version: '0.1' };

  assert.equal(resourceNode(SITE, { ...base, license: 'MIT' }).license, 'MIT');
  assert.equal(Object.hasOwn(resourceNode(SITE, base), 'license'), false);
});
