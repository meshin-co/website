import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'];

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

async function readReports(dir) {
  const files = (await readdir(dir)).filter((name) => name.startsWith('lhr-'));
  const reports = [];
  for (const name of files) {
    const raw = await readFile(join(dir, name));
    const text = name.endsWith('.gz')
      ? await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
      : raw.toString('utf8');
    reports.push(JSON.parse(text));
  }
  return reports;
}

function scoreTable(reports) {
  const byRoute = new Map();
  for (const report of reports) {
    const path = new URL(report.finalUrl).pathname.replace(/index\.html$/, '').replace(/\.html$/, '') || '/';
    const entry = byRoute.get(path) ?? {};
    for (const category of CATEGORIES) {
      entry[category] = [...(entry[category] ?? []), Math.round(report.categories[category].score * 100)];
    }
    byRoute.set(path, entry);
  }
  return [...byRoute.entries()].sort().map(([route, scores]) => ({
    route,
    runs: scores.performance.length,
    scores: Object.fromEntries(CATEGORIES.map((category) => [category, median(scores[category])])),
  }));
}

export function renderReport({ phase, gate, mobile, desktop }) {
  const failures = [];
  for (const [form, rows] of [
    ['mobile', mobile],
    ['desktop', desktop],
  ]) {
    for (const route of gate.routes) {
      if (!rows.some((row) => row.route === route)) failures.push(`${form}: no Lighthouse run for ${route}`);
    }
    for (const row of rows) {
      if (row.runs !== 3) failures.push(`${form} ${row.route}: ${row.runs} runs, gate requires 3`);
      for (const [category, score] of Object.entries(row.scores)) {
        if (score !== 100) failures.push(`${form} ${row.route} ${category}: ${score}`);
      }
    }
  }
  for (const finding of gate.overBudget ?? []) failures.push(`budget: ${finding}`);

  const lines = [
    `# Phase ${phase} — Calibration Gate report`,
    '',
    'Generated from raw check output by `scripts/report.mjs`. Do not hand-edit.',
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
  lines.push('', '## Measured byte budgets (gzip)', '', '| Route | JS | CSS | Page total |', '|---|---|---|---|');
  for (const row of gate.measured) {
    lines.push(`| \`${row.route}\` | ${row.js} | ${row.css} | ${row.page} |`);
  }
  lines.push('', `Budgets: JS ≤10240 · CSS ≤20480 · page ≤256000 bytes gzip.`, '');
  lines.push('## Derived route list', '', gate.routes.map((route) => `\`${route}\``).join(', '), '');
  if (failures.length > 0) lines.push('## Failures', '', ...failures.map((failure) => `- ${failure}`), '');
  return { markdown: `${lines.join('\n')}`, failures };
}

async function main(phase, auditDir) {
  const gate = JSON.parse(await readFile(join('dist', 'gate-routes.json'), 'utf8'));
  const { markdown, failures } = renderReport({
    phase,
    gate,
    mobile: scoreTable(await readReports(join(auditDir, 'lh-mobile'))),
    desktop: scoreTable(await readReports(join(auditDir, 'lh-desktop'))),
  });
  await writeFile(join(auditDir, 'REPORT.md'), markdown);
  console.log(markdown);
  if (failures.length > 0) process.exitCode = 1;
}

if (import.meta.filename === process.argv[1]) {
  await main(process.argv[2] ?? '1', process.argv[3] ?? '../audits/phase-1');
}
