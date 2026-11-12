import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  CITATION_FORMS,
  CITATION_HEADING,
  CITE_TOKEN,
  SPEC_NAME,
  SPEC_VERSION,
  citationMarkdown,
  compareVersions,
  groupSeries,
  seriesDescription,
  seriesLabel,
  seriesSearchRecord,
  seriesSidecarBody,
  specCitation,
  specId,
  specLabel,
} from './spec-series.mjs';

const SITE = 'https://meshin.co';

const CITED = {
  name: 'evals-baseline',
  version: '1.0',
  site: SITE,
  citeAs: 'This project guards its agent evaluations against regression as defined by the {spec}.',
  citeKey: 'spec',
};

const entry = (name, version, data = {}) => ({
  id: specId({ name, version }),
  data: {
    name,
    version,
    publishDate: new Date('2026-11-12'),
    updatedDate: new Date('2026-11-12'),
    draft: false,
    noindex: false,
    ...data,
  },
});

test('the address of a specification version is its name, a slash and its version', () => {
  assert.equal(specId({ name: 'evals-baseline', version: '1.0' }), 'evals-baseline/1.0');
});

test('a version is two numbers: no third number, no leading zero, no prefix, no missing minor', () => {
  for (const good of ['1.0', '0.1', '2.14', '10.0']) assert.match(good, SPEC_VERSION, good);
  for (const bad of ['1', '1.0.0', '01.0', '1.00', 'v1.0', '1.', '.1', '1.x', ' 1.0', '1.0 '])
    assert.doesNotMatch(bad, SPEC_VERSION, bad);
});

test('a name is lower-case words joined by single hyphens and starts with a letter', () => {
  for (const good of ['evals-baseline', 'governance', 'a1-b2']) assert.match(good, SPEC_NAME, good);
  for (const bad of ['Evals', '1evals', 'evals_baseline', 'evals--baseline', 'evals-', '-evals', 'a/b', ''])
    assert.doesNotMatch(bad, SPEC_NAME, bad);
});

test('versions compare as numbers, so 1.10 is newer than 1.9 and 2.0 is newer than both', () => {
  const ordered = ['1.9', '1.10', '2.0', '1.0'].sort(compareVersions);
  assert.deepEqual(ordered, ['1.0', '1.9', '1.10', '2.0']);
  assert.equal(compareVersions('1.0', '1.0'), 0);
});

test('a series lists its versions newest first and names the highest as current', () => {
  const [series] = groupSeries([
    entry('evals-baseline', '1.0'),
    entry('evals-baseline', '1.10'),
    entry('evals-baseline', '1.9'),
  ]);
  assert.equal(series.name, 'evals-baseline');
  assert.deepEqual(
    series.versions.map(({ data }) => data.version),
    ['1.10', '1.9', '1.0']
  );
  assert.equal(series.current.data.version, '1.10');
});

test('series come back in name order, each holding only its own versions', () => {
  const all = groupSeries([entry('zeta', '1.0'), entry('alpha', '2.0'), entry('alpha', '1.0')]);
  assert.deepEqual(
    all.map(({ name }) => name),
    ['alpha', 'zeta']
  );
  assert.deepEqual(
    all[0].versions.map(({ id }) => id),
    ['alpha/2.0', 'alpha/1.0']
  );
  assert.deepEqual(
    all[1].versions.map(({ id }) => id),
    ['zeta/1.0']
  );
});

test('a draft version and a noindex version are not listed and never current', () => {
  const [series] = groupSeries([
    entry('evals-baseline', '1.0'),
    entry('evals-baseline', '1.1', { draft: true }),
    entry('evals-baseline', '2.0', { noindex: true }),
  ]);
  assert.deepEqual(
    series.versions.map(({ id }) => id),
    ['evals-baseline/1.0']
  );
  assert.equal(series.current.data.version, '1.0');
});

test('a name whose every version is a draft or noindex has no series at all', () => {
  assert.deepEqual(groupSeries([entry('evals-baseline', '1.0', { draft: true })]), []);
  assert.deepEqual(groupSeries([entry('evals-baseline', '1.0', { noindex: true })]), []);
  assert.deepEqual(groupSeries([]), []);
});

test('a series was first published with its oldest version and last updated with its newest change', () => {
  const [series] = groupSeries([
    entry('evals-baseline', '1.0', { publishDate: new Date('2026-11-12'), updatedDate: new Date('2026-11-14') }),
    entry('evals-baseline', '1.1', { publishDate: new Date('2026-12-01'), updatedDate: new Date('2026-12-01') }),
  ]);
  assert.equal(series.published, '2026-11-12T00:00:00.000Z');
  assert.equal(series.updated, '2026-12-01T00:00:00.000Z');
});

test('dates written as text order and compare the same as dates written as Date objects', () => {
  const [series] = groupSeries([
    entry('evals-baseline', '1.0', { publishDate: '2026-11-12', updatedDate: '2026-11-14' }),
    entry('evals-baseline', '1.1', { publishDate: '2026-12-01', updatedDate: '2026-12-02' }),
  ]);
  assert.equal(series.published, '2026-11-12T00:00:00.000Z');
  assert.equal(series.updated, '2026-12-02T00:00:00.000Z');
});

test('a series and a version are named by the series name, the word specification and the version', () => {
  assert.equal(seriesLabel('evals-baseline'), 'evals-baseline specification');
  assert.equal(specLabel({ name: 'evals-baseline', version: '1.0' }), 'evals-baseline specification 1.0');
  assert.equal(
    seriesDescription('evals-baseline'),
    'Every published version of the evals-baseline specification, and the address to cite for each.'
  );
});

test('a citation has three forms: prose, a paste-ready sentence and a line for a file', () => {
  assert.deepEqual(specCitation(CITED), {
    prose: 'evals-baseline specification 1.0, https://meshin.co/spec/evals-baseline/1.0',
    markdown:
      'This project guards its agent evaluations against regression as defined by the [evals-baseline specification 1.0](https://meshin.co/spec/evals-baseline/1.0).',
    file: '"spec": "1.0"',
  });
});

test('the file form takes its key from the entry and its value from the version, not from the series', () => {
  assert.equal(specCitation({ ...CITED, version: '2.14', citeKey: 'baseline' }).file, '"baseline": "2.14"');
});

test('the cited address is the canonical one and names the version, never the series alone', () => {
  const { prose, markdown } = specCitation({ ...CITED, version: '1.10' });
  assert.ok(prose.endsWith('https://meshin.co/spec/evals-baseline/1.10'), prose);
  assert.ok(markdown.includes('(https://meshin.co/spec/evals-baseline/1.10)'), markdown);
  assert.doesNotMatch(prose, /1\.10\/$/);
});

test('a citation names no repository and no package registry', () => {
  const forms = Object.values(specCitation(CITED)).join('\n');
  assert.doesNotMatch(forms, /github\.com|npmjs\.com/);
});

test('the link token is written once in the sentence and every occurrence of it becomes the link', () => {
  assert.equal(CITE_TOKEN, '{spec}');
  const { markdown } = specCitation({ ...CITED, citeAs: 'See the {spec}, or the {spec} again.' });
  assert.equal(markdown.match(/\[evals-baseline specification 1\.0\]/g).length, 2);
  assert.ok(!markdown.includes(CITE_TOKEN));
});

test('the citation block lists the forms in the order the page shows them, and names every form specCitation returns', () => {
  assert.deepEqual(
    CITATION_FORMS.map(({ key }) => key),
    Object.keys(specCitation(CITED))
  );
  assert.deepEqual(
    CITATION_FORMS.map(({ label }) => label),
    ['In prose', 'Paste-ready', 'In a file']
  );
  assert.equal(CITATION_HEADING, 'Cite this version');
});

test('the citation as markdown is a heading and each form under its label in a code fence', () => {
  assert.equal(
    citationMarkdown(specCitation(CITED)),
    [
      '## Cite this version',
      '',
      'In prose:',
      '',
      '```text',
      'evals-baseline specification 1.0, https://meshin.co/spec/evals-baseline/1.0',
      '```',
      '',
      'Paste-ready:',
      '',
      '```text',
      'This project guards its agent evaluations against regression as defined by the [evals-baseline specification 1.0](https://meshin.co/spec/evals-baseline/1.0).',
      '```',
      '',
      'In a file:',
      '',
      '```text',
      '"spec": "1.0"',
      '```',
      '',
    ].join('\n')
  );
});

test('the series sidecar lists every version newest first, each linked at its slashless address with its day, and marks the highest current', () => {
  const [series] = groupSeries([
    entry('evals-baseline', '1.0', { publishDate: new Date('2026-11-12') }),
    entry('evals-baseline', '1.1', { publishDate: new Date('2026-12-01') }),
  ]);
  assert.equal(
    seriesSidecarBody({ site: SITE, series }),
    [
      '- [evals-baseline specification 1.1](https://meshin.co/spec/evals-baseline/1.1), published 2026-12-01, current',
      '- [evals-baseline specification 1.0](https://meshin.co/spec/evals-baseline/1.0), published 2026-11-12',
      '',
    ].join('\n')
  );
});

test('the series sidecar calls exactly one version current, the highest by number and not by date', () => {
  const [series] = groupSeries([
    entry('evals-baseline', '1.9', { publishDate: new Date('2026-12-01') }),
    entry('evals-baseline', '1.10', { publishDate: new Date('2026-11-01') }),
    entry('evals-baseline', '1.0', { publishDate: new Date('2026-10-01') }),
  ]);
  const lines = seriesSidecarBody({ site: SITE, series }).trim().split('\n');
  assert.equal(lines.length, 3);
  assert.deepEqual(
    lines.map((line) => line.endsWith(', current')),
    [true, false, false]
  );
  assert.ok(lines[0].includes('specification 1.10'), lines[0]);
});

test('a series sidecar dates a version written as text by the same day as one written as a Date', () => {
  const [series] = groupSeries([entry('evals-baseline', '1.0', { publishDate: '2026-11-12' })]);
  assert.ok(seriesSidecarBody({ site: SITE, series }).includes(', published 2026-11-12, current'));
});

test('a series is found by its own address, its name and every one of its versions, newest first', () => {
  const [series] = groupSeries([entry('evals-baseline', '1.0'), entry('evals-baseline', '1.1')]);
  assert.deepEqual(seriesSearchRecord('spec', series), {
    href: '/spec/evals-baseline',
    title: 'evals-baseline specification',
    description: 'Every published version of the evals-baseline specification, and the address to cite for each.',
    body: 'evals-baseline specification 1.1 evals-baseline specification 1.0',
  });
});
