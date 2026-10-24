import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

import { auditableRoutes, canonicalRoute, isNoindexByDesign } from './lh-routes.cjs';
import { invokedDirectly } from './invoked-directly.mjs';

const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'];

export async function metricBudgets() {
  const load = createRequire(import.meta.url);
  const assert = load('../lighthouserc.cjs').ci.assert;
  const groups = assert.assertMatrix ?? [{ assertions: assert.assertions ?? {} }];
  const budgets = {};
  for (const group of groups) {
    for (const [audit, rule] of Object.entries(group.assertions ?? {})) {
      if (!Array.isArray(rule) || typeof rule[1]?.maxNumericValue !== 'number') continue;
      budgets[audit] = Math.min(budgets[audit] ?? Infinity, rule[1].maxNumericValue);
    }
  }
  return budgets;
}

export function byteBudgets() {
  return createRequire(import.meta.url)('../budgets.json');
}

export function byteBudgetSentence({ js, css, page, fonts } = {}) {
  const gz = `Budgets: JS ≤${js} · CSS ≤${css} · page ≤${page} bytes gzip.`;
  return fonts === undefined ? gz : `${gz.slice(0, -1)} · fonts ≤${fonts} bytes raw.`;
}

export function metricFailures(rows, budgets) {
  return rows.flatMap((row) =>
    Object.entries(budgets).flatMap(([audit, budget]) => {
      const values = row.metrics?.[audit];
      if (!values?.length) return [];
      const value = median(values);
      return value > budget
        ? [`${row.formFactor} ${row.route} ${audit}: ${Math.round(value * 1000) / 1000} over budget ${budget}`]
        : [];
    })
  );
}

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

export async function readReports(dir) {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  const reports = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.startsWith('lhr-')) continue;
    const raw = await readFile(join(entry.parentPath, entry.name));
    const text = entry.name.endsWith('.gz')
      ? await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
      : raw.toString('utf8');
    reports.push(JSON.parse(text));
  }
  return reports;
}

const UNSCORED = new Set(['notApplicable', 'manual', 'informative']);

function scoreWithout(report, category, excluded) {
  const scored = report.categories[category].auditRefs.filter(
    (ref) => ref.weight > 0 && ref.id !== excluded && !UNSCORED.has(report.audits[ref.id]?.scoreDisplayMode)
  );
  const weight = scored.reduce((total, ref) => total + ref.weight, 0);
  if (weight === 0) return 1;
  return scored.reduce((total, ref) => total + ref.weight * (report.audits[ref.id].score ?? 0), 0) / weight;
}

export function categoryScore(report, category, route, distDir) {
  const named = category === 'seo' && isNoindexByDesign(route, distDir);
  const score = named ? scoreWithout(report, category, 'is-crawlable') : report.categories[category].score;
  return Math.round(score * 100);
}

function scoreTable(reports, distDir) {
  const byRoute = new Map();
  for (const report of reports) {
    const path = new URL(report.finalUrl).pathname.replace(/index\.html$/, '').replace(/\.html$/, '') || '/';
    const entry = byRoute.get(path) ?? {};
    for (const category of CATEGORIES) {
      entry[category] = [...(entry[category] ?? []), categoryScore(report, category, path, distDir)];
    }
    entry.metrics ??= {};
    for (const [audit, data] of Object.entries(report.audits)) {
      if (typeof data?.numericValue !== 'number') continue;
      entry.metrics[audit] = [...(entry.metrics[audit] ?? []), data.numericValue];
    }
    byRoute.set(path, entry);
  }
  return [...byRoute.entries()].sort().map(([route, scores]) => ({
    route,
    runs: scores.performance.length,
    metrics: scores.metrics,
    scores: Object.fromEntries(CATEGORIES.map((category) => [category, median(scores[category])])),
  }));
}

function publishableRevision({ head, mergeBase, headIsOnMain }) {
  if (headIsOnMain || mergeBase === undefined) return head;
  return mergeBase;
}

const git = (cwd, ...args) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const gitOrUndefined = (cwd, ...args) => {
  try {
    return git(cwd, ...args);
  } catch {
    return undefined;
  }
};

export function generatorRevision(stampedFile, { integrationBranch = 'origin/main', cwd = process.cwd() } = {}) {
  try {
    const head = git(cwd, 'rev-parse', '--short', 'HEAD');
    const sharedAncestor = gitOrUndefined(cwd, 'merge-base', integrationBranch, 'HEAD');
    return publishableRevision({
      head,
      mergeBase: sharedAncestor === undefined ? undefined : git(cwd, 'rev-parse', '--short', sharedAncestor),
      headIsOnMain: gitOrUndefined(cwd, 'merge-base', '--is-ancestor', 'HEAD', integrationBranch) !== undefined,
    });
  } catch (error) {
    const reason = error.code === 'ENOENT' ? 'git is not on PATH' : String(error.stderr ?? '').trim() || error.message;
    throw new Error(
      `cannot stamp "Generated-from:" into ${stampedFile}: ${reason}. Run the generator inside a git checkout with git on PATH, so the line names a real commit.`,
      { cause: error }
    );
  }
}

export function assertedFamilies(gate) {
  const families = ['lighthouse scores', 'lighthouse metric budgets'];
  if (Array.isArray(gate.overBudget)) families.push('byte budgets');
  return families;
}

export function renderReport({
  phase,
  gate,
  expectedRoutes,
  mobile,
  desktop,
  budgets = {},
  byteBudgets: byteBudgetLimits = {},
  generator = 'unknown',
  distDir,
}) {
  if (!Array.isArray(expectedRoutes)) {
    throw new Error('renderReport: expectedRoutes is required, derived independently of gate-routes.json');
  }
  const exempted = expectedRoutes.filter((route) => isNoindexByDesign(route, distDir));
  const failures = [];
  if (expectedRoutes.length === 0) failures.push('no routes to audit: the built html yielded an empty Lighthouse set');
  for (const [form, rows] of [
    ['mobile', mobile],
    ['desktop', desktop],
  ]) {
    for (const route of expectedRoutes) {
      if (!rows.some((row) => canonicalRoute(row.route) === canonicalRoute(route)))
        failures.push(`${form}: no Lighthouse run for ${route}`);
    }
    for (const row of rows) {
      if (row.runs !== 3) failures.push(`${form} ${row.route}: ${row.runs} runs, gate requires 3`);
      for (const [category, score] of Object.entries(row.scores)) {
        if (score !== 100) failures.push(`${form} ${row.route} ${category}: ${score}`);
      }
    }
  }
  for (const finding of gate.overBudget ?? []) failures.push(`budget: ${finding}`);

  const metricRows = [
    ...mobile.map((row) => ({ formFactor: 'mobile', ...row })),
    ...desktop.map((row) => ({ formFactor: 'desktop', ...row })),
  ];
  const overMetric = metricFailures(metricRows, budgets);
  for (const finding of overMetric) failures.push(`metric: ${finding}`);

  const lines = [
    `# Phase ${phase} — Calibration Gate report`,
    '',
    'Generated from raw check output by `scripts/report.mjs`. Do not hand-edit.',
    '',
    `Generated-from: ${generator}`,
    '',
    `Asserted: ${assertedFamilies(gate).join(', ')}`,
    '',
    ...(exempted.length === 0
      ? []
      : [
          `SEO on ${exempted.map((route) => `\`${route}\``).join(', ')} is scored without \`is-crawlable\`: the built page carries \`noindex\`, so the exemption ends the day the page becomes indexable.`,
          '',
        ]),
    `Lighthouse scope: ${expectedRoutes.length} route(s) expected`,
    '',
    `Result: ${failures.length === 0 ? 'PASS' : 'FAIL'}`,
    '',
    '## Lighthouse (median of 3 runs)',
    '',
    '| Form factor | Route | Performance | Accessibility | Best Practices | SEO |',
    '|---|---|---|---|---|---|',
  ];
  for (const [form, rows] of [
    ['mobile', mobile],
    ['desktop', desktop],
  ]) {
    for (const row of rows) {
      lines.push(
        `| ${form} | \`${row.route}\` | ${row.scores.performance} | ${row.scores.accessibility} | ${row.scores['best-practices']} | ${row.scores.seo} |`
      );
    }
  }
  lines.push(
    '',
    '## Measured byte budgets (gzip)',
    '',
    '| Route | JS | CSS | Page total | Fonts (raw) |',
    '|---|---|---|---|---|'
  );
  for (const row of gate.measured) {
    lines.push(`| \`${row.route}\` | ${row.js} | ${row.css} | ${row.page} | ${row.fonts} |`);
  }
  lines.push('', byteBudgetSentence(byteBudgetLimits), '');
  lines.push(
    '## Lighthouse route selection',
    '',
    'One leaf per repeated template family (heaviest by built bytes) plus every unique page:',
    expectedRoutes.map((route) => `\`${route}\``).join(', '),
    '',
    '## Derived route list (all gates)',
    '',
    gate.routes.map((route) => `\`${route}\``).join(', '),
    ''
  );
  if (failures.length > 0) lines.push('## Failures', '', ...failures.map((failure) => `- ${failure}`), '');
  return { markdown: `${lines.join('\n')}`, failures };
}

export async function phaseVerdict(phase, auditDir, distDir = process.env.LH_DIST_DIR || 'dist') {
  const gate = JSON.parse(await readFile(join(distDir, 'gate-routes.json'), 'utf8'));
  return renderReport({
    phase,
    gate,
    expectedRoutes: auditableRoutes(distDir),
    mobile: scoreTable(await readReports(join(auditDir, 'lh-mobile')), distDir),
    desktop: scoreTable(await readReports(join(auditDir, 'lh-desktop')), distDir),
    budgets: await metricBudgets(),
    byteBudgets: byteBudgets(),
    generator: generatorRevision(join(auditDir, 'REPORT.md')),
    distDir,
  });
}

export async function main(phase, auditDir) {
  if (!phase || !auditDir)
    throw new Error(
      'name the bucket to write: node scripts/report.mjs <phase> <audit-dir>, for example node scripts/report.mjs ci ../audits/phase-ci'
    );
  const { markdown, failures } = await phaseVerdict(phase, auditDir);
  await writeFile(join(auditDir, 'REPORT.md'), markdown);
  console.log(markdown);
  if (failures.length > 0) process.exitCode = 1;
}

if (invokedDirectly(import.meta.filename, process.argv[1])) {
  await main(process.argv[2], process.argv[3]);
}
