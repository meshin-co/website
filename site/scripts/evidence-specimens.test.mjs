import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { gitObjectType, provenanceFindings } from './evidence-gate.mjs';
import { SPECIMENS } from './mutation-specimens.mjs';

const scratchRepo = () => {
  const repo = mkdtempSync(join(tmpdir(), 'evidence-specimens-test-'));
  const git = (...args) => execFileSync('git', args, { cwd: repo, stdio: 'ignore' });
  git('init', '-q');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'x');
  mkdirSync(join(repo, 'site'));
  return repo;
};

const plantIn = async (name, path) => {
  const repo = scratchRepo();
  try {
    const restore = await SPECIMENS[name].plant(join(repo, 'site'));
    const text = readFileSync(join(repo, path), 'utf8');
    const objectType = gitObjectType(repo);
    const findings = provenanceFindings([{ path, text }], objectType);
    const revision = /^Generated-from: (\S+)/m.exec(text)?.[1];
    await restore();
    return { findings, revisionType: objectType(revision), leftBehind: existsSync(join(repo, 'audits')) };
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
};

const printed = (findings) => findings.map(({ rule, path }) => `${rule} ${path}`);

test('the not-a-commit specimen names an object the copy really holds, a tree, so only the commit-type check can catch it', async () => {
  const { findings, revisionType, leftBehind } = await plantIn('evidenceRevisionNotACommit', 'audits/zz-specimen.md');
  assert.equal(revisionType, 'tree');
  assert.deepEqual(printed(findings), [SPECIMENS.evidenceRevisionNotACommit.token]);
  assert.equal(leftBehind, false);
});

test('the prose specimen sits where a legacy report sits but off the allow-list, so the allow-list cannot be a path pattern', async () => {
  const path = 'audits/phase-zz/REPORT.md';
  assert.match(path, /^audits\/phase-[^/]+\/REPORT\.md$/);
  const { findings, leftBehind } = await plantIn('evidenceProseOffAllowList', path);
  assert.deepEqual(printed(findings), [SPECIMENS.evidenceProseOffAllowList.token]);
  assert.equal(leftBehind, false);
});
