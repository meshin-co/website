import assert from 'node:assert/strict';
import { test } from 'node:test';

import { resourceCardProps } from './resource-card.mjs';

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
