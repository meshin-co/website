import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DEFLATED, STORED, buildZip } from './fixtures/zip-writer.mjs';
import { ZipError, readZip } from './repair-zip.mjs';

const text = (entries) => Object.fromEntries(entries.map(({ name, data }) => [name, data.toString('utf8')]));

test('reads stored and deflated entries byte for byte', () => {
  const zip = buildZip([
    { name: 'gate-content.json', data: '{"a":1}', method: DEFLATED },
    { name: 'gate-human.json', data: '{"b":2}', method: STORED },
  ]);
  assert.deepEqual(text(readZip(zip)), { 'gate-content.json': '{"a":1}', 'gate-human.json': '{"b":2}' });
});

test('reads an entry whose sizes sit in a data descriptor, as the artifact service writes them', () => {
  const zip = buildZip([{ name: 'gate-content.json', data: '{"c":3}', descriptor: true }]);
  assert.deepEqual(text(readZip(zip)), { 'gate-content.json': '{"c":3}' });
});

test('reads an archive that carries a trailing comment', () => {
  const zip = buildZip([{ name: 'a.json', data: '{}' }], { comment: 'made by a test' });
  assert.deepEqual(text(readZip(zip)), { 'a.json': '{}' });
});

test('refuses bytes that are not an archive', () => {
  assert.throws(() => readZip(Buffer.from('<html>not a zip</html>')), ZipError);
  assert.throws(() => readZip(Buffer.alloc(0)), ZipError);
});

test('refuses an entry whose checksum does not match its bytes', () => {
  const zip = buildZip([{ name: 'a.json', data: '{"ok":true}', crcOverride: 123 }]);
  assert.throws(() => readZip(zip), { name: 'ZipError', message: /checksum/ });
});

test('refuses a compression method it does not implement', () => {
  const zip = buildZip([{ name: 'a.json', data: '{}', method: STORED }]);
  zip.writeUInt16LE(12, zip.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02])) + 10);
  assert.throws(() => readZip(zip), { name: 'ZipError', message: /method 12/ });
});

test('refuses a name that would climb out of a directory or start at the root', () => {
  for (const name of ['../gate.json', '/gate.json', 'a/../../gate.json', 'a\\b.json']) {
    assert.throws(() => readZip(buildZip([{ name, data: '{}' }])), { name: 'ZipError', message: /name/ }, name);
  }
});

test('refuses an entry that inflates past the size cap, so a small archive cannot fill the runner', () => {
  const zip = buildZip([{ name: 'bomb.json', data: Buffer.alloc(3 * 1024 * 1024, 0x20) }]);
  assert.throws(() => readZip(zip, { maxBytes: 1024 * 1024 }), { name: 'ZipError', message: /larger than/ });
});

test('refuses an archive with more entries than the cap', () => {
  const entries = Array.from({ length: 5 }, (_, at) => ({ name: `f${at}.json`, data: '{}' }));
  assert.throws(() => readZip(buildZip(entries), { maxEntries: 4 }), { name: 'ZipError', message: /5 entries/ });
});
