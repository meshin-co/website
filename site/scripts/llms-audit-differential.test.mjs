import assert from 'node:assert/strict';
import { test } from 'node:test';

import LlmsTxt from 'lighthouse/core/audits/agentic/llms-txt.js';

import { llmsSummaryGaps } from './agent-interfaces-gate.mjs';

const GOOD = '# Example\n\n- [Home](https://example.com/): the home page and its content\n';

const asFetched = [(text) => text, (text) => new TextDecoder().decode(Buffer.from(text, 'utf8'))];

const scoreOf = (content) => LlmsTxt.audit({ LlmsTxt: { status: 200, content } }).score;
const passesTheAudit = (text) => asFetched.every((decode) => scoreOf(decode(text)) === 1);
const passesTheGate = (text) => llmsSummaryGaps('llms.txt', text).length === 0;
const shown = (text) =>
  JSON.stringify(text).replace(/[^\u0020-\u007e]/g, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`);

test('the installed audit and the gate both pass a good file, so neither control refuses everything', () => {
  assert.equal(passesTheAudit(GOOD), true);
  assert.equal(passesTheGate(GOOD), true);
});

const AUDIT_REFUSES = {
  'multi-byte letters that pass 50 bytes but not 50 characters': `# Ы\n[${'ы'.repeat(15)}](https://e.co/)`,
  'inline code between a closing bracket and an opening parenthesis':
    '# Example\n\nA site about agents: [a]`x`(b) and nothing more to read.\n',
  'a carriage return inside link text': '# Example\n\nRead [the\rabout page](/about) for more detail.\n',
  'a carriage return inside a link target': '# Example\n\nRead [the about page](/ab\rout) for more detail.\n',
  'a line separator inside link text': '# Example\n\nRead [the\u2028about page](/about) for more detail.\n',
  'a paragraph separator inside a link target': '# Example\n\nRead [the about page](/ab\u2029out) for more detail.\n',
  'a code span holding a line separator inside link text':
    '# Example\n\nRead [the `a\u2028b` page](/about) for more detail.\n',
  'a byte order mark that one of the two ways Lighthouse reads the file drops, leaving 49 characters':
    '\uFEFF\n# T\n[a](https://e.co/x)'.padEnd(50, '.'),
};

for (const [name, text] of Object.entries(AUDIT_REFUSES)) {
  test(`the installed audit refuses ${name}, so the gate must too`, () => {
    assert.equal(passesTheAudit(text), false, 'the installed audit no longer refuses this file, so the case is stale');
    assert.equal(passesTheGate(text), false, 'the gate passes a file the installed audit refuses');
  });
}

function seeded(seed) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

const random = seeded(20261112);
const upTo = (most) => Math.floor(random() * (most + 1));
const pick = (list) => list[upTo(list.length - 1)];

const BASES = [
  GOOD,
  `# T\n[a](https://e.co/x)${'.'.repeat(27)}`,
  '# Example\n\nRead [the about page](/about) for more detail.\n',
  `# Ы\n[${'ы'.repeat(15)}](https://e.co/)ы`,
  '\n\n# T\n\n- [`code`](/x) text and more text to pass the floor\n',
  '# T\n```\n[a](b)\n```\n[c](d) and padding padding padding padding\n',
  '#\tT\r\n\r\n[a](/b) and padding padding padding padding padding\r\n',
  '\uFEFF\n# T\n[a](https://e.co/x)'.padEnd(50, '.'),
];

const FRAGMENTS = [
  '\n',
  '\r',
  '\r\n',
  '\u2028',
  '\u2029',
  '`',
  '``',
  '~~~',
  '```',
  '[',
  ']',
  '(',
  ')',
  '![',
  '# ',
  '#',
  ' ',
  '\t',
  '\uFEFF',
  'ы',
  '😀',
  '`x`',
  '[a](b)',
  '`[a](b)`',
  '[a]`x`(b)',
  '\n```\n',
  '\n~~~\n',
  'x',
];

function mutated(text) {
  let current = text;
  for (let steps = 1 + upTo(4); steps > 0; steps -= 1) {
    const at = upTo(current.length);
    const edit = upTo(2);
    if (edit === 0) current = current.slice(0, at) + pick(FRAGMENTS) + current.slice(at);
    else if (edit === 1) current = current.slice(0, at) + current.slice(at + 1 + upTo(2));
    else current = current.slice(0, at) + pick(FRAGMENTS) + current.slice(at + 1);
  }
  return current;
}

const CORPUS = Array.from({ length: 60000 }, () => mutated(pick(BASES)));

test('a file the gate passes scores 1 under the installed audit, over a seeded corpus of mutated files', () => {
  const passed = CORPUS.filter(passesTheGate);
  const refused = CORPUS.filter((text) => !passesTheAudit(text));
  const counterexamples = passed.filter((text) => !passesTheAudit(text));

  assert.ok(passed.length >= 5000, `only ${passed.length} of ${CORPUS.length} files passed the gate`);
  assert.ok(refused.length >= 5000, `the audit refused only ${refused.length} of ${CORPUS.length} files`);
  assert.deepEqual(counterexamples.slice(0, 3).map(shown), []);
});
