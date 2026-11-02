import { crc32, deflateRawSync } from 'node:zlib';

const STORED = 0;
const DEFLATED = 8;
const LOCAL = 0x04034b50;
const CENTRAL = 0x02014b50;
const END = 0x06054b50;
const DESCRIPTOR_FLAG = 0x08;

const localHeader = ({ nameBytes, method, flags, crc, compressed, size }) => {
  const header = Buffer.alloc(30 + nameBytes.length);
  header.writeUInt32LE(LOCAL, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(flags, 6);
  header.writeUInt16LE(method, 8);
  const described = (flags & DESCRIPTOR_FLAG) !== 0;
  header.writeUInt32LE(described ? 0 : crc, 14);
  header.writeUInt32LE(described ? 0 : compressed, 18);
  header.writeUInt32LE(described ? 0 : size, 22);
  header.writeUInt16LE(nameBytes.length, 26);
  nameBytes.copy(header, 30);
  return header;
};

const centralHeader = ({ nameBytes, method, flags, crc, compressed, size, offset }) => {
  const header = Buffer.alloc(46 + nameBytes.length);
  header.writeUInt32LE(CENTRAL, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(flags, 8);
  header.writeUInt16LE(method, 10);
  header.writeUInt32LE(crc, 16);
  header.writeUInt32LE(compressed, 20);
  header.writeUInt32LE(size, 24);
  header.writeUInt16LE(nameBytes.length, 28);
  header.writeUInt32LE(offset, 42);
  nameBytes.copy(header, 46);
  return header;
};

const descriptor = ({ crc, compressed, size }) => {
  const block = Buffer.alloc(16);
  block.writeUInt32LE(0x08074b50, 0);
  block.writeUInt32LE(crc, 4);
  block.writeUInt32LE(compressed, 8);
  block.writeUInt32LE(size, 12);
  return block;
};

export function buildZip(entries, { comment = '' } = {}) {
  const parts = [];
  const central = [];
  let offset = 0;
  for (const { name, data, method = DEFLATED, descriptor: described = false, crcOverride } of entries) {
    const raw = Buffer.from(data);
    const body = method === DEFLATED ? deflateRawSync(raw) : raw;
    const meta = {
      nameBytes: Buffer.from(name),
      method,
      flags: described ? DESCRIPTOR_FLAG : 0,
      crc: crcOverride ?? crc32(raw),
      compressed: body.length,
      size: raw.length,
      offset,
    };
    const pieces = [localHeader(meta), body, ...(described ? [descriptor(meta)] : [])];
    for (const piece of pieces) {
      parts.push(piece);
      offset += piece.length;
    }
    central.push(centralHeader(meta));
  }
  const directory = Buffer.concat(central);
  const commentBytes = Buffer.from(comment);
  const end = Buffer.alloc(22 + commentBytes.length);
  end.writeUInt32LE(END, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(commentBytes.length, 20);
  commentBytes.copy(end, 22);
  return Buffer.concat([...parts, directory, end]);
}

export { DEFLATED, STORED };
