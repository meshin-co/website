import { measuredOf } from './report-reading.mjs';

const DAY_MS = 86_400_000;
const MAX_CLOCK_SKEW_DAYS = 1;

const dayStart = (iso) => Date.parse(`${iso}T00:00:00Z`);

const isCalendarDate = (iso) => Number.isFinite(dayStart(iso)) && new Date(dayStart(iso)).toISOString().startsWith(iso);

export const ageInDays = (from, to) => (dayStart(to) - dayStart(from)) / DAY_MS;

export function measuredDate(markdown) {
  const { measured } = measuredOf(markdown);
  return measured !== null && isCalendarDate(measured) ? measured : null;
}

const stale = (report, detail) => [{ rule: 'report-stale', path: report, detail }];

export function staleFindings({ measured, today, report, refresh, maxAgeDays }) {
  if (measured === null) {
    return stale(
      report,
      `no "Measured: YYYY-MM-DD" line with a real date, so its age cannot be shown; make it with ${refresh}`
    );
  }
  const age = ageInDays(measured, today);
  if (age > maxAgeDays) {
    return stale(report, `measured ${measured}; refresh with ${refresh} (${age} days old, limit ${maxAgeDays})`);
  }
  if (age < -MAX_CLOCK_SKEW_DAYS) {
    return stale(
      report,
      `measured ${measured}, ${-age} days after today ${today}; a date in the future cannot show it fresh, so re-measure with ${refresh}`
    );
  }
  return [];
}
