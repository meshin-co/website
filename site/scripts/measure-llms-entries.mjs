import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  LARGEST_MEASURED_ENTRY_BYTES,
  LLMS_COLLECTIONS,
  LLMS_FILE_MAX_BYTES,
  LLMS_SHARD_FRAME_BYTES,
  LLMS_SHARD_MAX_ENTRIES,
} from '../src/utils/llms-collections.mjs';
import { invokedDirectly } from './invoked-directly.mjs';

const USAGE = 'usage: node scripts/measure-llms-entries.mjs <dist directory>';

const ENTRY_START = /^# [^\n]*\n\n(?:\d{4}-\d{2}-\d{2}[^\n]*\n\n)?\[([^\]\n]+)\]\(\1\)(?=\n|$)/gm;
const CLOSING = /(?<=\n\n---\n\n)(?:This is the last part\.|Next part: [^\n]*)\n$/;

const collectionOf = (fileName) => fileName.replace(/\.txt$/, '').replace(/-\d+$/, '');

const entryBytes = (text) => {
  const starts = [...text.matchAll(ENTRY_START)].map(({ index }) => index);
  return starts.map((start, position) =>
    Buffer.byteLength(text.slice(start, starts[position + 1]).replace(CLOSING, ''))
  );
};

const summarise = (sizes) => ({
  entries: sizes.length,
  largest: sizes.length === 0 ? 0 : Math.max(...sizes),
  mean: sizes.length === 0 ? 0 : Math.floor(sizes.reduce((sum, size) => sum + size, 0) / sizes.length),
});

export function measureLlmsEntries(filesByName) {
  const sizes = Object.fromEntries(LLMS_COLLECTIONS.map(({ name }) => [name, []]));
  for (const [fileName, text] of Object.entries(filesByName)) {
    sizes[collectionOf(fileName)]?.push(...entryBytes(text));
  }
  return Object.fromEntries(Object.entries(sizes).map(([name, bytes]) => [name, summarise(bytes)]));
}

const capForLargest = (largest) =>
  largest === 0 ? '-' : Math.floor((LLMS_FILE_MAX_BYTES - LLMS_SHARD_FRAME_BYTES) / largest);

const verdict = ({ entries, largest }, record) => {
  if (entries === 0) return 'no entry measured';
  if (record === undefined) return 'no record on file';
  return largest > record
    ? `grew past the record, largest ${largest} against ${record}`
    : `within the record, largest ${largest} against ${record}`;
};

const HEADER = ['collection', 'entries', 'largest', 'mean', 'record', 'cap', 'cap at largest'];

function renderMeasurement(measured) {
  const rows = LLMS_COLLECTIONS.map(({ name }) => {
    const { entries, largest, mean } = measured[name];
    const record = LARGEST_MEASURED_ENTRY_BYTES[name];
    const measuredOrDash = (value) => (entries === 0 ? '-' : value);
    return [
      name,
      entries,
      measuredOrDash(largest),
      measuredOrDash(mean),
      record ?? '-',
      LLMS_SHARD_MAX_ENTRIES[name],
      capForLargest(largest),
    ].map(String);
  });
  const widths = HEADER.map((title, column) => Math.max(title.length, ...rows.map((row) => row[column].length)));
  const line = (cells) =>
    cells
      .map((cell, column) => cell.padEnd(widths[column]))
      .join('  ')
      .trimEnd();
  return [
    line(HEADER),
    ...rows.map(line),
    '',
    ...LLMS_COLLECTIONS.map(({ name }) => `${name}: ${verdict(measured[name], LARGEST_MEASURED_ENTRY_BYTES[name])}`),
  ];
}

function readLlmsFiles(distDir) {
  const directory = join(distDir, 'llms');
  if (!existsSync(directory)) return null;
  return Object.fromEntries(
    readdirSync(directory)
      .filter((fileName) => fileName.endsWith('.txt'))
      .sort()
      .map((fileName) => [fileName, readFileSync(join(directory, fileName), 'utf8')])
  );
}

function main(argv) {
  if (argv.length !== 1) {
    console.error(USAGE);
    process.exitCode = 2;
    return;
  }
  const distDir = resolve(argv[0]);
  const files = readLlmsFiles(distDir);
  if (files === null) {
    console.error(`MEASURE-LLMS no llms directory under ${distDir}`);
    process.exitCode = 2;
    return;
  }
  for (const line of renderMeasurement(measureLlmsEntries(files))) console.log(line);
}

if (invokedDirectly(import.meta.filename, process.argv[1])) main(process.argv.slice(2));
