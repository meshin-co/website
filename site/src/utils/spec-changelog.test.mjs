import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CHANGELOG, changelogMarkdown, changelogRows, correctionsMatchDates } from './spec-changelog.mjs';

const at = (day) => new Date(`${day}T00:00:00Z`);

const published = {
  version: '1.0',
  publishDate: at('2026-11-15'),
  updatedDate: at('2026-11-15'),
  corrections: [],
};

const corrected = (corrections, updatedDate = corrections.at(-1).date) => ({ ...published, corrections, updatedDate });

const typo = { date: at('2026-12-01'), change: 'Corrected a typing error in the example.' };
const wording = { date: at('2026-12-09'), change: 'Reworded the first clause of Versioning.' };

test('the changelog is a section called Changelog whose table has a version, a date and a change', () => {
  assert.equal(CHANGELOG.id, 'changelog');
  assert.equal(CHANGELOG.heading, 'Changelog');
  assert.deepEqual(CHANGELOG.columns, ['Version', 'Date', 'Change']);
});

test('a version that was never corrected has one row: its first publication, on its publish date', () => {
  assert.deepEqual(changelogRows(published), [{ version: '1.0', date: '2026-11-15', change: 'First publication' }]);
});

test('each correction is a later row of the same version, in the order recorded', () => {
  assert.deepEqual(changelogRows(corrected([typo, wording])), [
    { version: '1.0', date: '2026-11-15', change: 'First publication' },
    { version: '1.0', date: '2026-12-01', change: 'Corrected a typing error in the example.' },
    { version: '1.0', date: '2026-12-09', change: 'Reworded the first clause of Versioning.' },
  ]);
});

test('the changelog as markdown is a heading over a pipe table with one line per row', () => {
  assert.equal(
    changelogMarkdown(changelogRows(corrected([typo]))),
    [
      '## Changelog',
      '',
      '| Version | Date | Change |',
      '| --- | --- | --- |',
      '| 1.0 | 2026-11-15 | First publication |',
      '| 1.0 | 2026-12-01 | Corrected a typing error in the example. |',
      '',
    ].join('\n')
  );
});

test('a pipe or a line break in a change cannot break the markdown table', () => {
  const row = { version: '1.0', date: '2026-12-01', change: 'Named the | character\nand the line break.' };

  assert.equal(
    changelogMarkdown([row]).split('\n')[4],
    '| 1.0 | 2026-12-01 | Named the \\| character and the line break. |'
  );
});

test('the dates agree when nothing was corrected and the update date is the publish date', () => {
  assert.equal(correctionsMatchDates(published), true);
});

test('the dates agree when the update date is the date of the last correction', () => {
  assert.equal(correctionsMatchDates(corrected([typo])), true);
  assert.equal(correctionsMatchDates(corrected([typo, wording])), true);
});

test('two corrections on one day are in date order', () => {
  const same = { date: typo.date, change: 'Added a second example.' };
  assert.equal(correctionsMatchDates(corrected([typo, same])), true);
});

test('an update date after the publish date with no correction recorded is refused', () => {
  assert.equal(correctionsMatchDates({ ...published, updatedDate: at('2026-11-16') }), false);
});

test('an update date before the publish date is refused', () => {
  assert.equal(correctionsMatchDates({ ...published, updatedDate: at('2026-11-14') }), false);
});

test('an update date that is not the date of the last correction is refused, later or earlier', () => {
  assert.equal(correctionsMatchDates(corrected([typo, wording], at('2026-12-10'))), false);
  assert.equal(correctionsMatchDates(corrected([typo, wording], typo.date)), false);
  assert.equal(correctionsMatchDates(corrected([typo], published.publishDate)), false);
});

test('a correction dated before the publish date is refused', () => {
  const early = { date: at('2026-11-14'), change: 'Corrected a typing error in the example.' };
  assert.equal(correctionsMatchDates(corrected([early])), false);
});

test('corrections out of date order are refused, even when the update date is the date of the last one listed', () => {
  assert.equal(correctionsMatchDates(corrected([wording, typo])), false);
});
