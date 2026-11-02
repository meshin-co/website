import { crc32, inflateRawSync } from 'node:zlib';

export class ZipError extends Error {
  name = 'ZipError';
}

const LOCAL = 0x04034b50;
const CENTRAL = 0x02014b50;
const END = 0x06054b50;
const END_MINIMUM = 22;
const END_SEARCH = END_MINIMUM + 0xffff;
const LOCAL_FIXED = 30;
const CENTRAL_FIXED = 46;
const STORED = 0;
const DEFLATED = 8;
const ZIP64 = 0xffffffff;
const DEFAULT_MAX_BYTES = 8 * 1024 * 1024;
const DEFAULT_MAX_ENTRIES = 64;

const fail = (message) => {
  throw new ZipError(message);
};

function endOfDirectory(buffer) {
  const from = Math.max(0, buffer.length - END_SEARCH);
  for (let at = buffer.length - END_MINIMUM; at >= from; at -= 1) {
    if (buffer.readUInt32LE(at) === END) return at;
  }
  return fail('the bytes are not a zip archive: no end of central directory');
}

function checkedName(name) {
  const climbs = name.split('/').includes('..');
  if (name === '' || name.includes('\\') || name.includes('\0') || name.startsWith('/') || climbs)
    fail(`the entry name ${JSON.stringify(name)} is not a plain relative name`);
  return name;
}

function readDirectory(buffer, maxEntries) {
  const end = endOfDirectory(buffer);
  const count = buffer.readUInt16LE(end + 10);
  const size = buffer.readUInt32LE(end + 12);
  const offset = buffer.readUInt32LE(end + 16);
  if (count > maxEntries) fail(`the archive holds ${count} entries, more than the ${maxEntries} allowed`);
  if (offset + size > end) fail('the central directory runs past the end of the archive');
  const entries = [];
  let at = offset;
  for (let index = 0; index < count; index += 1) {
    if (buffer.readUInt32LE(at) !== CENTRAL) fail(`central directory entry ${index} is damaged`);
    const nameLength = buffer.readUInt16LE(at + 28);
    const entry = {
      method: buffer.readUInt16LE(at + 10),
      crc: buffer.readUInt32LE(at + 16),
      compressed: buffer.readUInt32LE(at + 20),
      size: buffer.readUInt32LE(at + 24),
      local: buffer.readUInt32LE(at + 42),
      name: checkedName(buffer.toString('utf8', at + CENTRAL_FIXED, at + CENTRAL_FIXED + nameLength)),
    };
    if ([entry.compressed, entry.size, entry.local].includes(ZIP64)) fail('zip64 archives are not supported');
    entries.push(entry);
    at += CENTRAL_FIXED + nameLength + buffer.readUInt16LE(at + 30) + buffer.readUInt16LE(at + 32);
  }
  return entries;
}

function dataOf(buffer, entry, allowed) {
  const { local, name, method } = entry;
  if (buffer.readUInt32LE(local) !== LOCAL) fail(`the local header of ${name} is damaged`);
  const start = local + LOCAL_FIXED + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
  const packed = buffer.subarray(start, start + entry.compressed);
  if (packed.length !== entry.compressed) fail(`${name} is cut short`);
  if (entry.size > allowed) fail(`${name} is larger than the ${allowed} bytes left to read`);
  if (method === STORED) return Buffer.from(packed);
  if (method !== DEFLATED) return fail(`${name} uses compression method ${method}, which is not supported`);
  try {
    return inflateRawSync(packed, { maxOutputLength: allowed });
  } catch (error) {
    if (error.code === 'ERR_BUFFER_TOO_LARGE') return fail(`${name} is larger than the ${allowed} bytes left to read`);
    return fail(`${name} does not inflate: ${error.message}`);
  }
}

export function readZip(buffer, { maxBytes = DEFAULT_MAX_BYTES, maxEntries = DEFAULT_MAX_ENTRIES } = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length < END_MINIMUM) fail('the bytes are not a zip archive: too short');
  let remaining = maxBytes;
  const files = [];
  for (const entry of readDirectory(buffer, maxEntries)) {
    if (entry.name.endsWith('/')) continue;
    const data = dataOf(buffer, entry, remaining);
    if (data.length !== entry.size || crc32(data) !== entry.crc) fail(`${entry.name} fails its checksum`);
    remaining -= data.length;
    files.push({ name: entry.name, data });
  }
  return files;
}
