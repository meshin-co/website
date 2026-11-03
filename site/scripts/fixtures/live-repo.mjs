import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { entryRoute } from '../entry-files.mjs';
import { filesOf, ledgerOf, recordOf, writingCall } from './spend-report-corpus.mjs';

export const NOW = new Date('2026-11-03T09:00:00.000Z');

const HOUR = 60 * 60 * 1000;

export function entryFiles({ slug, format = 'article', hoursAgo = 3, input = 12_000, output = 3_000, title, prompt }) {
  const calls = [writingCall({ input, output, tag: `${slug}-draft` })];
  const made = recordOf({ slug, format, at: new Date(NOW.getTime() - hoursAgo * HOUR).toISOString(), calls });
  const claim = { ...made.claim, ...(title && { title }), ...(prompt && { prompt }) };
  return { ledger: ledgerOf({ slug, calls }), record: { ...made, claim }, format, slug };
}

export function putAll(root, files) {
  for (const { path, text } of files) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
}

export function liveRepo({ entries, built = entries.map(({ slug }) => slug) }) {
  const base = mkdtempSync(join(tmpdir(), 'live-repo-'));
  const [root, dist] = [join(base, 'repo'), join(base, 'dist')];
  const made = entries.map(entryFiles);
  const files = filesOf({ ledgers: made.map(({ ledger }) => ledger), records: made.map(({ record }) => record) });
  mkdirSync(root, { recursive: true });
  mkdirSync(dist, { recursive: true });
  putAll(root, [...files.ledgers, ...files.records]);
  const pages = made
    .filter(({ slug }) => built.includes(slug))
    .map(({ slug, format }) => ({ path: `${entryRoute({ format, slug }).slice(1)}.html`, text: '<!doctype html>' }));
  putAll(dist, pages);
  return {
    base,
    root,
    dist,
    put: (path, text) => putAll(root, [{ path, text }]),
    remove: () => rmSync(base, { recursive: true, force: true }),
  };
}
