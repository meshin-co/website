import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readFontNames, pickFontFile } from './font-file.mjs';

function fakeTtf(names) {
  const records = [];
  let strings = Buffer.alloc(0);
  for (const [nameId, value] of names) {
    const encoded = Buffer.from(value, 'utf16le').swap16();
    const record = Buffer.alloc(12);
    record.writeUInt16BE(3, 0);
    record.writeUInt16BE(1, 2);
    record.writeUInt16BE(0x0409, 4);
    record.writeUInt16BE(nameId, 6);
    record.writeUInt16BE(encoded.length, 8);
    record.writeUInt16BE(strings.length, 10);
    records.push(record);
    strings = Buffer.concat([strings, encoded]);
  }
  const header = Buffer.alloc(6);
  header.writeUInt16BE(0, 0);
  header.writeUInt16BE(records.length, 2);
  header.writeUInt16BE(6 + records.length * 12, 4);
  const nameTable = Buffer.concat([header, ...records, strings]);

  const sfnt = Buffer.alloc(12 + 16);
  sfnt.writeUInt32BE(0x00010000, 0);
  sfnt.writeUInt16BE(1, 4);
  sfnt.write('name', 12, 'latin1');
  sfnt.writeUInt32BE(12 + 16, 20);
  sfnt.writeUInt32BE(nameTable.length, 24);
  return Buffer.concat([sfnt, nameTable]);
}

test('the family and subfamily are read out of the name table', () => {
  const buffer = fakeTtf([
    [1, 'Fraunces'],
    [2, 'Bold'],
  ]);

  assert.deepEqual(readFontNames(buffer), { family: 'Fraunces', subfamily: 'Bold' });
});

test('a font whose family already carries the style still reports both parts', () => {
  const buffer = fakeTtf([
    [1, 'Fraunces SemiBold'],
    [2, 'Regular'],
  ]);

  assert.deepEqual(readFontNames(buffer), { family: 'Fraunces SemiBold', subfamily: 'Regular' });
});

test('a buffer with no name table is rejected rather than guessed at', () => {
  assert.throws(() => readFontNames(Buffer.alloc(64)), /name table/);
});

test('picking a font matches on family and style words, ignoring case and order', () => {
  const files = [
    { path: 'a.ttf', names: { family: 'Fraunces SemiBold', subfamily: 'Regular' } },
    { path: 'b.ttf', names: { family: 'Fraunces', subfamily: 'Bold' } },
    { path: 'c.ttf', names: { family: 'IBM Plex Sans', subfamily: 'Regular' } },
  ];

  assert.equal(pickFontFile(files, 'Fraunces', 'SemiBold').path, 'a.ttf');
  assert.equal(pickFontFile(files, 'Fraunces', 'Bold').path, 'b.ttf');
  assert.equal(pickFontFile(files, 'IBM Plex Sans', 'Regular').path, 'c.ttf');
});

test('a family that is present but not in the wanted style is not silently substituted', () => {
  const files = [{ path: 'a.ttf', names: { family: 'Fraunces', subfamily: 'Bold' } }];

  assert.equal(pickFontFile(files, 'Fraunces', 'SemiBold'), undefined);
});
