import { mkdtemp, mkdir, readFile, readdir, writeFile, rm } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import {
  agentsCommandsFindings,
  commandsScriptNames,
  extractCommandsBlock,
  gateTestScriptFindings,
  lintSkillsDir,
  pathCandidates,
  resolveCandidate,
  scriptCoverageFindings,
  scriptInvokers,
  skillFindings,
} from './check-skills.mjs';

const fixtureRoot = await mkdtemp(join(tmpdir(), 'check-skills-'));
await mkdir(join(fixtureRoot, 'repo', 'site', 'src', 'utils'), { recursive: true });
await mkdir(join(fixtureRoot, 'repo', 'docs', 'plan'), { recursive: true });
await mkdir(join(fixtureRoot, 'repo', 'site', 'audits'), { recursive: true });
await writeFile(join(fixtureRoot, 'repo', 'docs', 'plan', 'INDEX.md'), '# plan index');
await writeFile(join(fixtureRoot, 'repo', 'site', 'src', 'utils', 'jsonld.mjs'), 'export {}');
await mkdir(join(fixtureRoot, 'repo', 'site', 'scripts'), { recursive: true });
await writeFile(join(fixtureRoot, 'repo', 'site', 'scripts', 'gate.mjs'), 'export {}');

const roots = [join(fixtureRoot, 'repo'), join(fixtureRoot, 'repo', 'site')];

test('a path at the end of a sentence is not read with its full stop attached', () => {
  assert.deepEqual(pathCandidates('then read docs/plan/INDEX.md.'), ['docs/plan/INDEX.md']);
  assert.deepEqual(pathCandidates('see scripts/gate.mjs, then stop'), ['scripts/gate.mjs']);
});

test('pathCandidates picks backticked and bare paths, drops commands and URIs', () => {
  const text =
    'run `npm run gate:machine`, see docs/plan/reference/calibration-gate.md, skip https://meshin.co and mcr.microsoft.com/playwright:v1 images';
  const candidates = pathCandidates(text);
  assert.deepEqual(candidates, ['docs/plan/reference/calibration-gate.md']);
});

test('resolveCandidate tries repo root then site root and expands the ~/ alias', () => {
  assert.equal(resolveCandidate('docs/plan/INDEX.md', roots), join(roots[0], 'docs', 'plan', 'INDEX.md'));
  assert.equal(resolveCandidate('scripts/gate.mjs', roots), join(roots[1], 'scripts', 'gate.mjs'));
  assert.equal(resolveCandidate('~/utils/jsonld.mjs', roots), join(roots[1], 'src', 'utils', 'jsonld.mjs'));
  assert.equal(resolveCandidate('src/utils/nope.mjs', roots), null);
});

test('placeholder path segments resolve to their existing parent directory', () => {
  assert.ok(resolveCandidate('audits/phase-N/', roots));
  assert.equal(resolveCandidate('audits/phase-4/content/', roots), null);
});

test('skillFindings leaves the .omp-perfect-coder path alone', () => {
  const findings = skillFindings({ file: 'omp.md', content: 'config lives in .omp-perfect-coder/config.yml.', roots });
  assert.deepEqual(findings, []);
});

test('skillFindings flags forbidden claims, missing paths and oversized files', () => {
  const findings = skillFindings({
    file: 'bad.md',
    content: [
      'Search is Pagefind loaded on focus.',
      'Set up via .perfect-coder/config.yml.',
      'See scripts/gate.mjs and docs/MISSING.md for details.',
      'Output lands under dist/gate-routes.json.',
      ...Array.from({ length: 90 }, (_, i) => `filler ${i}`),
    ].join('\n'),
    roots,
  });

  const rules = findings.map((finding) => finding.rule);
  assert.ok(rules.includes('forbidden-claim'));
  assert.ok(findings.some((f) => f.rule === 'forbidden-claim' && /pagefind/i.test(f.detail)));
  assert.ok(findings.some((f) => f.rule === 'forbidden-claim' && f.detail.includes('.perfect-coder/')));
  assert.ok(findings.some((f) => f.rule === 'missing-path' && f.detail.includes('docs/MISSING.md')));
  assert.equal(
    findings.some((f) => f.detail.includes('scripts/gate.mjs')),
    false
  );
  assert.ok(rules.includes('max-lines'));
  assert.equal(
    findings.some((f) => f.detail.includes('dist/')),
    false
  );
});

test('lintSkillsDir returns findings for a violating fixture and none for a clean one', async () => {
  const skillsDir = join(fixtureRoot, 'skills');
  await mkdir(skillsDir, { recursive: true });
  await writeFile(
    join(skillsDir, 'violating.md'),
    ['# Violating', '', 'Configure the contact form, then run Pagefind.', '', 'See docs/NOPE.md.'].join('\n')
  );
  await writeFile(
    join(skillsDir, 'clean.md'),
    ['# Clean', '', 'Run `npm run gate:machine`, then read docs/plan/INDEX.md.'].join('\n')
  );

  const findings = await lintSkillsDir(skillsDir, roots);
  const violating = findings.filter((f) => f.file === 'violating.md');
  assert.ok(violating.length >= 3);
  assert.ok(violating.some((f) => f.rule === 'forbidden-claim' && /contact form/i.test(f.detail)));
  assert.ok(violating.some((f) => f.rule === 'forbidden-claim' && /pagefind/i.test(f.detail)));
  assert.ok(violating.some((f) => f.rule === 'missing-path' && f.detail.includes('docs/NOPE.md')));
  assert.deepEqual(
    findings.filter((f) => f.file === 'clean.md'),
    []
  );

  await rm(fixtureRoot, { recursive: true, force: true });
});

test('scriptInvokers maps a script basename to every npm-script key that runs it', () => {
  const invokers = scriptInvokers({
    'gate:lh': 'lhci autorun && node scripts/collect-reports.mjs mobile',
    'gate:lh:one': 'lhci autorun && node scripts/collect-reports.mjs "$FACTOR"',
    'gate:content': 'node scripts/content-gate.mjs dist',
  });
  assert.deepEqual(invokers.get('collect-reports.mjs'), new Set(['gate:lh', 'gate:lh:one']));
  assert.deepEqual(invokers.get('content-gate.mjs'), new Set(['gate:content']));
});

test('scriptCoverageFindings flags a script named nowhere and clears one reachable three ways', () => {
  const scripts = {
    'gate:content': 'node scripts/content-gate.mjs dist',
    'gate:routes': 'node scripts/routes-gate.mjs dist',
  };
  const findings = scriptCoverageFindings({
    scriptFiles: ['content-gate.mjs', 'routes-gate.mjs', 'content-rows.mjs', 'mystery-script.mjs', 'gate.test.mjs'],
    skillsText: 'run `npm run gate:content`; see scripts/routes-gate.mjs and docs/plan/INDEX.md',
    scripts,
  });
  const flagged = findings.map((f) => f.detail);
  assert.ok(flagged.some((detail) => detail.includes('mystery-script.mjs')));
  assert.equal(
    flagged.some((detail) => detail.includes('content-gate.mjs')),
    false
  );
  assert.equal(
    flagged.some((detail) => detail.includes('routes-gate.mjs')),
    false
  );
  assert.equal(
    flagged.some((detail) => detail.includes('content-rows.mjs')),
    false
  );
  assert.equal(
    flagged.some((detail) => detail.includes('gate.test.mjs')),
    false
  );
});

test('gateTestScriptFindings flags an undocumented gate:*/test:* script and clears a documented one', () => {
  const scripts = { 'gate:content': 'x', 'test:smoke': 'x', build: 'x' };
  const findings = gateTestScriptFindings({ scripts, skillsText: 'run `npm run gate:content`' });
  assert.deepEqual(
    findings.map((f) => f.detail),
    ['"test:smoke" is named by no skill']
  );
});

test('extractCommandsBlock and commandsScriptNames read the fenced block after "## Commands"', () => {
  const md = [
    '# doc',
    '',
    '## Commands',
    '',
    '```',
    'cd site',
    'npm run build',
    'npm run gate:lh # slow',
    '```',
    '',
  ].join('\n');
  assert.deepEqual(commandsScriptNames(extractCommandsBlock(md)), ['build', 'gate:lh']);
  assert.equal(extractCommandsBlock('# no commands section'), null);
});

test('agentsCommandsFindings flags a command with no matching package.json script', () => {
  const md = ['## Commands', '```', 'npm run build', 'npm run gate:ghost', '```'].join('\n');
  const findings = agentsCommandsFindings({ agentsMdText: md, scripts: { build: 'astro build' } });
  assert.deepEqual(
    findings.map((f) => f.detail),
    ['"npm run gate:ghost" has no matching script in package.json']
  );
});

test('the real tree clears every L49 reproducibility check', async () => {
  const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const repoRoot = resolve(siteRoot, '..');
  const skillsDir = join(siteRoot, '.agents', 'skills');

  const skillFiles = (await readdir(skillsDir, { recursive: true })).filter((name) => String(name).endsWith('.md'));
  const skillsText = (await Promise.all(skillFiles.map((name) => readFile(join(skillsDir, name), 'utf8')))).join('\n');
  const { scripts } = JSON.parse(await readFile(join(siteRoot, 'package.json'), 'utf8'));
  const scriptFiles = await readdir(join(siteRoot, 'scripts'));
  const agentsMdText = await readFile(join(repoRoot, 'AGENTS.md'), 'utf8');

  const findings = [
    ...gateTestScriptFindings({ scripts, skillsText }),
    ...scriptCoverageFindings({ scriptFiles, skillsText, scripts }),
    ...agentsCommandsFindings({ agentsMdText, scripts }),
  ];

  assert.deepEqual(findings, []);
});

test('a file at exactly the cap passes, because a trailing newline is not a line', () => {
  const atCap = `${Array.from({ length: 80 }, (_, i) => `line ${i}`).join('\n')}\n`;
  assert.deepEqual(
    skillFindings({ file: 'x.md', content: atCap, roots: [] }).filter((f) => f.rule === 'max-lines'),
    []
  );
});

test('one line over the cap still fails', () => {
  const overCap = `${Array.from({ length: 81 }, (_, i) => `line ${i}`).join('\n')}\n`;
  assert.deepEqual(
    skillFindings({ file: 'x.md', content: overCap, roots: [] }).map((f) => f.rule),
    ['max-lines']
  );
});
