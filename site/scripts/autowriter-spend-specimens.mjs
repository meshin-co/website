import { join } from 'node:path';

import { asText, recordOf, recordPath } from './fixtures/spend-report-corpus.mjs';
import { REPORT_PATH } from './spend-report-text.mjs';

const GATE = 'gate:autowriter';
const SLUG = 'zz-specimen';
const GENERATED_AT = '2026-10-02T07:00:00.000Z';
const ABSENCE = 'That is the absence of a measurement. It is not a cost of zero.';
const FORGED_TOTAL = 'All time: 0.00 USD.';

const inRepository = (copySite, path) => join(copySite, '..', path);

export const spendSpecimens = ({ addUntrackedFile, editFile, removeFile }) => ({
  autowriterSpendReportStale: {
    gate: GATE,
    token: 'the file has "## No entry yet"',
    plant: (copySite) =>
      addUntrackedFile(inRepository(copySite, recordPath(SLUG)), asText(recordOf({ slug: SLUG, at: GENERATED_AT }))),
  },
  autowriterSpendReportEdited: {
    gate: GATE,
    token: FORGED_TOTAL,
    plant: (copySite) => editFile(inRepository(copySite, REPORT_PATH), (text) => text.replace(ABSENCE, FORGED_TOTAL)),
  },
  autowriterSpendReportDeleted: {
    gate: GATE,
    token: `spend-report-missing ${REPORT_PATH}`,
    plant: (copySite) => removeFile(inRepository(copySite, REPORT_PATH)),
  },
  autowriterSpendReportUnstamped: {
    gate: GATE,
    token: 'Generated-at',
    plant: (copySite) =>
      editFile(inRepository(copySite, REPORT_PATH), (text) => text.replace(/^Generated-at: .*\n/m, '')),
  },
});
