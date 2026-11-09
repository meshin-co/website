import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { brandFromDisk, titleSuffix } from '../src/utils/brand.mjs';
import { REQUEST_TIMEOUT_MS, answerOf, auditExitCode } from './audit-command.mjs';
import { readEngineConfig } from './engine-config.mjs';
import { withProvenance } from './evidence-gate.mjs';
import { invokedDirectly } from './invoked-directly.mjs';
import {
  collectKeywords,
  keyFrom,
  requestFailure,
  statsRejection,
  statsUrl,
  throttleExhausted,
  weeksFrom,
} from './keyword-demand.mjs';
import { planPricing } from './keyword-demand-cache.mjs';
import { partialNote, renderKeywords, runLine } from './keyword-demand-render.mjs';
import { buildKeywords, expandPhrases, readRouteFacts, termTitles } from './keyword-demand-rows.mjs';
import { generatorRevision } from './report.mjs';
import { readConceptRegister } from './topic-owners.mjs';

const CORE = '../docs/SEMANTIC-CORE.md';
const OUT = '../audits/keyword-demand.md';

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const statsReader = ({ key, market, source }) =>
  async function weeksOf(phrase) {
    let response;
    try {
      response = await fetch(statsUrl({ phrase, ...market, key }), { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch (failure) {
      throw requestFailure(failure, key);
    }
    const body = await answerOf(response);
    if (!response.ok) throw statsRejection(response.status, body, { key, source });
    return weeksFrom(body);
  };

function planFrom(core, { keywords, content }) {
  const routes = readRouteFacts(core, titleSuffix(brandFromDisk()));
  const concepts = readConceptRegister(core).map(({ concept }) => concept);
  const titles = termTitles(routes, content.formats.term.routePrefix);
  const phrases = expandPhrases({ concepts, titles, templates: keywords.templates });
  if (phrases.length === 0) {
    throw new Error(
      'no phrase could be built: docs/SEMANTIC-CORE.md gives keywords.templates no concept or glossary title to fill'
    );
  }
  return { routes, phrases };
}

const readPreviousReport = () => (existsSync(OUT) ? readFileSync(OUT, 'utf8') : '');

function announce(model) {
  const withVolume = model.phrases.filter(({ exact }) => exact > 0).length;
  console.log(
    `audit:keywords: wrote ${OUT} (phrases priced: ${model.phrases.length}; with an exact impression: ${withVolume}; candidates: ${model.candidates.length})`
  );
  console.log(`audit:keywords: ${runLine(model)}`);
  if (model.unmeasured.length > 0) console.log(`audit:keywords: ${partialNote(model)}`);
}

async function main(source) {
  const key = keyFrom(process.env, source);
  const config = readEngineConfig();
  const { keywords } = config;
  const { routes, phrases } = planFrom(readFileSync(CORE, 'utf8'), config);
  const revision = generatorRevision(OUT);
  const measured = new Date().toISOString().slice(0, 10);
  const market = { country: keywords.country, language: keywords.language };
  const { carried, due } = planPricing({
    phrases,
    previousReport: readPreviousReport(),
    market,
    today: measured,
    maxAgeDays: keywords.maxAgeDays,
  });

  const { stats, unreached } = await collectKeywords({
    get: statsReader({ key, market, source }),
    phrases: due,
    wait,
    gapMs: keywords.requestGapMs,
  });
  if (stats.length === 0 && carried.length === 0) throw throttleExhausted(unreached[0]);
  const model = buildKeywords({ measured, market, stats, carried, unmeasured: unreached, routes });

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, withProvenance(renderKeywords(model), revision));
  announce(model);
}

if (invokedDirectly(import.meta.filename, process.argv[1])) {
  process.exitCode = await auditExitCode({ label: 'audit:keywords', main, argv: process.argv });
}
