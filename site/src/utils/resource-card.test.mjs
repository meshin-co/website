import assert from 'node:assert/strict';
import { test } from 'node:test';

import { resourceCardProps, resourceFormat } from './resource-card.mjs';

test('a resource entry maps to the card fields the template renders', () => {
  const entry = {
    id: 'ai-governance-starter-kit',
    data: {
      name: 'AI Governance Starter Kit',
      description: 'Templates for AI register, AUP, and vendor questionnaire.',
      type: 'kit',
      status: 'Written out in full on its own page',
    },
  };

  assert.deepEqual(resourceCardProps(entry), {
    name: 'AI Governance Starter Kit',
    summary: 'Templates for AI register, AUP, and vendor questionnaire.',
    format: 'kit',
    status: 'Written out in full on its own page',
    href: '/resources/ai-governance-starter-kit',
  });
});

test('the href always points at the resource route, built only from the id', () => {
  const entry = {
    id: 'agent-evals-ci-starter',
    data: { name: 'x', description: 'y', type: 'repo', status: 'z' },
  };

  assert.equal(resourceCardProps(entry).href, '/resources/agent-evals-ci-starter');
});

test('the format label joins type and version, and adds the license only when the entry declares one', () => {
  assert.equal(resourceFormat({ type: 'kit', version: '0.1' }), 'kit · v0.1');
  assert.equal(resourceFormat({ type: 'template', version: '0.1', license: 'MIT' }), 'template · v0.1 · MIT');
});
