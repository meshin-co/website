import assert from 'node:assert/strict';
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { exportEngine, main } from './export-engine.mjs';
import { gitAt } from './fixtures/diff-repo.mjs';
import { writeScene } from './fixtures/export-scene.mjs';
import { SCENE_TEXT } from './fixtures/partition-scene.mjs';
import { readEngineConfig } from './engine-config.mjs';
import { WRITE_DAILY_PATH, scheduleFindings } from './schedule-workflow.mjs';

const FONT = 'site/src/assets/fonts/Face.ttf';
const HOOK = '.githooks/pre-push';
const FONT_BYTES = Buffer.from([0x00, 0x01, 0x00, 0x00, 0xff, 0xfe, 0x0d, 0x0a, 0x80]);

const scratch = (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'export-engine-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
};

const { diff, content } = JSON.parse(SCENE_TEXT['site/engine.config.json']);
const seedConfig = JSON.parse(
  readFileSync(join(import.meta.dirname, '..', 'engine.config.json'), 'utf8').replaceAll('example', 'sample')
);
const SEED_CONFIG = JSON.stringify({
  ...seedConfig,
  diff: { ...seedConfig.diff, ...diff },
  content: { ...seedConfig.content, ...content },
});
const SOURCE_WORKFLOW = "name: Write daily\non:\n  schedule:\n    - cron: '59 5 * * *'\n  workflow_dispatch:\n";

function repository(t, options = {}) {
  const root = scratch(t);
  const extra = { 'site/engine.config.json': SEED_CONFIG, [WRITE_DAILY_PATH]: SOURCE_WORKFLOW, ...options.extra };
  return { root, files: writeScene(root, { ...options, extra, bytes: { [FONT]: FONT_BYTES } }) };
}

const treeOf = (dir, prefix = '') =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? treeOf(join(dir, entry.name), prefix + entry.name + '/') : [prefix + entry.name]
  );

const exported = (t, options) => {
  const { root, files } = repository(t, options);
  const target = join(scratch(t), 'copy');
  return { root, files, target, result: exportEngine({ root, target, files }) };
};

test('the export writes every engine file at its own path and leaves the site and evidence files behind', (t) => {
  const { target, result } = exported(t);
  assert.deepEqual(result.refusals, []);
  for (const file of ['site/scripts/measure-sentence-band.mjs', 'docs/CONTENT-GATE.md', 'site/.nvmrc', 'AGENTS.md']) {
    assert.ok(existsSync(join(target, file)), file);
  }
  for (const file of ['docs/PRD.md', 'site/public/logo.svg', 'site/src/assets/images/og-default.png']) {
    assert.equal(existsSync(join(target, file)), false, file);
  }
});

test('a seed is written at its target path with its own text, and no file of the seed root travels', (t) => {
  const { target } = exported(t, {
    extra: {
      'seed/site/src/data/tags.mjs.seed': 'export const TAGS = [];\n',
      'site/src/data/tags.mjs': "export const TAGS = ['original'];\n",
    },
  });
  assert.equal(readFileSync(join(target, 'site/src/data/tags.mjs'), 'utf8'), 'export const TAGS = [];\n');
  const tree = treeOf(target);
  assert.deepEqual(
    tree.filter((file) => file.startsWith('seed/') || file.endsWith('.seed')),
    []
  );
});

test('the manifest holds the three counts, the seeds and the carried files that still name the source site', (t) => {
  const named = 'site/scripts/pr-github.mjs';
  const { files, target, result } = exported(t, { extra: { [named]: "const origin = 'https://example.test';\n" } });
  const { manifest } = result;
  assert.equal(manifest.counts.engine + manifest.counts.site + manifest.counts.evidence, files.length);
  assert.deepEqual(manifest.siteBound, [named]);
  assert.ok(manifest.seeds.includes('AGENTS.md'));
  assert.ok(manifest.seeds.every((file) => !file.startsWith('seed/')));
  assert.deepEqual(JSON.parse(readFileSync(join(target, 'engine-export.json'), 'utf8')), manifest);
  assert.ok(existsSync(join(target, named)));
});

test('a file that joins the repository later is exported with no change to the exporter', (t) => {
  const { target } = exported(t, { extra: { 'site/scripts/a-gate-written-next-year.mjs': 'export {};\n' } });
  assert.ok(existsSync(join(target, 'site/scripts/a-gate-written-next-year.mjs')));
});

test('binary bytes and the executable bit arrive as they left', (t) => {
  const { root, files } = repository(t, { extra: { [HOOK]: '#!/bin/sh\n' } });
  chmodSync(join(root, HOOK), 0o755);
  const target = join(scratch(t), 'copy');
  assert.deepEqual(exportEngine({ root, target, files }).refusals, []);
  assert.ok(readFileSync(join(target, FONT)).equals(FONT_BYTES));
  assert.notEqual(statSync(join(target, HOOK)).mode & 0o111, 0);
});

test('a target with anything in it is refused and left exactly as it was', (t) => {
  const { root, files } = repository(t);
  const target = scratch(t);
  writeFileSync(join(target, 'keep.txt'), 'mine');
  const { refusals, written } = exportEngine({ root, target, files });
  assert.match(refusals.join('\n'), /is not empty/);
  assert.deepEqual(written, []);
  assert.deepEqual(treeOf(target), ['keep.txt']);
  assert.equal(readFileSync(join(target, 'keep.txt'), 'utf8'), 'mine');
});

test('a target that is a file is refused', (t) => {
  const { root, files } = repository(t);
  const target = join(scratch(t), 'a-file');
  writeFileSync(target, 'x');
  assert.match(exportEngine({ root, target, files }).refusals.join('\n'), /not a directory/);
  assert.equal(readFileSync(target, 'utf8'), 'x');
});

test('an empty directory is accepted, and a missing one is made', (t) => {
  const { root, files } = repository(t);
  const empty = scratch(t);
  assert.deepEqual(exportEngine({ root, target: empty, files }).refusals, []);
  assert.ok(existsSync(join(empty, 'AGENTS.md')));
  const missing = join(scratch(t), 'deep', 'copy');
  assert.deepEqual(exportEngine({ root, target: missing, files }).refusals, []);
  assert.ok(existsSync(join(missing, 'AGENTS.md')));
});

test('a file that fits no class refuses the export before anything is written, the directory included', (t) => {
  const { root, files } = repository(t, { extra: { 'mystery.bin': 'x' } });
  const target = join(scratch(t), 'copy');
  const { refusals, written } = exportEngine({ root, target, files });
  assert.match(refusals.join('\n'), /unclassified mystery\.bin/);
  assert.deepEqual(written, []);
  assert.equal(existsSync(target), false);
});

test('an anchor that nothing serves refuses the export and names the anchor', (t) => {
  const { root, files } = repository(t, { without: ['seed/docs/SEMANTIC-CORE.md.seed'] });
  const target = join(scratch(t), 'copy');
  const { refusals } = exportEngine({ root, target, files });
  assert.match(refusals.join('\n'), /anchor-unserved docs\/SEMANTIC-CORE\.md/);
  assert.equal(existsSync(target), false);
});

test('a repository the partition cannot read is refused with the reason, not a stack trace', (t) => {
  const { root, files } = repository(t, { without: ['site/engine.config.json'] });
  const target = join(scratch(t), 'copy');
  const { refusals } = exportEngine({ root, target, files });
  assert.match(refusals.join('\n'), /engine\.config\.json cannot be read/);
  assert.equal(existsSync(target), false);
});

const gitRepository = (t) => {
  const { root } = repository(t);
  gitAt(root, 'init', '--quiet', '--initial-branch=main');
  gitAt(root, 'add', '-A');
  return root;
};

const capture = () => {
  const lines = { out: [], err: [] };
  return { lines, io: { out: (line) => lines.out.push(line), err: (line) => lines.err.push(line) } };
};

test('the command exports the files git tracks in the root it is given and says what it wrote', (t) => {
  const root = gitRepository(t);
  const target = join(scratch(t), 'copy');
  const { lines, io } = capture();
  assert.equal(main(['--root', root, target], io), 0);
  assert.ok(existsSync(join(target, 'engine-export.json')));
  assert.match(lines.out.join('\n'), /engine files written to .*copy/);
  assert.deepEqual(lines.err, []);
});

test('the command exits 1 and writes nothing when the target is not empty', (t) => {
  const root = gitRepository(t);
  const target = scratch(t);
  writeFileSync(join(target, 'keep.txt'), 'mine');
  const { lines, io } = capture();
  assert.equal(main(['--root', root, target], io), 1);
  assert.match(lines.err.join('\n'), /export: refused: .* is not empty/);
  assert.deepEqual(treeOf(target), ['keep.txt']);
});

test('the command exits 2 and prints the usage when it is not given exactly one directory', () => {
  for (const argv of [[], ['one', 'two']]) {
    const { lines, io } = capture();
    assert.equal(main(argv, io), 2);
    assert.match(lines.err.join('\n'), /usage: node scripts\/export-engine\.mjs/);
  }
});

test('the command exits 1 and names git init when the source is not a git repository', (t) => {
  const root = scratch(t);
  writeFileSync(join(root, 'a.txt'), 'a\n');
  const target = join(scratch(t), 'copy');
  const { lines, io } = capture();
  assert.equal(main(['--root', root, target], io), 1);
  assert.match(lines.err.join('\n'), /export: refused: not-a-repository .*git init && git add -A/);
  assert.equal(existsSync(target), false);
});

test('the exported workflow holds the schedule its exported config generates, whatever schedule the source workflow held', (t) => {
  const { target, result } = exported(t, {
    extra: { [WRITE_DAILY_PATH]: SOURCE_WORKFLOW },
  });
  assert.deepEqual(result.refusals, []);
  const { writeTimesUtc, catchUpAfterMinutes, cronLeadMinutes } = readEngineConfig(
    join(target, 'site/engine.config.json')
  ).loop;
  const workflow = readFileSync(join(target, WRITE_DAILY_PATH), 'utf8');
  assert.deepEqual(scheduleFindings(workflow, writeTimesUtc, catchUpAfterMinutes, cronLeadMinutes), []);
});

test('a config the schedule cannot be read from refuses the export before anything is written', (t) => {
  const { root, files } = repository(t, { extra: { 'site/engine.config.json': JSON.stringify({ diff, content }) } });
  const target = join(scratch(t), 'copy');
  const { refusals } = exportEngine({ root, target, files });
  assert.match(refusals.join('\n'), /^config-invalid site\/engine\.config\.json/);
  assert.equal(existsSync(target), false);
});
