import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';

import yaml from 'js-yaml';

import { LICENSE_ID, licenseHasText, licenseTextPath } from './resource-license.mjs';

const SITE_ROOT = join(import.meta.dirname, '..', '..');
const RESOURCE_DIR = join(SITE_ROOT, 'src', 'data', 'resource');
const CC_BY = 'CC-BY-4.0';

const frontmatterOf = (raw) => yaml.load(/^---\n([\s\S]*?)\n---/.exec(raw)[1]);
const names = (await readdir(RESOURCE_DIR)).filter((name) => name.endsWith('.md')).sort();
const entries = await Promise.all(
  names.map(async (name) => ({ name, data: frontmatterOf(await readFile(join(RESOURCE_DIR, name), 'utf8')) }))
);

test('the check reads the resource entries, so a pass is never an empty loop', () => {
  assert.ok(entries.length > 0, `found ${entries.length} resource entries under ${RESOURCE_DIR}`);
});

test('every resource entry declares a license id and the text behind it ships', () => {
  for (const { name, data } of entries) {
    assert.equal(typeof data.license, 'string', `${name} declares no license`);
    assert.equal(LICENSE_ID.test(data.license), true, `${name}: ${data.license} is not a license id`);
    assert.equal(
      licenseHasText(data, SITE_ROOT),
      true,
      `${name}: no text at ${licenseTextPath(data.license, SITE_ROOT)}`
    );
  }
});

test('the CC BY 4.0 text that ships is the whole legal code, not a stub', async () => {
  const text = await readFile(licenseTextPath(CC_BY, SITE_ROOT), 'utf8');

  assert.match(text, /^Attribution 4\.0 International\n/);
  assert.match(text, /Section 1 -- Definitions\./);
  assert.match(text, /Section 8 -- Interpretation\./);
  assert.match(text, /Creative Commons may be contacted at creativecommons\.org\.\s*$/);
  assert.ok(text.length > 15000, `${text.length} characters`);
});

const UPSTREAM_NOTICE = 'Copyright (c) 2023 onWidget';
const PERMISSION_START = 'Permission is hereby granted, free of charge';
const PERMISSION_END = 'SOFTWARE.\n';
const CC_BY_TEXT_PATH = 'public/licenses/CC-BY-4.0.txt';

const engineConfig = JSON.parse(await readFile(join(SITE_ROOT, 'engine.config.json'), 'utf8'));
const authorEntry = join(SITE_ROOT, 'src', 'data', 'author', `${engineConfig.content.formats.article.author}.md`);
const owner = frontmatterOf(await readFile(authorEntry, 'utf8')).name;
const grant = await readFile(join(SITE_ROOT, 'LICENSE.md'), 'utf8');

const holderLines = (text) => text.split('\n').filter((line) => /^Copyright \(c\) \d{4} /.test(line));

function grantProblems(text) {
  const upstream = text.indexOf(UPSTREAM_NOTICE);
  const permission = text.indexOf(PERMISSION_START);
  return [
    ...(holderLines(text).some((line) => line.includes(owner)) ? [] : ['the holder is not named']),
    ...(upstream === -1 ? ['the upstream notice is gone'] : []),
    ...(permission === -1 ? ['the permission text is gone'] : []),
    ...(upstream !== -1 && permission !== -1 && upstream > permission
      ? ['the upstream notice sits below the permission text']
      : []),
    ...(text.includes(CC_BY_TEXT_PATH) ? [] : ['the resources are not pointed at their licence text']),
  ];
}

test('site/LICENSE.md grants the code in the name of the site author, keeps the upstream notice above the permission text and points the resources at their licence text', () => {
  assert.deepEqual(grantProblems(grant), []);
});

test('the grant check names each defect it exists to catch, the theme grant standing alone included', () => {
  const permissionText = grant.slice(
    grant.indexOf(PERMISSION_START),
    grant.indexOf(PERMISSION_END) + PERMISSION_END.length
  );
  const withoutUpstream = grant.replace(`${UPSTREAM_NOTICE}\n\n`, '');
  const planted = [
    [
      `MIT License\n\n${UPSTREAM_NOTICE}\n\n${permissionText}`,
      ['the holder is not named', 'the resources are not pointed at their licence text'],
    ],
    [withoutUpstream, ['the upstream notice is gone']],
    [grant.replace(PERMISSION_START, 'Anyone may do anything'), ['the permission text is gone']],
    [`${withoutUpstream}\n${UPSTREAM_NOTICE}\n`, ['the upstream notice sits below the permission text']],
    [grant.replaceAll(CC_BY_TEXT_PATH, 'elsewhere'), ['the resources are not pointed at their licence text']],
  ];
  for (const [text, problems] of planted) {
    assert.notEqual(text, grant);
    assert.deepEqual(grantProblems(text), problems);
  }
});
