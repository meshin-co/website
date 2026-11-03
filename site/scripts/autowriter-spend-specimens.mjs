import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { MONTHLY_SPEND_CEILING_USD } from './autowriter-ledger.mjs';
import { asText, recordOf, writingCall } from './fixtures/spend-report-corpus.mjs';
import { recordPath } from './record-layout.mjs';
import { REPORT_PATH, stampedAt } from './spend-report-text.mjs';

const GATE = 'gate:autowriter';
const SLUG = 'zz-specimen';
const SPENT_FIGURE = /(so far: )\d[\d.]*( USD spent)/;
const FORGED_SPENT = '999999.999999';
const OVER_THE_CEILING = { input: (MONTHLY_SPEND_CEILING_USD + 1) * 1_000_000, output: 0 };

const inRepository = (copySite, path) => join(copySite, '..', path);

function stampOfCommittedReport(copySite) {
  const path = inRepository(copySite, REPORT_PATH);
  const stamp = stampedAt(readFileSync(path, 'utf8'));
  if (!stamp) throw new Error(`${path} carries no Generated-at stamp, so the specimen cannot date its record`);
  return stamp;
}

export const spendSpecimens = ({ addUntrackedFile, editFile, removeFile }) => ({
  autowriterSpendReportStale: {
    gate: GATE,
    token: 'none left: the ceiling is reached',
    plant: async (copySite) => {
      const stamp = stampOfCommittedReport(copySite);
      const record = recordOf({ slug: SLUG, at: stamp, calls: [writingCall(OVER_THE_CEILING)] });
      return addUntrackedFile(inRepository(copySite, recordPath('generation', SLUG, stamp)), asText(record));
    },
  },
  autowriterSpendReportEdited: {
    gate: GATE,
    token: `${FORGED_SPENT} USD spent`,
    plant: (copySite) =>
      editFile(inRepository(copySite, REPORT_PATH), (text) =>
        text.replace(SPENT_FIGURE, (_whole, before, after) => `${before}${FORGED_SPENT}${after}`)
      ),
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
