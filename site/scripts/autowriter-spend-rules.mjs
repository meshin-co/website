import { provenanceOf } from './evidence-gate.mjs';
import { REPORT_PATH, reportText } from './spend-report-text.mjs';

const MAX_SHOWN_LENGTH = 160;
const UNSTAMPED = '<the commit it was generated from>';

const finding = (rule, detail) => ({ rule, path: REPORT_PATH, detail });
const shown = (line) => (line.length > MAX_SHOWN_LENGTH ? `${line.slice(0, MAX_SHOWN_LENGTH - 3)}...` : line);
const linesOf = (text) => text.replace(/\n$/, '').split('\n');

function firstDifference(committed, expected) {
  const have = linesOf(committed);
  const want = linesOf(expected);
  for (let at = 0; at < Math.max(have.length, want.length); at += 1) {
    if (have[at] === want[at]) continue;
    if (have[at] === undefined) return `line ${at + 1} is missing: the records give "${shown(want[at])}"`;
    if (want[at] === undefined) return `line ${at + 1} is extra: the file has "${shown(have[at])}"`;
    return `line ${at + 1} differs: the file has "${shown(have[at])}" but the records give "${shown(want[at])}"`;
  }
  return 'the file must end in exactly one newline';
}

export function spendReportFindings({ ledgers, records, committed }) {
  if (committed === null)
    return [finding('spend-report-missing', 'the file does not exist; run npm run audit:spend to write it')];
  const expected = reportText({ ledgers, records }, provenanceOf(committed) ?? UNSTAMPED);
  if (expected === committed) return [];
  return [
    finding(
      'spend-report-differs',
      `${firstDifference(committed, expected)}; run npm run audit:spend to regenerate it`
    ),
  ];
}
