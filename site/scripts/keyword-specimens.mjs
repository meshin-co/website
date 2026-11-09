import { join } from 'node:path';

const GATE = 'gate:keywords';
const REPORT = '../audits/keyword-demand.md';
const MEASURED_DAY = /^([*_]*Measured:[*_]*\s*)\d{4}-\d{2}-\d{2}/m;
const PHRASE_HEADER_CELL = /^(\|\s*)Phrase(\s*\|)/m;
const PHRASE_MEASURED_CELL = /(\|\s*)\d{4}-\d{2}-\d{2}(\s*\|)/;
const FIRST_PHRASE_ROW = /^(\| Phrase [^\n]*\n\|[-| ]+\n)\|[^\n]*\n/m;

const withMeasuredLongAgo = (report) => report.replace(MEASURED_DAY, (_, label) => `${label}2020-01-01`);

const withPhraseHeaderRenamed = (report) => report.replace(PHRASE_HEADER_CELL, '$1Query$2');

const withFirstPhraseMeasuredLongAgo = (report) =>
  report.replace(PHRASE_MEASURED_CELL, (_, open, close) => `${open}2020-01-01${close}`);

const withFirstPhraseRowDropped = (report) => report.replace(FIRST_PHRASE_ROW, '$1');

export const keywordSpecimens = ({ editFile }) => ({
  keywordReportStale: {
    gate: GATE,
    token: 'report-stale audits/keyword-demand.md: measured 2020-01-01; refresh with npm run audit:keywords',
    plant: (copySite) => editFile(join(copySite, REPORT), withMeasuredLongAgo),
  },
  keywordReportWithoutPhraseTable: {
    gate: GATE,
    token:
      'report-unreadable audits/keyword-demand.md: no phrase table (a header with the cells Phrase, Exact, Broad, Weeks and Served by)',
    plant: (copySite) => editFile(join(copySite, REPORT), withPhraseHeaderRenamed),
  },
  keywordPhraseCarriedPastWindow: {
    gate: GATE,
    token:
      'phrase-stale audits/keyword-demand.md: phrases older than the cache window: 1, the oldest measured 2020-01-01',
    plant: (copySite) => editFile(join(copySite, REPORT), withFirstPhraseMeasuredLongAgo),
  },
  keywordPhraseDropped: {
    gate: GATE,
    token: 'report-unaccounted audits/keyword-demand.md: the Run line and the tables disagree',
    plant: (copySite) => editFile(join(copySite, REPORT), withFirstPhraseRowDropped),
  },
});
