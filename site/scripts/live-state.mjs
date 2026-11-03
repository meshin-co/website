import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { isUtcInstant } from './spend-sum.mjs';

export const FIRST_RUN_WINDOW_MS = 48 * 60 * 60 * 1000;

const SHAPE = 'must be a JSON object with one key, "announced"';
const MAP = '"announced" must map each route to the UTC instant it was announced';

export class StateError extends Error {}

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const byText = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

function problemOf(value) {
  if (!isObject(value) || Object.keys(value).join() !== 'announced') return SHAPE;
  if (!isObject(value.announced)) return MAP;
  for (const [route, instant] of Object.entries(value.announced)) {
    if (!route.startsWith('/')) return `${JSON.stringify(route)} is not a route`;
    if (!isUtcInstant(instant)) return `${JSON.stringify(route)}: ${JSON.stringify(instant)} is not a UTC instant`;
  }
  return null;
}

function textOf(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw new StateError(`${path} cannot be read: ${error.message}`, { cause: error });
  }
}

export function readState(path) {
  const text = textOf(path);
  if (text === null) return null;
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new StateError(`${path} is not readable JSON`);
  }
  const problem = problemOf(value);
  if (problem !== null) throw new StateError(`${path} ${problem}`);
  return value;
}

export function writeState(path, { announced }) {
  const ordered = Object.fromEntries(Object.entries(announced).sort(([left], [right]) => byText(left, right)));
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify({ announced: ordered }, null, 2)}\n`);
}

export function announce(state, routes, instant) {
  const added = Object.fromEntries(routes.map((route) => [route, instant]));
  return { announced: { ...added, ...state?.announced } };
}

const oldestFirst = (left, right) => byText(left.generatedAt, right.generatedAt) || byText(left.route, right.route);

export function selectEntries({ carried, state, instant }) {
  const ordered = [...carried].sort(oldestFirst);
  if (state !== null)
    return { fresh: ordered.filter(({ route }) => !Object.hasOwn(state.announced, route)), seeded: [] };
  const isRecent = ({ generatedAt }) => instant.getTime() - Date.parse(generatedAt) <= FIRST_RUN_WINDOW_MS;
  return { fresh: ordered.filter(isRecent), seeded: ordered.filter((entry) => !isRecent(entry)) };
}
