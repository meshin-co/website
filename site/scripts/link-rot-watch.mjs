import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export const WATCH_SCHEMA = 1;
export const RUNS_BEFORE_DEAD = 3;
export const MAX_GAP_DAYS = 3;

const TOP_KEYS = ['schema', 'hosts'];
const ENTRY_KEYS = ['firstSeen', 'lastSeen', 'runs'];
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MILLISECONDS_PER_DAY = 86_400_000;
const STARTS_TODAY = 'every host that does not resolve starts its count today';

export class WatchError extends Error {
  name = 'WatchError';
}

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isDay = (value) => {
  if (typeof value !== 'string' || !DAY.test(value)) return false;
  const moment = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(moment.getTime()) && moment.toISOString().startsWith(value);
};
const daysBetween = (from, to) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / MILLISECONDS_PER_DAY);
const byHost = ([left], [right]) => (left < right ? -1 : left > right ? 1 : 0);

export const hostnameOf = (address) => (URL.canParse(address) ? new URL(address).hostname : '');

export const emptyWatch = () => ({ schema: WATCH_SCHEMA, hosts: {} });

function groupByHost(verdicts) {
  const hosts = new Map();
  for (const [address, verdict] of verdicts) {
    const host = hostnameOf(address);
    if (host === '') continue;
    const seen = hosts.get(host) ?? { addresses: [], allUnresolved: true };
    seen.addresses.push(address);
    seen.allUnresolved &&= verdict === 'unresolved';
    hosts.set(host, seen);
  }
  return hosts;
}

function nextEntry(previous, today) {
  const fresh = { firstSeen: today, lastSeen: today, runs: 1 };
  if (previous === undefined) return fresh;
  const since = daysBetween(previous.lastSeen, today);
  if (since === 0) return { ...previous };
  if (since < 0 || since > MAX_GAP_DAYS) return fresh;
  return { firstSeen: previous.firstSeen, lastSeen: today, runs: previous.runs + 1 };
}

const copyOf = (state) => ({
  schema: state.schema,
  hosts: Object.fromEntries(Object.entries(state.hosts).map(([host, entry]) => [host, { ...entry }])),
});

export function advanceWatch({ state, today, verdicts, responders = [] }) {
  if (!isDay(today)) throw new WatchError(`today must be a calendar day written YYYY-MM-DD, got ${String(today)}`);
  const answering = new Set([...responders].map(hostnameOf).filter((host) => host !== ''));
  if (answering.size === 0) return { state: copyOf(state), lapsed: [], watching: [], witnessed: false };
  const entries = [];
  const held = [];
  for (const [host, { addresses, allUnresolved }] of [...groupByHost(verdicts)].sort(byHost)) {
    if (!allUnresolved) continue;
    const previous = Object.hasOwn(state.hosts, host) ? state.hosts[host] : undefined;
    if ([...answering].some((other) => other !== host))
      entries.push({ host, ...nextEntry(previous, today), addresses });
    else if (previous !== undefined) held.push([host, { ...previous }]);
  }
  const moved = entries.map(({ host, firstSeen, lastSeen, runs }) => [host, { firstSeen, lastSeen, runs }]);
  return {
    state: { schema: WATCH_SCHEMA, hosts: Object.fromEntries([...moved, ...held]) },
    lapsed: entries.filter(({ runs }) => runs >= RUNS_BEFORE_DEAD),
    watching: entries.filter(({ runs }) => runs < RUNS_BEFORE_DEAD),
    witnessed: true,
  };
}

export function dropHosts(state, hosts) {
  const dropped = new Set(hosts);
  const kept = Object.entries(state.hosts).filter(([host]) => !dropped.has(host));
  return { schema: state.schema, hosts: Object.fromEntries(kept) };
}

export const lapseEvidence = ({ host, runs, firstSeen, lastSeen }) =>
  `the host name ${host} did not resolve on ${runs} consecutive scheduled runs, from ${firstSeen} to ${lastSeen}`;

export const lapseSummary = ({ host }) =>
  `the host name ${host} did not resolve on at least ${RUNS_BEFORE_DEAD} consecutive scheduled runs`;

function entryProblems(host, entry) {
  if (!isPlainObject(entry)) return [`${host} is not an object`];
  const found = Object.keys(entry)
    .filter((key) => !ENTRY_KEYS.includes(key))
    .map((key) => `${host}: has a key "${key}" that the writer never writes`);
  for (const key of ['firstSeen', 'lastSeen'])
    if (!isDay(entry[key])) found.push(`${host}: ${key} must be a calendar day written YYYY-MM-DD`);
  if (!Number.isInteger(entry.runs) || entry.runs < 1) found.push(`${host}: runs must be a whole number of at least 1`);
  if (isDay(entry.firstSeen) && isDay(entry.lastSeen) && entry.firstSeen > entry.lastSeen)
    found.push(`${host}: firstSeen is after lastSeen`);
  return found;
}

export function watchProblems(state) {
  if (!isPlainObject(state)) return ['the watch file is not a JSON object'];
  const found = Object.keys(state)
    .filter((key) => !TOP_KEYS.includes(key))
    .map((key) => `the watch file has a key "${key}" that the writer never writes`);
  if (state.schema !== WATCH_SCHEMA) found.push(`schema must be ${WATCH_SCHEMA}, got ${JSON.stringify(state.schema)}`);
  if (!isPlainObject(state.hosts)) return [...found, 'hosts must be an object keyed by host name'];
  for (const [host, entry] of Object.entries(state.hosts)) found.push(...entryProblems(host, entry));
  return found;
}

export function watchText({ schema, hosts }) {
  const sorted = Object.keys(hosts)
    .sort()
    .map((host) => [host, Object.fromEntries(ENTRY_KEYS.map((key) => [key, hosts[host][key]]))]);
  return `${JSON.stringify({ schema, hosts: Object.fromEntries(sorted) }, null, 2)}\n`;
}

const emptied = (reason) => ({
  state: emptyWatch(),
  note: `${reason}, so it is treated as empty and ${STARTS_TODAY}`,
});

export function readWatch(path) {
  if (!existsSync(path)) {
    return { state: emptyWatch(), note: `the watch file ${path} does not exist yet, so ${STARTS_TODAY}` };
  }
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch (error) {
    return emptied(`the watch file ${path} cannot be read (${error.message})`);
  }
  let state;
  try {
    state = JSON.parse(text);
  } catch (error) {
    return emptied(`the watch file ${path} is not JSON (${error.message})`);
  }
  const [problem] = watchProblems(state);
  return problem === undefined ? { state, note: null } : emptied(`the watch file ${path} fails its guard (${problem})`);
}

export function writeWatch(path, state) {
  mkdirSync(dirname(path), { recursive: true });
  const staged = `${path}.${process.pid}.tmp`;
  writeFileSync(staged, watchText(state));
  renameSync(staged, path);
}
