import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { test } from 'node:test';

import { historySpecimens } from './autowriter-history-specimens.mjs';
import { DISPOSITION_DIRECTORY, sealSignature } from './autowriter-refusals.mjs';
import { autowriterSpecimens } from './autowriter-specimens.mjs';
import { BOT, HUMAN, commitAs, gitIn, initRepo, removeRepos, shallowClone } from './fixtures/history-repo.mjs';
import { realBandFiles } from './fixtures/record-rules-scene.mjs';
import { generationFile } from './generation-record.mjs';
import { FAMILIES, manifestFamilies } from './mutation-smoke.mjs';
import { SPECIMENS, flatten, proveWithSpecimen } from './mutation-specimens.mjs';

const SITE = resolve(import.meta.dirname, '..');
const REPO = resolve(SITE, '..');
const RECORD = generationFile('zz-specimen');
const PROVENANCE = new RegExp(`^Provenance: ${RECORD.replaceAll('.', '\\.')}$`, 'm');
const DISPOSITIONS = `${DISPOSITION_DIRECTORY}/main.json`;
const REFUSED = [
  {
    name: 'autowriterCommitMovesTheBand',
    family: 'autowriter-commit-moves-the-sentence-band',
    path: 'audits/sentence-band.json',
    id: 'sentence-band',
  },
  {
    name: 'autowriterCommitMovesTheEntryLength',
    family: 'autowriter-commit-moves-the-entry-length',
    path: 'audits/entry-length.json',
    id: 'entry-length',
  },
  {
    name: 'autowriterCommitWritesLighthouseRecord',
    family: 'autowriter-commit-writes-the-lighthouse-record',
    path: 'audits/lighthouse-green.json',
    id: 'lighthouse-record',
  },
  {
    name: 'autowriterCommitWritesLighthouseStamp',
    family: 'autowriter-commit-writes-a-lighthouse-stamp',
    path: 'audits/phase-zz/lh-measured.json',
    id: 'lighthouse-stamp',
  },
  {
    name: 'autowriterCommitWritesLighthouseReport',
    family: 'autowriter-commit-writes-a-lighthouse-report',
    path: 'audits/phase-zz/lh-mobile/lhr-0.json',
    id: 'lighthouse-report',
  },
];
const SEAL = { name: 'autowriterCommitSealsDispositions', family: 'autowriter-commit-seals-dispositions' };
const REMOVAL = {
  name: 'autowriterCommitRemovesAGenerationRecord',
  family: 'autowriter-commit-removes-a-generation-record',
};
const DEBT = {
  name: 'autowriterMeasurementDebtMissing',
  family: 'autowriter-merged-ledger-without-its-measurement-debt',
};
const NAMES = [...REFUSED.map(({ name }) => name), SEAL.name, REMOVAL.name].sort();
const TOKENS = {
  ...Object.fromEntries(
    REFUSED.map(({ name, path, id }) => [name, `refused-path-committed ${RECORD}: touched ${path} (${id}:`])
  ),
  [SEAL.name]: `disposition-seal-committed ${RECORD}: sealed`,
  [REMOVAL.name]: `generation-record-removed-committed ${RECORD}: removed ${RECORD} (generation-record-removed:`,
};
const entry = (target, digest) => ({
  target,
  location: 'frontmatter.title',
  status: 'verified',
  reason: 'Read on 2026-10-08 against the built page.',
  digest,
});
const dispositions = [entry('src/data/post/a.md', 'a1b2c3d4e5f6'), entry('src/data/post/b.md', '0123456789ab')];
const FILES = {
  'site/src/config.yaml': 'site:\n  name: meshin.co\n',
  'docs/SEMANTIC-CORE.md': readFileSync(join(REPO, 'docs/SEMANTIC-CORE.md'), 'utf8'),
  '.github/workflows/ci.yml': readFileSync(join(REPO, '.github/workflows/ci.yml'), 'utf8'),
  ...realBandFiles(),
  [DISPOSITIONS]: `${JSON.stringify(dispositions, null, 2)}\n`,
};

async function inScene(check, files = FILES) {
  const root = mkdtempSync(join(tmpdir(), 'autowriter-history-specimens-'));
  try {
    for (const [path, body] of Object.entries(files)) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), body);
    }
    initRepo(root);
    commitAs(root, HUMAN, { message: 'chore(fixture): start' });
    return await check(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const workingTree = (root, at = root) =>
  readdirSync(at, { withFileTypes: true })
    .filter((found) => found.name !== '.git')
    .flatMap((found) => {
      const path = join(at, found.name);
      return found.isDirectory() ? workingTree(root, path) : [[relative(root, path), readFileSync(path, 'utf8')]];
    })
    .sort(([left], [right]) => left.localeCompare(right));

const stateOf = (root) => ({
  index: readFileSync(join(root, '.git/index')),
  head: gitIn(root, ['rev-parse', 'HEAD']).trim(),
  status: gitIn(root, ['--no-optional-locks', 'status', '--porcelain=v1', '--untracked-files=all', '-z']),
  gitEntries: readdirSync(join(root, '.git')).sort(),
  tree: workingTree(root),
});

const gate = (root) =>
  spawnSync(process.execPath, ['scripts/autowriter-gate.mjs', root], { cwd: SITE, encoding: 'utf8' });
const planted = (name, root) => {
  assert.ok(SPECIMENS[name], `${name} is not in the specimen registry`);
  return SPECIMENS[name].plant(join(root, 'site'));
};
const lastCommit = (root, format) => gitIn(root, ['log', '-1', `--format=${format}`]).trim();
const changedBy = (root) =>
  gitIn(root, ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD']).trim().split('\n');

test('the history specimens are the four refusals and the seal, each against gate:autowriter with a token of its own', () => {
  assert.deepEqual(Object.keys(historySpecimens()).sort(), NAMES);
  for (const name of NAMES) {
    assert.ok(SPECIMENS[name], `${name} is not in the specimen registry`);
    assert.equal(SPECIMENS[name].gate, 'gate:autowriter', name);
    assert.equal(typeof SPECIMENS[name].plant, 'function', name);
    assert.equal(SPECIMENS[name].token, TOKENS[name], name);
  }
  const every = Object.values(autowriterSpecimens({})).map(({ token }) => token);
  assert.equal(new Set(every).size, every.length, 'two autowriter specimens share a token');
});

test('each refusal and the missing measurement debt has its own family, and each family names its specimen', () => {
  const families = manifestFamilies(FAMILIES);
  for (const { name, family: id } of [...REFUSED, SEAL, REMOVAL, DEBT]) {
    const family = families.find((found) => found.id === id);
    assert.equal(family?.kind, 'specimen', id);
    assert.equal(family.specimen, name, id);
    assert.ok(SPECIMENS[name], `${name} is not in the specimen registry`);
  }
});

for (const name of NAMES) {
  test(`${name} is green before, red with its own token when planted, and undone after`, async () => {
    await inScene(async (root) => {
      assert.ok(SPECIMENS[name], `${name} is not in the specimen registry`);
      const before = stateOf(root);
      const green = gate(root);
      assert.equal(green.status, 0, green.stderr);
      assert.equal(flatten(green.stderr).includes(SPECIMENS[name].token), false);
      const restore = await planted(name, root);
      const during = stateOf(root);
      const red = gate(root);
      assert.equal(red.status, 1, `the gate stayed green on ${name}: ${red.stdout}`);
      assert.ok(flatten(red.stderr).includes(SPECIMENS[name].token), `token not printed: ${red.stderr}`);
      assert.equal(red.stderr.trim().split('\n').length, 1, red.stderr);
      assert.notEqual(during.head, before.head);
      assert.deepEqual(during.index, before.index, 'the plant wrote the index');
      assert.deepEqual(during.tree, before.tree, 'the plant wrote the working tree');
      await restore();
      assert.deepEqual(stateOf(root), before);
      assert.equal(gate(root).status, 0);
    });
  });
}

for (const name of NAMES.filter((found) => found !== REMOVAL.name)) {
  test(`${name} plants one commit of the bot on top of HEAD that names its record in a Provenance line`, async () => {
    await inScene(async (root) => {
      const original = gitIn(root, ['rev-parse', 'HEAD']).trim();
      const restore = await planted(name, root);
      assert.equal(lastCommit(root, '%P'), original);
      assert.equal(lastCommit(root, '%an|%ae|%cn|%ce'), [BOT.name, BOT.email, BOT.name, BOT.email].join('|'));
      assert.match(gitIn(root, ['log', '-1', '--format=%B']), PROVENANCE);
      const refused = REFUSED.find((found) => found.name === name)?.path ?? DISPOSITIONS;
      assert.deepEqual(changedBy(root).sort(), [RECORD, refused].sort());
      await restore();
      assert.equal(gitIn(root, ['rev-parse', 'HEAD']).trim(), original);
    });
  });
}

test('the removal plants two commits of the bot: one adds the record, the next removes it and nothing else', async () => {
  await inScene(async (root) => {
    const original = gitIn(root, ['rev-parse', 'HEAD']).trim();
    const restore = await planted(REMOVAL.name, root);
    const [removing, adding] = gitIn(root, ['rev-list', '--max-count=2', 'HEAD']).trim().split('\n');
    assert.equal(gitIn(root, ['rev-parse', `${adding}^`]).trim(), original);
    assert.equal(gitIn(root, ['rev-parse', `${removing}^`]).trim(), adding);
    for (const commit of [adding, removing]) {
      const identity = gitIn(root, ['log', '-1', '--format=%an|%ae|%cn|%ce', commit]).trim();
      assert.equal(identity, [BOT.name, BOT.email, BOT.name, BOT.email].join('|'));
      assert.match(gitIn(root, ['log', '-1', '--format=%B', commit]), PROVENANCE);
    }
    const touched = (commit, filter) =>
      gitIn(root, [
        'diff-tree',
        '--no-renames',
        '--no-commit-id',
        '--name-only',
        `--diff-filter=${filter}`,
        '-r',
        commit,
      ])
        .trim()
        .split('\n');
    assert.deepEqual(touched(adding, 'ACMRTUXB'), [RECORD]);
    assert.deepEqual(touched(removing, 'D'), [RECORD]);
    assert.deepEqual(touched(removing, 'ACMRTUXB'), ['']);
    assert.equal(gitIn(root, ['ls-tree', '-r', '--name-only', 'HEAD', '--', RECORD]).trim(), '');
    await restore();
    assert.equal(gitIn(root, ['rev-parse', 'HEAD']).trim(), original);
  });
});

test('the removal is found only as a removed record, never as a refused path', async () => {
  await inScene(async (root) => {
    const restore = await planted(REMOVAL.name, root);
    const red = gate(root);
    assert.equal(red.status, 1, red.stdout);
    assert.equal(flatten(red.stderr).includes('refused-path-committed'), false, red.stderr);
    assert.ok(flatten(red.stderr).includes(`AUTOWRITER generation-record-removed-committed ${RECORD}:`), red.stderr);
    await restore();
  });
});

test('the sealing commit changes the digest of one entry of a disposition file and nothing else in it', async () => {
  await inScene(async (root) => {
    const original = gitIn(root, ['rev-parse', 'HEAD']).trim();
    const restore = await planted(SEAL.name, root);
    const before = gitIn(root, ['show', `${original}:${DISPOSITIONS}`]);
    const after = gitIn(root, ['show', `HEAD:${DISPOSITIONS}`]);
    const [first, ...others] = JSON.parse(before);
    const [moved, ...rest] = JSON.parse(after);
    assert.match(moved.digest, /^[0-9a-f]{12}$/);
    assert.notEqual(moved.digest, first.digest);
    assert.deepEqual({ ...moved, digest: first.digest }, first);
    assert.deepEqual(rest, others);
    assert.equal(sealSignature({ path: DISPOSITIONS, before, after })?.id, 'disposition-seal');
    await restore();
  });
});

test('a plant outside a git repository fails before it writes anything, and says so', async () => {
  const plain = mkdtempSync(join(tmpdir(), 'autowriter-history-specimens-plain-'));
  try {
    mkdirSync(join(plain, 'site'));
    for (const name of NAMES) await assert.rejects(() => planted(name, plain), /is not a git repository/, name);
    assert.deepEqual(readdirSync(plain), ['site']);
  } finally {
    rmSync(plain, { recursive: true, force: true });
  }
});

test('a plant in a shallow clone fails and leaves HEAD and the git directory as they were', async () => {
  await inScene(async (root) => {
    commitAs(root, HUMAN, { write: { 'more.txt': 'm\n' }, message: 'chore(fixture): more' });
    const clone = shallowClone(root);
    try {
      const before = stateOf(clone);
      for (const name of NAMES) await assert.rejects(() => planted(name, clone), /shallow/, name);
      assert.deepEqual(stateOf(clone), before);
    } finally {
      removeRepos(clone);
    }
  });
});

test('a seal with no disposition file at HEAD to copy fails and leaves the repository as it was', async () => {
  const without = Object.fromEntries(Object.entries(FILES).filter(([path]) => path !== DISPOSITIONS));
  await inScene(async (root) => {
    const before = stateOf(root);
    await assert.rejects(() => planted(SEAL.name, root), /disposition/);
    assert.deepEqual(stateOf(root), before);
  }, without);
});

test('a GIT_DIR in the environment does not send the plant to another repository', async () => {
  await inScene(async (root) => {
    await inScene(async (other) => {
      const untouched = stateOf(other);
      const kept = process.env.GIT_DIR;
      process.env.GIT_DIR = join(other, '.git');
      try {
        const restore = await planted(NAMES[0], root);
        assert.deepEqual(stateOf(other), untouched);
        assert.equal(lastCommit(root, '%ae'), BOT.email);
        await restore();
      } finally {
        if (kept === undefined) delete process.env.GIT_DIR;
        else process.env.GIT_DIR = kept;
      }
    });
  });
});

for (const name of NAMES) {
  test(`${name} is proven by the harness itself, green on the pristine copy and red on the specimen`, async () => {
    await inScene(async (root) => {
      const run = async () => {
        const found = gate(root);
        return { code: found.status, output: `${found.stdout}${found.stderr}` };
      };
      const outcome = await proveWithSpecimen(SPECIMENS[name], { copySite: join(root, 'site'), run });
      assert.equal(outcome.ok, true, outcome.reason);
      assert.equal(gitIn(root, ['rev-list', '--count', 'HEAD']).trim(), '1');
    });
  });
}
