import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

import { parse } from 'yaml';

import { archiveSnapshot, standInKind } from '../src/utils/archive-url.mjs';
import { FAMILIES, manifestFamilies } from './mutation-smoke.mjs';

const FIXTURES = new URL('../tests/guard-mutations/fixtures/', import.meta.url);
const SCHEMA = readFileSync(new URL('../src/content.config.ts', import.meta.url), 'utf8');
const TOKEN = 'sources.0.original: must be the address that url stands in for';
const family = () => manifestFamilies(FAMILIES).find(({ id }) => id === 'source-original-must-match-its-stand-in');
const fixtureSource = () => {
  const text = readFileSync(new URL(family().fixture, FIXTURES), 'utf8');
  return parse(/^---\n([\s\S]*?)\n---/.exec(text)[1]).sources[0];
};

test('the smoke plants the source specimen in the glossary and expects the build to name the original field', () => {
  assert.deepEqual(
    { ...family(), slow: undefined },
    {
      id: 'source-original-must-match-its-stand-in',
      kind: 'build',
      proves: 'build',
      fixture: 'source-original-mismatch.md',
      control: ['source-original-mismatch-control.md'],
      plant: 'src/data/glossary',
      tokens: [TOKEN],
      slow: undefined,
    }
  );
  assert.ok(existsSync(new URL(family().fixture, FIXTURES)));
});

test('the token the smoke waits for is the message the schema refuses a stand-in with', () => {
  const message = TOKEN.slice(TOKEN.indexOf(': ') + 2);

  assert.ok(SCHEMA.includes(message), 'content.config.ts no longer says what the smoke row waits for');
  assert.ok(SCHEMA.includes("path: ['original']"));
});

test('the specimen row names an original that its url stands in for neither as a snapshot nor as a search', () => {
  const row = fixtureSource();

  assert.equal(typeof row.original, 'string');
  assert.notEqual(archiveSnapshot(row.url), null, 'the specimen url is meant to be a snapshot of some other page');
  assert.equal(standInKind(row), null);
});

test('the specimen is refused for its original alone: naming the page the snapshot captured makes it valid', () => {
  const row = fixtureSource();

  assert.equal(standInKind({ ...row, original: archiveSnapshot(row.url).original }), 'archive');
});
