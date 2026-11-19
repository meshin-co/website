import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

import * as built from '../src/utils/jsonld.mjs';
import { main } from './jsonld-gate.mjs';

const SITE = 'https://x';
const SERIES_PATH = '/spec/evals-baseline';
const VERSION_PATH = '/spec/evals-baseline/1.0';
const SERIES_LABEL = 'evals-baseline specification';
const SPEC = {
  id: 'evals-baseline/1.0',
  name: 'evals-baseline',
  version: '1.0',
  title: 'evals-baseline specification 1.0',
  description: 'What the baseline file holds.',
  publishDate: new Date('2026-11-12T00:00:00Z'),
  updatedDate: new Date('2026-11-14T00:00:00Z'),
  license: 'CC-BY-4.0',
};

const shared = () => [built.orgNode(SITE), built.personNode(SITE), built.websiteNode(SITE)];
const crumbs = (...trail) => built.breadcrumbNode(SITE, [{ name: 'Home', path: '/' }, ...trail]);
const pageOf = (nodes) =>
  `<html><head><script type="application/ld+json">${JSON.stringify(built.graph(nodes))}</script></head></html>`;

const seriesPage = () =>
  pageOf([
    ...shared(),
    built.collectionNode(SITE, {
      path: SERIES_PATH,
      name: SERIES_LABEL,
      description: 'Every published version.',
      items: [{ url: VERSION_PATH }],
    }),
    crumbs({ name: SERIES_LABEL, path: SERIES_PATH }),
  ]);

const versionPage = ({ withSeriesStub = true } = {}) =>
  pageOf([
    ...shared(),
    ...(withSeriesStub ? [built.specSeriesStub(SITE, SPEC.name)] : []),
    built.specNode(SITE, SPEC),
    built.webPageNode(SITE, VERSION_PATH, SPEC.updatedDate, SPEC.title),
    crumbs({ name: SERIES_LABEL, path: SERIES_PATH }, { name: 'Version 1.0', path: VERSION_PATH }),
  ]);

async function runGate(pages) {
  const dir = await mkdtemp(join(tmpdir(), 'jsonld-spec-pages-'));
  const err = [];
  const [log, error] = [console.log, console.error];
  try {
    for (const [route, html] of Object.entries(pages)) {
      const file = join(dir, `${route.slice(1)}.html`);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, html);
    }
    console.log = () => {};
    console.error = (line) => err.push(line);
    process.exitCode = undefined;
    await main(dir);
    return { exitCode: process.exitCode, err };
  } finally {
    [console.log, console.error] = [log, error];
    process.exitCode = undefined;
    await rm(dir, { recursive: true, force: true });
  }
}

test('the graphs the specification pages build with the real builders pass the gate, so table and builders agree', async () => {
  const { exitCode, err } = await runGate({ [SERIES_PATH]: seriesPage(), [VERSION_PATH]: versionPage() });

  assert.deepEqual(err, []);
  assert.equal(exitCode, undefined);
});

test('a version page whose graph leaves out the series stub references an undeclared series page', async () => {
  const { exitCode, err } = await runGate({
    [SERIES_PATH]: seriesPage(),
    [VERSION_PATH]: versionPage({ withSeriesStub: false }),
  });

  assert.equal(exitCode, 1);
  assert.deepEqual(err, [`JSONLD ${VERSION_PATH} references undeclared ${SITE}${SERIES_PATH}#page`]);
});
