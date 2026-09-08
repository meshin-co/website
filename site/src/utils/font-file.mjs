const FAMILY_NAME_ID = 1;
const SUBFAMILY_NAME_ID = 2;

function findNameTable(buffer) {
  const tableCount = buffer.readUInt16BE(4);
  for (let index = 0; index < tableCount; index += 1) {
    const record = 12 + index * 16;
    if (buffer.toString('latin1', record, record + 4) === 'name') return buffer.readUInt32BE(record + 8);
  }
  throw new Error('font-file: no name table in this font');
}

function decode(buffer, platformId, start, length) {
  const slice = buffer.subarray(start, start + length);
  return platformId === 3 ? Buffer.from(slice).swap16().toString('utf16le') : slice.toString('latin1');
}

export function readFontNames(buffer) {
  const table = findNameTable(buffer);
  const recordCount = buffer.readUInt16BE(table + 2);
  const stringOffset = buffer.readUInt16BE(table + 4);
  const found = {};

  for (let index = 0; index < recordCount; index += 1) {
    const record = table + 6 + index * 12;
    const platformId = buffer.readUInt16BE(record);
    const nameId = buffer.readUInt16BE(record + 6);
    if (nameId !== FAMILY_NAME_ID && nameId !== SUBFAMILY_NAME_ID) continue;

    const length = buffer.readUInt16BE(record + 8);
    const offset = buffer.readUInt16BE(record + 10);
    const value = decode(buffer, platformId, table + stringOffset + offset, length);
    if (nameId === FAMILY_NAME_ID) found.family ??= value;
    else found.subfamily ??= value;
  }

  return { family: found.family ?? '', subfamily: found.subfamily ?? '' };
}

const words = (text) =>
  text
    .toLowerCase()
    .split(/[\s-]+/)
    .filter(Boolean);

export function pickFontFile(files, family, style) {
  const wantedFamily = words(family);
  const wantedStyle = words(style);

  return files.find(({ names }) => {
    const present = new Set([...words(names.family), ...words(names.subfamily)]);
    return wantedFamily.every((word) => present.has(word)) && wantedStyle.every((word) => present.has(word));
  });
}
