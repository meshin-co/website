import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  MIRROR_FILE,
  mirrorProblems,
  publishedArtefacts,
  publishedFilesMarkdown,
  sha256Hex,
  specArtefacts,
} from './spec-artefacts.mjs';

const ENTRY = {
  filePath: 'src/data/spec/evals-baseline-1.0.md',
  data: { name: 'evals-baseline', version: '1.0' },
};
const EMPTY_DIGEST = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const ABC_DIGEST = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

function scratch() {
  const root = mkdtempSync(join(tmpdir(), 'spec-artefacts-'));
  const folder = join(root, 'src/data/spec/evals-baseline-1.0');
  mkdirSync(folder, { recursive: true });
  return { root, folder, done: () => rmSync(root, { recursive: true, force: true }) };
}

test('sha256Hex of the text abc is the published known answer', () => {
  assert.equal(sha256Hex(Buffer.from('abc')), ABC_DIGEST);
});

test('sha256Hex of no bytes is the published digest of the empty input', () => {
  assert.equal(sha256Hex(Buffer.alloc(0)), EMPTY_DIGEST);
});

test('an entry whose file has no folder next to it publishes nothing', () => {
  const { root, done } = scratch();
  const other = { filePath: 'src/data/spec/other-1.0.md', data: { name: 'other', version: '1.0' } };
  assert.deepEqual(specArtefacts(other, { root }), []);
  done();
});

test('each file in the folder is published at the version address, in name order, with the digest of its bytes', () => {
  const { root, folder, done } = scratch();
  writeFileSync(join(folder, 'vectors.json'), 'abc');
  writeFileSync(join(folder, 'baseline.schema.json'), '');
  const found = specArtefacts(ENTRY, { root });
  assert.deepEqual(
    found.map(({ file, path, mediaType, sha256, size }) => ({ file, path, mediaType, sha256, size })),
    [
      {
        file: 'baseline.schema.json',
        path: '/spec/evals-baseline/1.0/baseline.schema.json',
        mediaType: 'application/json',
        sha256: EMPTY_DIGEST,
        size: 0,
      },
      {
        file: 'vectors.json',
        path: '/spec/evals-baseline/1.0/vectors.json',
        mediaType: 'application/json',
        sha256: ABC_DIGEST,
        size: 3,
      },
    ]
  );
  assert.equal(found[1].bytes.toString(), 'abc');
  done();
});

test('the digest and the served bytes are those of the file as stored, not of a re-serialisation', () => {
  const { root, folder, done } = scratch();
  const stored = '{ "a" :   1 }\r\n';
  writeFileSync(join(folder, 'vectors.json'), stored);
  const [found] = specArtefacts(ENTRY, { root });
  assert.equal(found.bytes.toString('latin1'), stored);
  assert.equal(found.sha256, sha256Hex(Buffer.from(stored)));
  done();
});

test('a file whose extension has no media type is refused, not served as a guess', () => {
  const { root, folder, done } = scratch();
  writeFileSync(join(folder, 'vectors.bin'), 'abc');
  assert.throws(() => specArtefacts(ENTRY, { root }), /vectors\.bin.*media type/);
  done();
});

test('a directory inside the folder is refused, not skipped', () => {
  const { root, folder, done } = scratch();
  mkdirSync(join(folder, 'nested'));
  assert.throws(() => specArtefacts(ENTRY, { root }), /nested.*not a file/);
  done();
});

test('the mirror declaration is read but never published', () => {
  const { root, folder, done } = scratch();
  writeFileSync(join(folder, 'vectors.json'), 'abc');
  writeFileSync(join(folder, MIRROR_FILE), '{}');
  assert.deepEqual(
    specArtefacts(ENTRY, { root }).map(({ file }) => file),
    ['vectors.json']
  );
  done();
});

function mirrored({ stored = 'abc', upstream = 'abc', declaration } = {}) {
  const { root, folder, done } = scratch();
  const checkout = join(root, 'upstream');
  mkdirSync(join(checkout, 'fixtures'), { recursive: true });
  if (upstream !== null) writeFileSync(join(checkout, 'fixtures/vectors.json'), upstream);
  if (stored !== null) writeFileSync(join(folder, 'vectors.json'), stored);
  const body = declaration ?? { 'vectors.json': { checkout: 'upstream', path: 'fixtures/vectors.json' } };
  writeFileSync(join(folder, MIRROR_FILE), typeof body === 'string' ? body : JSON.stringify(body));
  return { root, folder, checkout, done };
}

test('a folder that declares no mirror has nothing to compare', () => {
  const { root, folder, done } = scratch();
  writeFileSync(join(folder, 'vectors.json'), 'abc');
  assert.deepEqual(mirrorProblems(ENTRY, { root }), []);
  done();
});

test('a copy equal to its upstream file is current', () => {
  const { root, done } = mirrored();
  assert.deepEqual(mirrorProblems(ENTRY, { root }), []);
  done();
});

test('a copy that differs by one byte is stale, and the problem prints both digests and the command that refreshes it', () => {
  const { root, folder, checkout, done } = mirrored({ stored: 'abc', upstream: 'abd' });
  const problems = mirrorProblems(ENTRY, { root });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /vectors\.json is not the upstream file/);
  assert.ok(problems[0].includes(`cp ${join(checkout, 'fixtures/vectors.json')} ${join(folder, 'vectors.json')}`));
  assert.ok(problems[0].includes(sha256Hex(Buffer.from('abc'))));
  assert.ok(problems[0].includes(sha256Hex(Buffer.from('abd'))));
  done();
});

test('a checkout that is not on this machine is not a problem, because a clone of this repository alone cannot compare', () => {
  const { root, done } = mirrored({
    declaration: { 'vectors.json': { checkout: 'no-such-checkout', path: 'fixtures/vectors.json' } },
  });
  assert.deepEqual(mirrorProblems(ENTRY, { root }), []);
  done();
});

test('a checkout that is here but holds no such file is a problem, because the layout moved and the comparison would be empty', () => {
  const { root, done } = mirrored({ upstream: null });
  const problems = mirrorProblems(ENTRY, { root });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /holds no fixtures\/vectors\.json/);
  done();
});

test('a declared file that is not in the folder is a problem', () => {
  const { root, done } = mirrored({ stored: null });
  const problems = mirrorProblems(ENTRY, { root });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /declares vectors\.json.*not in the folder/);
  done();
});

for (const [label, declaration] of [
  ['not JSON', '{'],
  ['a list', []],
  ['an entry that is not an object', { 'vectors.json': 'upstream' }],
  ['an entry without a checkout', { 'vectors.json': { path: 'fixtures/vectors.json' } }],
  ['an entry without a path', { 'vectors.json': { checkout: 'upstream' } }],
  ['an entry whose checkout is not text', { 'vectors.json': { checkout: 1, path: 'fixtures/vectors.json' } }],
]) {
  test(`a mirror declaration that is ${label} is a problem, never a silent skip`, () => {
    const { root, done } = mirrored({ declaration });
    const problems = mirrorProblems(ENTRY, { root });
    assert.equal(problems.length, 1);
    assert.match(problems[0], new RegExp(MIRROR_FILE.replace('.', '\\.')));
    done();
  });
}

test('every file a declaration names is checked, and every stale one is reported', () => {
  const { root, folder, checkout, done } = mirrored({
    declaration: {
      'vectors.json': { checkout: 'upstream', path: 'fixtures/vectors.json' },
      'baseline.schema.json': { checkout: 'upstream', path: 'fixtures/schema.json' },
    },
    upstream: 'abd',
  });
  writeFileSync(join(folder, 'baseline.schema.json'), 'x');
  writeFileSync(join(checkout, 'fixtures/schema.json'), 'y');
  assert.equal(mirrorProblems(ENTRY, { root }).length, 2);
  done();
});

test('the sidecar block lists every file with its absolute address, its media type and the digest of its bytes', () => {
  const { root, folder, done } = scratch();
  writeFileSync(join(folder, 'vectors.json'), 'abc');
  const block = publishedFilesMarkdown({ site: 'https://meshin.co', artefacts: specArtefacts(ENTRY, { root }) });
  assert.match(block, /^## Published files\n/);
  assert.ok(block.includes('[vectors.json](https://meshin.co/spec/evals-baseline/1.0/vectors.json)'));
  assert.ok(block.includes('`application/json`'));
  assert.ok(block.includes(`SHA-256 \`${ABC_DIGEST}\``));
  done();
});

test('a version that publishes no file gets no block', () => {
  assert.equal(publishedFilesMarkdown({ site: 'https://meshin.co', artefacts: [] }), '');
});

test('publishedArtefacts returns the files of a version whose mirrors are current', () => {
  const { root, done } = mirrored();
  assert.deepEqual(
    publishedArtefacts(ENTRY, { root }).map(({ file }) => file),
    ['vectors.json']
  );
  done();
});

test('publishedArtefacts refuses a stale mirror and names the entry and the command that refreshes it', () => {
  const { root, folder, checkout, done } = mirrored({ stored: 'abc', upstream: 'abd' });
  assert.throws(
    () => publishedArtefacts(ENTRY, { root }),
    (error) =>
      error.message.includes(ENTRY.filePath) &&
      error.message.includes(`cp ${join(checkout, 'fixtures/vectors.json')} ${join(folder, 'vectors.json')}`)
  );
  done();
});

test('publishedArtefacts refuses every problem at once, not the first', () => {
  const { root, folder, checkout, done } = mirrored({
    declaration: {
      'vectors.json': { checkout: 'upstream', path: 'fixtures/vectors.json' },
      'baseline.schema.json': { checkout: 'upstream', path: 'fixtures/schema.json' },
    },
    upstream: 'abd',
  });
  writeFileSync(join(folder, 'baseline.schema.json'), 'x');
  writeFileSync(join(checkout, 'fixtures/schema.json'), 'y');
  assert.throws(
    () => publishedArtefacts(ENTRY, { root }),
    (error) => error.message.includes('vectors.json is not') && error.message.includes('baseline.schema.json is not')
  );
  done();
});
