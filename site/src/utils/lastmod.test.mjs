import assert from 'node:assert/strict';
import { test } from 'node:test';

import { lastmod } from './lastmod.mjs';

test('lastmod is null when an entry carries no dates', () => {
  assert.equal(lastmod({}), null);
  assert.equal(lastmod({ publishDate: undefined, updatedDate: undefined }), null);
});

test('lastmod takes the newer of updatedDate and publishDate, whichever comes first in the entry', () => {
  const older = new Date('2026-01-05T09:30:00Z');
  const newer = new Date('2026-03-11T00:00:00Z');

  assert.equal(lastmod({ publishDate: older, updatedDate: newer }), newer.toISOString());
  assert.equal(lastmod({ publishDate: newer, updatedDate: older }), newer.toISOString());
});

test('lastmod falls back to a single date and accepts ISO strings as well as Dates', () => {
  assert.equal(lastmod({ publishDate: new Date('2026-02-01T12:00:00Z') }), '2026-02-01T12:00:00.000Z');
  assert.equal(lastmod({ updatedDate: '2026-02-02T00:00:00Z' }), '2026-02-02T00:00:00.000Z');
  assert.equal(
    lastmod({ publishDate: '2026-02-01T12:00:00Z', updatedDate: '2026-02-02T00:00:00Z' }),
    '2026-02-02T00:00:00.000Z'
  );
});
