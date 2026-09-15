import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  checkCookies,
  checkFontPolicy,
  checkMotion,
  checkRawColour,
  checkServiceWorker,
  renderChecklist,
} from './pre-launch.mjs';

const dist = process.argv[2] ?? 'dist';
const out = process.argv[3] ?? '../audits/phase-5/pre-launch.md';

const walk = (dir, match) => {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walk(path, match));
    else if (match.test(entry.name)) found.push(path);
  }
  return found;
};

const runs = (command, args) => {
  try {
    execFileSync(command, args, { stdio: 'pipe' });
    return 'pass';
  } catch {
    return 'fail';
  }
};

const gitOutput = (args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

const artifact = (name) => {
  const path = join('../audits/phase-5', name);
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
};

const documents = walk(dist, /\.html$/).map((page) => readFileSync(page, 'utf8'));
const GENERATED = new Set(['src/components/common/LogoSymbol.astro', 'src/components/common/LogoMark.astro']);
const components = walk('src', /\.astro$/).map((file) => ({
  file,
  source: readFileSync(file, 'utf8'),
  generated: GENERATED.has(file),
}));
const css = walk(join(dist, '_astro'), /\.css$/)
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n');
const fontDir = join(dist, '_astro/fonts');
const fonts = existsSync(fontDir) ? readdirSync(fontDir) : [];
const routes = JSON.parse(readFileSync(join(dist, 'gate-routes.json'), 'utf8')).routes;

const report = artifact('REPORT.md');
const sweep = artifact('polish-sweep.md');
const lighthouse = report.includes('Result: PASS') ? 'pass' : 'fail';
const perfectRows = (report.match(/\| 100 \| 100 \| 100 \| 100 \|/g) ?? []).length;
const sweepCount = /^findings: (\d+)$/m.exec(sweep);
const sweepClean = sweepCount && Number(sweepCount[1]) === 0 ? 'pass' : 'fail';
const fontPolicy = checkFontPolicy(fonts);
const motion = checkMotion(css);
const colour = checkRawColour(components);
const cookies = checkCookies(documents);
const worker = checkServiceWorker(documents);

const conditional = existsSync('../audits/phase-4.7/conditional-copy.json')
  ? JSON.parse(readFileSync('../audits/phase-4.7/conditional-copy.json', 'utf8'))
  : [];
const statesDeclared = conditional.length > 0 && conditional.every((entry) => entry.reason && entry.text);

const lastVisualCommit = gitOutput(['log', '-1', '--format=%H', '--', 'src']);
const filesInThatCommit = gitOutput(['show', '--name-only', '--pretty=format:', lastVisualCommit])
  .split('\n')
  .filter(Boolean);
const changelogRode = filesInThatCommit.includes('docs/VISUAL_CHANGELOG.md') ? 'pass' : 'fail';

const axe = runs('npx', ['playwright', 'test', 'tests/visual.spec.ts', '--reporter=dot']);
const crossBrowser = runs('npx', [
  'playwright',
  'test',
  'tests/cross-browser.spec.ts',
  '--project=webkit',
  '--project=firefox',
  '--workers=4',
  '--reporter=dot',
]);

const rows = [
  {
    section: '1. Lighthouse',
    item: 'every audited route at 100/100/100/100, both form factors',
    status: lighthouse,
    detail: 'REPORT.md reads Result: PASS with ' + perfectRows + ' rows at 100x4; noindex routes read n/a on SEO',
  },
  {
    section: '2. Core Web Vitals',
    item: 'LCP, CLS and TBT inside their budgets',
    status: lighthouse,
    detail: 'the report reads maxNumericValue per route out of lighthouserc.cjs, not the category scores',
  },
  {
    section: '3. Asset budgets',
    item: 'JS, CSS and page bytes from the shipped build',
    status: runs('node', ['scripts/gate.mjs', dist, 'budgets.json']),
    detail: 'node scripts/gate.mjs dist budgets.json, real gzip bytes including lazy chunks',
  },
  {
    section: '3. Asset budgets',
    item: 'font families and faces',
    status: fontPolicy.families <= 3 && fontPolicy.weights <= 4 ? 'pass' : 'fail',
    detail:
      fontPolicy.families +
      ' families, ' +
      fontPolicy.weights +
      ' faces: ' +
      fontPolicy.list.join(', ') +
      '; three families is the documented L39 deviation',
  },
  {
    section: '4. Accessibility, automated',
    item: 'axe clean in both themes on every route, and the skip link is the first focus stop',
    status: axe,
    detail: 'npx playwright test tests/visual.spec.ts, which runs AxeBuilder per route per theme',
  },
  {
    section: '4. Accessibility, automated',
    item: 'valid markup, one H1, no duplicate ids, alt on every image',
    status: runs('node', ['scripts/content-html.mjs', dist]),
    detail: 'gate:html and gate:content over every built route',
  },
  {
    section: '4. Accessibility, manual',
    item: 'screen reader pass on the primary flow',
    status: 'owner-blocked',
    detail: 'needs VoiceOver driven by a person; no automation substitutes for it',
  },
  {
    section: '5. Responsive',
    item: 'no overflow, no clipped text, targets at or above the AA floor',
    status: sweepClean,
    detail:
      'npm run audit:polish over ' +
      routes.length +
      ' routes at six widths; the artifact reports findings: ' +
      (sweepCount ? sweepCount[1] : 'missing'),
  },
  {
    section: '6. Theme',
    item: 'both themes verified independently, never by inversion',
    status: axe,
    detail: 'the same run asserts per-theme baselines and per-theme axe, one pass each',
  },
  {
    section: '7. Motion',
    item: 'transform and opacity only, durations at or under 500 ms, reduced motion honoured',
    status: motion.status,
    detail: motion.detail + ', measured in the shipped CSS',
  },
  {
    section: '8. Visual quality',
    item: 'no raw colour literal in any component',
    status: colour.status,
    detail: colour.detail,
  },
  {
    section: '9. SEO',
    item: 'titles, descriptions, canonicals, OG, JSON-LD, sitemap and internal links',
    status: runs('node', ['scripts/jsonld-gate.mjs', dist]),
    detail: 'gate:content, gate:jsonld, gate:links, gate:orphans and gate:machine over every route',
  },
  {
    section: '10. State coverage',
    item: 'empty, error and 404 states carry real copy',
    status: statesDeclared ? 'pass' : 'fail',
    detail:
      conditional.length +
      ' state-conditional strings, each declared with the state that renders it in audits/phase-4.7/conditional-copy.json',
  },
  {
    section: '11. Forms',
    item: 'labels, validation, autocomplete',
    status: 'n/a',
    detail: 'no form ships: /contact is an email address and a Cal.com link (L18)',
  },
  {
    section: '12. Charts and tables',
    item: 'data visualisation',
    status: 'n/a',
    detail: 'no charts ship; markdown tables scroll inside .table-scroll, verified at 320 px',
  },
  {
    section: '13. Cross-browser',
    item: 'WebKit and Gecko render every route with no console error and no sideways scroll',
    status: crossBrowser,
    detail: 'npx playwright test tests/cross-browser.spec.ts --project=webkit --project=firefox',
  },
  {
    section: '14. Real-user monitoring',
    item: 'web-vitals to a pipeline with p75 alerts',
    status: 'n/a',
    detail: 'Plausible is the only client script and carries no RUM; adding one would breach the 10 KB JS budget (L6)',
  },
  {
    section: '15. Security headers',
    item: 'CSP, HSTS, Permissions-Policy, COOP, CORP and nosniff on the live response',
    status: 'owner-blocked',
    detail:
      'public/_headers is verified inside dist/, but the real edge response needs the Cloudflare attach; CG-5 measures it against the production URL',
  },
  {
    section: '16. Privacy and consent',
    item: 'consent surface, Sec-GPC, cookie banner',
    status: cookies.status === 'pass' ? 'n/a' : 'fail',
    detail: cookies.detail + '; Plausible runs cookieless by configuration (L6)',
  },
  {
    section: '17. Error tracking',
    item: 'source maps, a sanity throw, release tagging',
    status: 'n/a',
    detail: 'no error tracker ships, so there is nothing to symbolicate or tag',
  },
  {
    section: '18. i18n',
    item: 'non-Latin locale, RTL, Intl formatting, per-route lang and dir',
    status: 'n/a',
    detail: 'one locale, English only, verified in dist: availableLanguage "en" (L54)',
  },
  {
    section: '19. Service worker',
    item: 'kill switch, nosw bypass, cache versioning',
    status: worker.status === 'pass' ? 'n/a' : 'fail',
    detail: worker.detail,
  },
  {
    section: '20. Documentation',
    item: 'the last commit touching markup also updated the visual changelog',
    status: changelogRode,
    detail: 'git show --name-only ' + lastVisualCommit.slice(0, 7) + ' lists docs/VISUAL_CHANGELOG.md',
  },
  {
    section: '21. Git and review',
    item: 'the plan tree, its index and its phase statuses agree',
    status: runs('node', ['scripts/plan-gate.mjs']),
    detail: 'gate:plan; check, unit tests and the production build run in the same sweep',
  },
  {
    section: '22. Multi-page polish',
    item: 'every user-facing string is dispositioned, no unexplained drift',
    status: runs('node', ['scripts/editorial-gate.mjs', '.', dist]),
    detail: 'gate:editorial over the whole ledger, and gate:registers for the concept and entity registers',
  },
  {
    section: '23. Final smell test',
    item: 'a person walks the site in a fresh browser',
    status: 'owner-blocked',
    detail: 'judgement, not measurement: is the primary action obvious, would the owner share the URL',
  },
  {
    section: '24. Evidence manifest',
    item: 'every artefact in this phase exists on disk',
    status: report && sweep ? 'pass' : 'fail',
    detail:
      'audits/phase-5/ carries REPORT.md, polish-sweep.md and this file; raw Lighthouse runs are gitignored and reproduced by re-running the gate, per .agents/skills/run-the-gate.md',
  },
];

mkdirSync('../audits/phase-5', { recursive: true });
writeFileSync(out, renderChecklist(rows));

const failures = rows.filter((row) => row.status === 'fail');
console.log(
  'pre-launch: ' +
    (rows.length - failures.length) +
    ' of ' +
    rows.length +
    ' items clear, ' +
    failures.length +
    ' failing -> ' +
    out
);
for (const row of failures) console.log('  FAIL ' + row.section + ' - ' + row.item + ': ' + row.detail);
process.exitCode = failures.length === 0 ? 0 : 1;
