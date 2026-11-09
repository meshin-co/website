import { readKeywordReport } from './keyword-report.mjs';
import { ageInDays } from './report-freshness.mjs';

const marketLabel = ({ country, language }) => `country ${country}, language ${language}`;

const figuresOf = ({ phrase, exact, broad, weeks, measured }) => ({ phrase, exact, broad, weeks, measured });

function withinWindow({ measured }, { today, maxAgeDays }) {
  if (measured === null) return false;
  const age = ageInDays(measured, today);
  return age >= 0 && age <= maxAgeDays;
}

export function planPricing({ phrases, previousReport, market, today, maxAgeDays }) {
  const previous = readKeywordReport(previousReport);
  const measuredHere = previous.market === marketLabel(market) ? previous.phrases : [];
  const recent = new Map(
    measuredHere.filter((row) => withinWindow(row, { today, maxAgeDays })).map((row) => [row.phrase, figuresOf(row)])
  );
  return {
    carried: phrases.filter((phrase) => recent.has(phrase)).map((phrase) => recent.get(phrase)),
    due: phrases.filter((phrase) => !recent.has(phrase)),
  };
}
