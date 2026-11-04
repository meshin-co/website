import assert from 'node:assert/strict';

import { parse } from 'yaml';

import { searchFallbackUrl } from '../../src/utils/archive-url.mjs';
import { RewriteError } from '../entry-surgery.mjs';

export const DEAD = 'https://example.org/report';
export const OTHER = 'https://example.org/elsewhere';
export const PUBLISHER = 'Example Org';
export const SNAPSHOT = `https://web.archive.org/web/20251025031200/${DEAD}`;
export const STYLES = [
  ['plain', (address) => address],
  ['single-quoted', (address) => `'${address}'`],
  ['double-quoted', (address) => `"${address}"`],
];

const DATES = ['publishDate: 2026-09-08', 'updatedDate: 2026-10-25'];

export const entry = ({ dates = DATES, extra = [], sources, body = ['', 'Body.', ''] }) =>
  ['---', 'title: A test entry', ...dates, ...extra, 'sources:', ...sources, '---', ...body].join('\n');
export const row = (address, ...more) => ['  - title: The report', `    url: ${address}`, ...more];
export const searchFor = (title = 'The report', publisher = undefined) => searchFallbackUrl({ title, publisher });
export const searchedRow = (address, ...more) => row(searchFor(), `    original: ${address}`, ...more);
export const archivedRow = (address, snapshot, ...more) => row(snapshot, `    original: ${address}`, ...more);
export const crlf = (text) => text.replaceAll('\n', '\r\n');
export const frontmatterOf = (text) => parse(/^---\r?\n([\s\S]*?)\r?\n---/.exec(text)[1]);

export const refused = (run, pattern) =>
  assert.throws(run, (error) => {
    assert.ok(error instanceof RewriteError, `not a RewriteError: ${error}`);
    assert.match(error.message, pattern);
    return true;
  });

export const bodyForms = (address) => [
  '',
  `An inline [report](${address}) link, a titled [report](${address} "The Report") one and an autolink <${address}>.`,
  `A link whose text is the address: [${address}](${address}). Between \`a\` code and [it](${address}) and \`b\` code.`,
  `A bare ${address}. Another ${address}, then ${address}; then ${address}: yes ${address}? ${address}!`,
  `In quotes "${address}." or brackets (${address}.) or [${address}] or after a link (${address}).`,
  '',
  `[ref]: ${address} "Reference title"`,
  `[angle]: <${address}>`,
  '',
  `| [report](${address}) | cited in a table |`,
  '',
  `Finally ${address}.`,
];

export const stringsCiting = (address) => [
  `shortDefinition: A claim with [a source](${address}) in it.`,
  'definition: |',
  `  First paragraph cites [the report](${address}).`,
  '',
  '  Second paragraph.',
  `answer: 'See [the report](${address}) for the detail.'`,
  `note: "Also <${address}> here."`,
];
