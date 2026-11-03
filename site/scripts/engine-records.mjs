import { posix } from 'node:path';

export const MEASURE_SCRIPT_PREFIX = 'site/scripts/measure-';

const RECORD_EXTENSION = /\.[^.]+$/;

export const measureScriptFor = (record) =>
  `${MEASURE_SCRIPT_PREFIX}${posix.basename(record).replace(RECORD_EXTENSION, '')}.mjs`;

export function recordProducer(record, files) {
  const script = measureScriptFor(record);
  return files.includes(script) ? script : null;
}
