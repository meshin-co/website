import { readFileSync } from 'node:fs';

const RECORDINGS = new URL('./wayback/', import.meta.url);

export const NIST = 'https://www.nist.gov/itl/ai-risk-management-framework';
export const recording = (name) => readFileSync(new URL(name, RECORDINGS), 'utf8');
export const INDEX = JSON.parse(recording('index.json'));
export const OLDER = JSON.parse(recording('available-older.json')).archived_snapshots.closest;
export const PAGE = recording('snapshot-page.html');
export const SNAPSHOT = {
  url: `https://web.archive.org/web/${OLDER.timestamp}/${NIST}`,
  timestamp: OLDER.timestamp,
  capturedOn: '2023-03-02',
  distanceDays: 1,
  original: NIST,
};

export const ok =
  (text, type = 'application/json') =>
  () =>
    new Response(text, { status: 200, headers: { 'content-type': type } });
export const recorded = (name) => ok(recording(name));
export const refuses =
  (status, headers = {}) =>
  () =>
    new Response('', { status, headers });
export const crashes = (message, cause) => () => new TypeError(message, { cause });

export function scripted(...replies) {
  const requests = [];
  const fetch = async (address, init) => {
    requests.push({ address, init });
    const next = replies[Math.min(requests.length, replies.length) - 1]();
    if (next instanceof Error) throw next;
    return next;
  };
  return { fetch, requests };
}

export function recordedArchive() {
  const requests = [];
  const fetch = async (address, init) => {
    requests.push({ address, init });
    const query = new URL(address).searchParams;
    const file = Object.keys(INDEX).find(
      (name) =>
        name.startsWith('available-') &&
        INDEX[name].url === query.get('url') &&
        INDEX[name].timestamp === query.get('timestamp')
    );
    if (file === undefined) throw new Error(`no recording answers ${address}`);
    return recorded(file)();
  };
  return { fetch, requests };
}

export function napper() {
  const naps = [];
  const sleep = async (milliseconds) => {
    naps.push(milliseconds);
  };
  return { naps, sleep };
}

export const noSleep = async () => {};
