import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const folder = new URL('./spec/evals-baseline-1.0/', import.meta.url);
const suite = JSON.parse(readFileSync(new URL('vectors.json', folder), 'utf8'));
const page = readFileSync(new URL('./spec/evals-baseline-1.0.md', import.meta.url), 'utf8');
const between = (from, to) => page.slice(page.indexOf(from), page.indexOf(to));
const commandLine = between('## The command line', '### Usage errors');
const recording = between('### Recording a baseline', '## Values, sample counts and metric keys');

const rowOf = (verb) => new RegExp(`^\\| \`${verb}\` .*$`, 'm').exec(commandLine)?.[0] ?? '';
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const recordings = suite.vectors.filter((entry) => entry.argv[0] === 'record');
const refusals = recordings.filter((entry) => entry.stdout.some((line) => line.includes('already holds a baseline')));
const replacing = recordings.filter((entry) => entry.argv.includes('--replace'));

test('--replace is a flag of record and of no other verb, and every usage line shows it', () => {
  assert.match(rowOf('record'), /`--baseline <path>`, `--tolerance <n>`, `--replace`/);
  assert.doesNotMatch(rowOf('check'), /--replace/);
  assert.doesNotMatch(rowOf('show'), /--replace/);
  assert.match(
    commandLine,
    /- `--replace` lets `record` write over a baseline that exists and that the run would change\. It takes no value\./
  );
  const usageLines = suite.vectors.filter((entry) => entry.code === 2).map((entry) => entry.stderr.at(-1));
  assert.ok(usageLines.length > 0);
  for (const line of usageLines) {
    assert.equal(
      line,
      'usage: evals-baseline <check|record|show> <run-file> [--baseline <path>] [--strict] [--tolerance <n>] [--replace]'
    );
  }
});

test('record refuses over a baseline that it would change, writes with --replace, and says nothing is wrong when nothing changes', () => {
  assert.match(
    recording,
    /refuse and write nothing to record over a baseline that exists and that the run would change, unless `--replace` is given\./
  );
  assert.match(recording, /This is not a refusal, and it needs no `--replace`/);
  assert.ok(refusals.length > 0, 'no vector refuses to record over a baseline');
  for (const entry of refusals) {
    assert.equal(entry.code, 3, entry.id);
    assert.ok(!entry.argv.includes('--replace'), entry.id);
    assert.deepEqual(entry.writes, [], entry.id);
    assert.ok(entry.stdout[0].endsWith('pass --replace to replace it; nothing written'), entry.id);
  }
  assert.ok(replacing.length > 0, 'no vector records with --replace');
  for (const entry of replacing) {
    assert.equal(entry.code, 0, entry.id);
    assert.notDeepEqual(entry.writes, [], entry.id);
  }
  assert.ok(replacing.some((entry) => entry.stdout.some((line) => line.startsWith('replaced:'))));
  const unchanged = recordings.filter((entry) => entry.stdout[0]?.includes(' record: unchanged'));
  assert.ok(unchanged.some((entry) => !entry.argv.includes('--replace')));
  for (const entry of unchanged) {
    assert.equal(entry.code, 0, entry.id);
    assert.deepEqual(entry.writes, [], entry.id);
  }
});

test('the two lines that the page prints for a refusal are lines that a vector prints', () => {
  const example = recording
    .split('\n')
    .filter((line) => line.startsWith('    '))
    .map((line) => line.slice(4));
  assert.equal(example.length, 2);
  for (const line of example) {
    assert.ok(
      suite.vectors.some((entry) => entry.stdout.includes(line)),
      line
    );
  }
});

test('every note that a refusal prints is one of the forms in the table, and the form for a fall is printed', () => {
  const templates = [...recording.matchAll(/^\|[^|]*\| `([^`]+)`\s*\|$/gm)].map(
    ([, template]) => new RegExp(`^${escapeRegExp(template).replace(/<[^>]+>/g, '.+')}$`)
  );
  assert.equal(templates.length, 6);
  const used = new Set();
  for (const entry of refusals) {
    const notes = entry.stdout.slice(1);
    assert.ok(notes.length > 0, entry.id);
    for (const line of notes) {
      assert.ok(line.startsWith('note: '), line);
      const form = line.slice('note: '.length).replace('would rise by', 'would fall by');
      const matching = templates
        .map((template, index) => (template.test(form) ? index : -1))
        .filter((index) => index >= 0);
      assert.equal(matching.length, 1, line);
      used.add(matching[0]);
    }
  }
  assert.ok(used.size >= 1);
});
