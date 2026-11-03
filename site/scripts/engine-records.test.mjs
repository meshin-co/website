import assert from 'node:assert/strict';
import { test } from 'node:test';

import { measureScriptFor, recordProducer } from './engine-records.mjs';

test('the measure script of a record is named after the record, without its directory or extension', () => {
  assert.equal(measureScriptFor('audits/sentence-band.json'), 'site/scripts/measure-sentence-band.mjs');
  assert.equal(measureScriptFor('audits/routes.json'), 'site/scripts/measure-routes.mjs');
});

test('a record is produced when its measure script is tracked, and by nothing otherwise', () => {
  const files = ['site/scripts/measure-sentence-band.mjs'];
  assert.equal(recordProducer('audits/sentence-band.json', files), 'site/scripts/measure-sentence-band.mjs');
  assert.equal(recordProducer('audits/routes.json', files), null);
});

test('the demand report has no producer of its own, so only a seed or a measure script can serve it', () => {
  assert.equal(recordProducer('audits/search-demand.md', ['site/scripts/fetch-search-demand.mjs']), null);
  assert.equal(
    recordProducer('audits/search-demand.md', ['site/scripts/measure-search-demand.mjs']),
    'site/scripts/measure-search-demand.mjs'
  );
});
