import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { TAG_SLUGS } from '../src/data/tags.mjs';
import { listing, readText, routeList, sha256Of, tagSlugs } from './writer-tree.mjs';
import { WriterError } from './writer-error.mjs';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const made = [];

const treeWith = (files) => {
  const root = mkdtempSync(join(tmpdir(), 'writer-tree-'));
  made.push(root);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
};

after(() => {
  for (const root of made) rmSync(root, { recursive: true, force: true });
});

const configRefusal = (run, ...named) =>
  assert.throws(run, (error) => {
    assert.ok(error instanceof WriterError, 'the refusal is a WriterError');
    assert.equal(error.kind, 'config');
    for (const part of named) assert.ok(error.message.includes(part), `the message names ${part}: ${error.message}`);
    return true;
  });

test('sha256Of is the hex digest of the bytes or the text it is given', () => {
  const bytes = randomBytes(40);
  assert.equal(sha256Of(bytes), createHash('sha256').update(bytes).digest('hex'));
  assert.equal(sha256Of('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('readText reads a file under the root and names the path when it is absent', () => {
  const root = treeWith({ 'docs/a.md': 'hello\n' });
  assert.equal(readText(root, 'docs/a.md'), 'hello\n');
  configRefusal(() => readText(root, 'docs/missing.md'), 'docs/missing.md');
});

test('readText cannot be pointed outside the root', () => {
  const root = treeWith({ 'docs/a.md': 'x' });
  configRefusal(() => readText(root, '../outside.md'), '../outside.md');
  configRefusal(() => readText(root, '/etc/hosts'), '/etc/hosts');
});

test('listing returns the sorted names of the markdown files in a directory, without the extension', () => {
  const root = treeWith({ 'd/b.md': '', 'd/a.md': '', 'd/notes.txt': '', 'd/sub/c.md': '' });
  assert.deepEqual(listing(root, 'd'), ['a', 'b']);
  assert.deepEqual(listing(root, 'd/'), ['a', 'b']);
  configRefusal(() => listing(root, 'nowhere'), 'nowhere');
});

test('tagSlugs reads the slugs a tags file declares, in order, and equals the live vocabulary', () => {
  const root = treeWith({
    'site/src/data/tags.mjs':
      "export const TAGS = [\n  { slug: 'one-tag', name: 'One' },\n  { slug: 'two', name: 'Two' },\n];\n",
  });
  assert.deepEqual(tagSlugs(root), ['one-tag', 'two']);
  assert.deepEqual(tagSlugs(REPO), TAG_SLUGS);
});

test('a tags file with no slug is refused, naming the file', () => {
  const root = treeWith({ 'site/src/data/tags.mjs': 'export const TAGS = [];\n' });
  configRefusal(() => tagSlugs(root), 'site/src/data/tags.mjs');
});

test('routeList returns the routes of audits/routes.json and equals the live file', () => {
  const root = treeWith({ 'audits/routes.json': JSON.stringify(['/', '/faq']) });
  assert.deepEqual(routeList(root), ['/', '/faq']);
  assert.deepEqual(routeList(REPO), JSON.parse(readFileSync(join(REPO, 'audits/routes.json'), 'utf8')));
});

test('a route file that is not a list of strings is refused, naming the file', () => {
  for (const content of ['{"routes":[]}', '[1, 2]', '[]', 'not json']) {
    const root = treeWith({ 'audits/routes.json': content });
    configRefusal(() => routeList(root), 'audits/routes.json');
  }
});
