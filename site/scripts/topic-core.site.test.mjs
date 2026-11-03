import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { readPromptSources } from './topic-core.mjs';

const CORE = readFileSync(new URL('../../docs/SEMANTIC-CORE.md', import.meta.url), 'utf8');

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
