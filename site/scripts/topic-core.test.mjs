import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { parsePrompts } from './geo-baseline.mjs';
import { readPromptSources } from './topic-core.mjs';

const read = (lines) => readPromptSources(lines.join('\n'));

test('a prompt reads every route its block names, in order and without duplicates', () => {
  const sources = read([
    '### The 30 buyer prompts',
    '',
    '**1. who is the officer**',
    'Must win: `/`, support `/services/retainer/` and `/pricing`.',
    'Passage: "An answer." (`/services/retainer`)',
    '',
  ]);
  assert.deepEqual(sources.get(1), { routes: ['/', '/services/retainer', '/pricing'], retired: false });
});

test('consecutive prompt headings share the one block that follows them', () => {
  const sources = read([
    '**16. first**',
    '**17. second**',
    'Must win: nothing. Retired 2026-10-02 by L57.',
    '',
    '**18. third**',
    'Must win: `/services/sprint`.',
  ]);
  assert.deepEqual(sources.get(16), { routes: [], retired: true });
  assert.deepEqual(sources.get(17), { routes: [], retired: true });
  assert.deepEqual(sources.get(18), { routes: ['/services/sprint'], retired: false });
});

test('a CLOSED line contributes the routes it names', () => {
  const sources = read([
    '**21. adoption telemetry**',
    '**CLOSED 2026-10-02:** `/blog/adoption-telemetry` and',
    '`/resources/adoption-template`.',
  ]);
  assert.deepEqual(sources.get(21), {
    routes: ['/blog/adoption-telemetry', '/resources/adoption-template'],
    retired: false,
  });
});

test('a block ends at the next heading of another kind', () => {
  const sources = read([
    '**5. before the heading**',
    'Must win: `/pricing`.',
    '#### Locale prompts',
    'Mentions `/not-part-of-prompt-5` here.',
    '**6. after the heading**',
    'Must win: `/approach`.',
  ]);
  assert.deepEqual(sources.get(5)?.routes, ['/pricing']);
  assert.deepEqual(sources.get(6)?.routes, ['/approach']);
});

test('a prompt with no routes and no retirement reads as empty and live', () => {
  const sources = read(['**9. bare**', 'Why: nothing is named here.', '', '**10. next**', 'Must win: `/pricing`.']);
  assert.deepEqual(sources.get(9), { routes: [], retired: false });
});

test('only slash-led lowercase back-ticked tokens count as routes', () => {
  const sources = read(['**3. mixed**', 'Uses `absenceFindings`, `/Bad_Route`, `/a b`, `/ok-1/x2` and `pricing`.']);
  assert.deepEqual(sources.get(3)?.routes, ['/ok-1/x2']);
});

test('the word Retired is matched case-sensitively and as a whole word', () => {
  const sources = read(['**1. a**', 'This was retired once.', '**2. b**', 'Unretired later.', '**3. c**', 'Retired.']);
  assert.equal(sources.get(1)?.retired, false);
  assert.equal(sources.get(2)?.retired, false);
  assert.equal(sources.get(3)?.retired, true);
});

test('text that is not a core yields no prompts', () => {
  assert.equal(readPromptSources('').size, 0);
});

const CORE = readFileSync(new URL('../../docs/SEMANTIC-CORE.md', import.meta.url), 'utf8');

test('the committed core is read for exactly the prompts parsePrompts finds', () => {
  const expected = parsePrompts(CORE).map((prompt) => prompt.number);
  assert.equal(expected.length, 30);
  assert.deepEqual([...readPromptSources(CORE).keys()], expected);
});

test('only prompts 16 and 17 of the committed core are retired', () => {
  const retired = [...readPromptSources(CORE)].filter(([, source]) => source.retired).map(([number]) => number);
  assert.deepEqual(retired, [16, 17]);
});

test('the committed core names the routes that close or support its prompts', () => {
  const sources = readPromptSources(CORE);
  assert.ok(sources.get(21)?.routes.includes('/blog/adoption-telemetry-measuring-if-ai-is-actually-used'));
  assert.ok(sources.get(19)?.routes.includes('/glossary/mcp'));
  assert.ok(sources.get(6)?.routes.includes('/blog/how-to-build-an-ai-system-register-in-a-week'));
  assert.ok(sources.get(6)?.routes.includes('/glossary/ai-register'));
  assert.deepEqual(sources.get(1)?.routes.slice(0, 1), ['/']);
});
