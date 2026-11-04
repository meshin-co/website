import { searchFallbackUrl } from '../../src/utils/archive-url.mjs';
import { archiveRung } from '../link-repair-archive.mjs';
import { REGISTER_PATH, readRegister, registerText, sealRegister } from '../link-rot-register.mjs';
import { SITE_ORIGIN, entryText, makeLinkRotRepo } from './link-rot-repo.mjs';
import { EMPTY_ADDRESS, NIST, TITLE, TODAY, archive, probes } from './link-repair-world.mjs';
import { PAGE } from './wayback-fakes.mjs';

export { EMPTY_ADDRESS, NIST, SITE_ORIGIN, TITLE, TODAY };

export const PUBLISHER = 'NIST';
export const GLOSSARY = 'site/src/data/glossary/ai-rmf.md';
export const SECOND = 'site/src/data/post/a-second-entry.md';
export const PARKED =
  '<html><head><title>Buy this domain</title></head><body><h1>This domain is for sale</h1></body></html>';
export const LIVE_PAGE = `<html><head><title>${TITLE}</title></head><body><h1>${TITLE} (AI RMF 1.0)</h1></body></html>`;

export const searchOf = ({ title = TITLE, publisher = PUBLISHER } = {}) => searchFallbackUrl({ title, publisher });
export const page = (text = LIVE_PAGE) => ({ kind: 'page', contentType: 'text/html', text });
export const unchecked = (contentType = 'application/pdf') => ({
  kind: 'unchecked',
  contentType,
  reason: `the page is ${contentType}, which the machine cannot read; a person must judge it`,
});
export const unreadable = (reason = 'the address could not be read: ECONNRESET') => ({ kind: 'unreadable', reason });

export function searched({
  original = NIST,
  title = TITLE,
  publisher = PUBLISHER,
  retrieved = '2023-03-01',
  updatedDate = '2023-03-01',
  body,
} = {}) {
  const url = searchOf({ title, publisher });
  return entryText({
    updatedDate,
    sources: [{ title, url, original, publisher, ...(retrieved === null ? {} : { retrieved }) }],
    body: body ?? `See [the framework](${url}) for the detail.\n`,
  });
}

export const registerRow = ({
  original = NIST,
  entry = GLOSSARY,
  title = TITLE,
  publisher = PUBLISHER,
  citedOn = '2023-03-01',
  firstSeenDead = '2026-10-20',
} = {}) => ({
  original,
  entry,
  outcome: 'search',
  replacement: searchOf({ title, publisher }),
  citedOn,
  firstSeenDead,
  why: `no usable Internet Archive capture: the archive holds no snapshot of ${original}`,
});

export function reexamineWorld({
  files = { [GLOSSARY]: searched() },
  rows = [registerRow()],
  verdicts = {},
  pages = {},
  empty = [NIST],
  ...archiveOptions
} = {}) {
  const repo = makeLinkRotRepo({ files, dist: {}, versioned: false });
  if (rows !== null) repo.put(REGISTER_PATH, registerText(sealRegister({ updatedOn: '2026-10-21', rows })));
  const check = probes(verdicts);
  const archived = archive({ empty, ...archiveOptions });
  const livePagesRead = [];
  const readLivePage = async ({ address }) => {
    livePagesRead.push(address);
    const found = pages[address];
    if (found instanceof Error) throw found;
    return found ?? page();
  };
  const rung = archiveRung({
    closestSnapshot: archived.closestSnapshot,
    readSnapshot: archived.readSnapshot,
    sleep: archived.sleep,
    spacingMs: 0,
  });
  const existing = () => readRegister(repo.root).register;
  const inputs = {
    repoRoot: repo.root,
    today: TODAY,
    existing: existing(),
    probeAll: check.probeAll,
    readLivePage,
    rung,
  };
  return { repo, inputs, probed: check.asked, archive: archived, livePagesRead, existing, PAGE };
}
