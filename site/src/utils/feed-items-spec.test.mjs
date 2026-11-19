import assert from 'node:assert/strict';
import { test } from 'node:test';

import { collectionFeedItems, mergedFeedItems } from './feed-items.mjs';
import { specId } from './spec-series.mjs';

const ORIGIN = 'https://meshin.co';

const version = (name, number, day) => ({
  id: specId({ name, version: number }),
  body: `Normative text of ${name} ${number}.`,
  data: {
    title: `${name} specification ${number}`,
    description: `What ${name} ${number} defines.`,
    name,
    version: number,
    publishDate: new Date(`2026-11-${day}T00:00:00Z`),
    updatedDate: new Date(`2026-11-${day}T00:00:00Z`),
  },
});

const FIRST = version('evals-baseline', '1.0', '12');
const SECOND = version('evals-baseline', '1.1', '20');

test('the specification feed carries each version at its own address, a slash and a dot in it, newest first', async () => {
  const items = await collectionFeedItems([FIRST, SECOND], ORIGIN, 'spec', 'spec');

  assert.deepEqual(
    items.map((item) => item.url),
    [`${ORIGIN}/spec/evals-baseline/1.1`, `${ORIGIN}/spec/evals-baseline/1.0`]
  );
  assert.deepEqual(
    items.map((item) => item.kind),
    ['spec', 'spec']
  );
  assert.ok(items[1].content_text.includes('Normative text of evals-baseline 1.0.'));
});

test('the merged feed carries a specification version beside the entries of the other collections', async () => {
  const load = async (kind) => (kind === 'spec' ? [FIRST] : []);
  const items = await mergedFeedItems(load, ORIGIN);

  assert.deepEqual(
    items.map((item) => item.url),
    [`${ORIGIN}/spec/evals-baseline/1.0`]
  );
});

test('a draft or noindex specification version is in neither feed', async () => {
  const hidden = { ...SECOND, data: { ...SECOND.data, noindex: true } };
  const drafted = { ...FIRST, data: { ...FIRST.data, draft: true } };

  assert.deepEqual(await collectionFeedItems([hidden, drafted], ORIGIN, 'spec', 'spec'), []);
  assert.deepEqual(await mergedFeedItems(async (kind) => (kind === 'spec' ? [hidden, drafted] : []), ORIGIN), []);
});
