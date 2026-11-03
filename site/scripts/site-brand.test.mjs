import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';

import { SITE_CONFIG, autowriterAgent, siteBrand } from './site-brand.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');

test('the site config is found from this directory, not from the working directory', () => {
  assert.equal(existsSync(SITE_CONFIG), true);
  assert.equal(siteBrand().name.length > 0, true);
});

test('a script reading the brand works when it is run from the repository root', () => {
  const read = "import('./site/scripts/site-brand.mjs').then((m) => process.stdout.write(m.siteBrand().name))";
  const fromRoot = execFileSync(process.execPath, ['-e', read], { cwd: REPO_ROOT, encoding: 'utf8' });
  assert.equal(fromRoot, siteBrand().name);
});

test('the brand resolves the same from any other working directory', () => {
  const read =
    "import('" +
    resolve(import.meta.dirname, 'site-brand.mjs') +
    "').then((m) => process.stdout.write(m.siteBrand().name))";
  const elsewhere = execFileSync(process.execPath, ['-e', read], { cwd: dirname(REPO_ROOT), encoding: 'utf8' });
  assert.equal(elsewhere, siteBrand().name);
});

test('the autowriter names itself after the first label of the brand host, so a GitHub log says whose it is', () => {
  assert.equal(autowriterAgent({ name: 'field-notes.example' }), 'field-notes-autowriter');
  assert.equal(autowriterAgent({ name: 'acme.co.uk' }), 'acme-autowriter');
  assert.equal(autowriterAgent({ name: 'acme' }), 'acme-autowriter');
});

test('the autowriter agent follows the brand on disk when no brand is given', () => {
  assert.equal(autowriterAgent(), `${siteBrand().name.split('.')[0]}-autowriter`);
});
