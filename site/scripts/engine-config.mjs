import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describeProblem, readSchema } from './autowriter-records.mjs';
import { consistencyProblems, matchRoute } from './engine-config-checks.mjs';
import { validateJsonSchema } from './json-schema.mjs';

export { matchRoute };

export const ENGINE_CONFIG_FILE = resolve(import.meta.dirname, '..', 'engine.config.json');
export const ENGINE_SCHEMA = readSchema('engine-config.schema.json');

export class EngineConfigError extends Error {
  constructor(file, problems) {
    super(problems.map((found) => `${file}: ${describeProblem(found)}`).join('; '));
    this.name = 'EngineConfigError';
    this.file = file;
    this.fields = problems.map(({ path }) => path.replace(/^\$\.?/, '')).filter(Boolean);
  }
}

function deepFreeze(value) {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

export function inspectEngineConfig(text) {
  let value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    return { config: null, problems: [{ path: '$', problem: `is not valid JSON (${error.message})` }] };
  }
  const problems = validateJsonSchema(ENGINE_SCHEMA, value);
  if (problems.length === 0) problems.push(...consistencyProblems(value));
  return { config: problems.length === 0 ? deepFreeze(value) : null, problems };
}

export function readEngineConfig(file = ENGINE_CONFIG_FILE) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch (error) {
    const reason = `cannot be read (${error.code ?? error.message}); npm run gate:engine lists what it must hold`;
    throw new EngineConfigError(file, [{ path: '$', problem: reason }]);
  }
  const { config, problems } = inspectEngineConfig(text);
  if (config === null) throw new EngineConfigError(file, problems);
  return config;
}
