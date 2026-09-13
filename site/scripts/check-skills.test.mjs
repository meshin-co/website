import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { lintSkillsDir, pathCandidates, resolveCandidate, skillFindings } from './check-skills.mjs';

const fixtureRoot = await mkdtemp(join(tmpdir(), 'check-skills-'));
await mkdir(join(fixtureRoot, 'repo', 'site', 'src', 'utils'), { recursive: true });
await mkdir(join(fixtureRoot, 'repo', 'docs'), { recursive: true });
await mkdir(join(fixtureRoot, 'repo', 'site', 'audits'), { recursive: true });
await writeFile(join(fixtureRoot, 'repo', 'docs', 'PLAN.md'), '# plan');
await writeFile(join(fixtureRoot, 'repo', 'site', 'src', 'utils', 'jsonld.mjs'), 'export {}');
await mkdir(join(fixtureRoot, 'repo', 'site', 'scripts'), { recursive: true });
await writeFile(join(fixtureRoot, 'repo', 'site', 'scripts', 'gate.mjs'), 'export {}');

const roots = [join(fixtureRoot, 'repo'), join(fixtureRoot, 'repo', 'site')];

test('pathCandidates picks backticked and bare paths, drops commands and URIs', () => {
  const text =
    'run `npm run gate:machine`, see docs/PLAN.md §3, skip https://meshin.co and mcr.microsoft.com/playwright:v1 images';
  const candidates = pathCandidates(text);
  assert.deepEqual(candidates, ['docs/PLAN.md']);
});

test('resolveCandidate tries repo root then site root and expands the ~/ alias', () => {
  assert.equal(resolveCandidate('docs/PLAN.md', roots), join(roots[0], 'docs', 'PLAN.md'));
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
    ['# Clean', '', 'Run `npm run gate:machine`, then read docs/PLAN.md §3.'].join('\n')
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
