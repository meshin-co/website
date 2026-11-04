import { closestSnapshot, readSnapshot } from '../wayback.mjs';
import { SITE_ORIGIN, entryText, makeLinkRotRepo } from './link-rot-repo.mjs';
import { NIST, PAGE, napper, ok } from './wayback-fakes.mjs';
import { availabilityFor } from './wayback-recorded.mjs';

export { NIST, SITE_ORIGIN };
export const TODAY = '2026-11-03';
export const EMPTY_ADDRESS = 'https://doi.org/10.6028/NIST.AI.100-1';
export const TITLE = 'AI Risk Management Framework';
export const GLOSSARY = 'site/src/data/glossary/ai-rmf.md';

export const citing = ({
  address = NIST,
  title = TITLE,
  publisher = 'NIST',
  retrieved = '2023-03-01',
  body = `See [the framework](${address}) for the detail.\n`,
  updatedDate = '2023-03-01',
} = {}) =>
  entryText({
    title: 'What a gone citation looks like',
    updatedDate,
    sources: [{ title, url: address, publisher, ...(retrieved === null ? {} : { retrieved }) }],
    body,
  });

export function probes(verdicts = {}) {
  const asked = [];
  const probeAll = async (addresses) => {
    asked.push([...addresses]);
    return new Map(
      [...addresses].sort().map((address) => {
        const verdict = verdicts[address] ?? 'answered';
        const status = { dead: 404, answered: 200 }[verdict] ?? null;
        return [address, { url: address, verdict, status, reason: verdict }];
      })
    );
  };
  return { probeAll, asked };
}

export function archive({ capture = ok(PAGE, 'text/html'), down = false, empty = [EMPTY_ADDRESS] } = {}) {
  const asked = [];
  const fetch = async (address) => {
    asked.push(address);
    if (down) return new Response('', { status: 503 });
    if (address.includes('/web/')) return capture();
    const query = new URL(address).searchParams;
    const url = query.get('url');
    return new Response(
      JSON.stringify(availabilityFor({ address: url, timestamp: query.get('timestamp'), empty: empty.includes(url) })),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  };
  const { naps, sleep } = napper();
  return {
    closestSnapshot: (options) => closestSnapshot({ ...options, fetch, env: {}, sleep, attempts: 1 }),
    readSnapshot: (options) => readSnapshot({ ...options, fetch, env: {}, sleep, attempts: 1 }),
    sleep,
    naps,
    requests: () => asked,
  };
}

export function world({
  files = {},
  dist = { 'index.html': [NIST] },
  verdicts = { [NIST]: 'dead' },
  ...archiveOptions
} = {}) {
  const repo = makeLinkRotRepo({ files, dist, versioned: false });
  const check = probes(verdicts);
  const archived = archive(archiveOptions);
  const inputs = {
    repoRoot: repo.root,
    dist: repo.dist,
    origin: SITE_ORIGIN,
    today: TODAY,
    probeAll: check.probeAll,
    closestSnapshot: archived.closestSnapshot,
    readSnapshot: archived.readSnapshot,
    sleep: archived.sleep,
    spacingMs: 0,
  };
  return { repo, inputs, asked: check.asked, archive: archived };
}
