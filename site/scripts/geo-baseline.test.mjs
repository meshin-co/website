import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parsePrompts, scorePrompt, renderBaseline } from './geo-baseline.mjs';

const doc = `### The 30 buyer prompts (PRD §17.3)

#### Entity and offer prompts

**1. who is a fractional chief AI officer**
Must win: \`/\` (support: \`/services/x\`).
Passage: "I am the officer your org chart can point at." (\`/\`)
Why: the primary entity query

**2. cost of a fractional officer**
Must win: \`/pricing\`.
Passage: "Cost follows scope." (\`/pricing\`)
Why: the objection

### GAP register`;

test('prompts are read from the core with their must-win route and passage', () => {
  const prompts = parsePrompts(doc);
  assert.equal(prompts.length, 2);
  assert.deepEqual(prompts[0], {
    number: 1,
    prompt: 'who is a fractional chief AI officer',
    mustWin: '/',
    support: ['/services/x'],
    passage: 'I am the officer your org chart can point at.',
  });
});

test('a prompt whose must-win route ships its passage and a citable answer scores ready', () => {
  const score = scorePrompt(
    { number: 1, prompt: 'p', mustWin: '/', support: [], passage: 'I am the officer your org chart can point at.' },
    {
      '/': {
        text: 'I am the officer your org chart can point at. More prose.',
        hasShortAnswer: true,
        hasJsonLd: true,
        inLlms: true,
      },
    }
  );
  assert.equal(score.state, 'ready');
  assert.deepEqual(score.missing, []);
});

test('a missing passage, answer block, json-ld or llms line is named, not averaged away', () => {
  const score = scorePrompt(
    { number: 2, prompt: 'p', mustWin: '/pricing', support: [], passage: 'Cost follows scope.' },
    { '/pricing': { text: 'Something else entirely.', hasShortAnswer: false, hasJsonLd: true, inLlms: false } }
  );
  assert.equal(score.state, 'gap');
  assert.deepEqual(score.missing.sort(), ['llms.txt line', 'marked citable unit', 'passage']);
});

test('a must-win route that does not exist is a gap naming the route', () => {
  const score = scorePrompt({ number: 3, prompt: 'p', mustWin: '/ghost', support: [], passage: 'x' }, {});
  assert.equal(score.state, 'gap');
  assert.match(score.missing[0], /\/ghost/);
});

test('the report counts ready prompts and lists every gap', () => {
  const md = renderBaseline([
    { number: 1, prompt: 'a', mustWin: '/', state: 'ready', missing: [] },
    { number: 2, prompt: 'b', mustWin: '/pricing', state: 'gap', missing: ['passage'] },
  ]);
  assert.match(md, /1 of 2/);
  assert.match(md, /passage/);
});

test('two prompts sharing one body block are both parsed, because the core groups them deliberately', () => {
  const prompts = parsePrompts(`### The 30 buyer prompts

**16. fractional AI officer Israel**
**17. fractional AI leader Europe remote**
Must win: \`/about\` (intended), support \`/\`.
Passage: "I'm Dmitri Meshin, a platform engineer by trade." (\`/about\`)
Why: local queries need local evidence

### GAP register`);
  assert.deepEqual(
    prompts.map((entry) => entry.number),
    [16, 17]
  );
  assert.equal(prompts[0].mustWin, '/about');
  assert.equal(prompts[1].mustWin, '/about');
  assert.equal(prompts[0].passage, "I'm Dmitri Meshin, a platform engineer by trade.");
});

test('the report names itself structural readiness, never a citation rate, because no engine was queried', () => {
  const md = renderBaseline([{ number: 1, prompt: 'p', mustWin: '/', missing: [] }]);
  assert.match(md, /structural readiness/i);
  assert.match(md, /no AI engine was queried/i);
  assert.doesNotMatch(md, /citation rate|cited by/i);
});
