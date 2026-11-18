import assert from 'node:assert/strict';
import { test } from 'node:test';

import { HUB_COLLECTIONS, llmsCollectionFiles, llmsSeriesHubs, toLlmsEntry } from './llms-collections.mjs';
import { groupSeries } from './spec-series.mjs';

const SPEC_ENTRY = {
  id: 'evals-baseline/1.0',
  body: 'Normative text of the baseline.',
  data: {
    title: 'evals-baseline specification 1.0',
    description: 'What the baseline file holds.',
    name: 'evals-baseline',
    version: '1.0',
    publishDate: new Date('2026-11-12T00:00:00Z'),
    updatedDate: new Date('2026-11-14T00:00:00Z'),
  },
};

const withData = (id, data) => ({ ...SPEC_ENTRY, id, data: { ...SPEC_ENTRY.data, ...data } });

test('the collections that have a hub page leave out the specification collection, which has a page per series', () => {
  assert.deepEqual(
    HUB_COLLECTIONS.map(({ name }) => name),
    ['service', 'post', 'resource', 'glossary', 'case', 'faq']
  );
});

test('a specification version is an llms entry under its own id, with the slash and the dot kept', () => {
  assert.deepEqual(toLlmsEntry('/spec')(SPEC_ENTRY), {
    id: 'evals-baseline/1.0',
    title: 'evals-baseline specification 1.0',
    description: 'What the baseline file holds.',
    body: 'Normative text of the baseline.',
    updated: '2026-11-14T00:00:00.000Z',
    published: '2026-11-12T00:00:00.000Z',
    draft: false,
    noindex: false,
  });
});

test('llmsSeriesHubs names every series by its own address, title and description, dated by its newest version', () => {
  const series = groupSeries([
    SPEC_ENTRY,
    withData('evals-baseline/1.1', { version: '1.1', updatedDate: new Date('2026-12-02T00:00:00Z') }),
    withData('other/1.0', {
      name: 'other',
      publishDate: new Date('2026-09-20T00:00:00Z'),
      updatedDate: new Date('2026-10-01T00:00:00Z'),
    }),
  ]);

  assert.deepEqual(llmsSeriesHubs('/spec', series), [
    {
      title: 'evals-baseline specification',
      description: 'Every published version of the evals-baseline specification, and the address to cite for each.',
      updated: '2026-12-02T00:00:00.000Z',
      url: '/spec/evals-baseline',
    },
    {
      title: 'other specification',
      description: 'Every published version of the other specification, and the address to cite for each.',
      updated: '2026-10-01T00:00:00.000Z',
      url: '/spec/other',
    },
  ]);
});

test('llmsSeriesHubs names nothing when no series has a live version', () => {
  const drafted = groupSeries([withData('evals-baseline/1.0', { draft: true })]);

  assert.deepEqual(llmsSeriesHubs('/spec', drafted), []);
});

test('the specification collection file carries a version at its address and under its own heading', () => {
  const address = 'https://meshin.co/spec/evals-baseline/1.0';
  const files = llmsCollectionFiles({
    site: 'meshin.co',
    origin: 'https://meshin.co',
    name: 'spec',
    title: 'Specifications',
    entries: [{ ...toLlmsEntry('/spec')(SPEC_ENTRY), url: address, summary: SPEC_ENTRY.data.description }],
  });

  assert.deepEqual(
    files.map(({ param }) => param),
    ['spec']
  );
  assert.match(files[0].text, /^## Specifications$/m);
  assert.ok(files[0].text.includes(`[${address}](${address})`));
  assert.ok(files[0].text.includes('Normative text of the baseline.'));
});
