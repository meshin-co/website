import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { TITLE_ROOM_CHARS } from '../src/utils/faq-meta.mjs';
import { readDemandReport } from './demand-report.mjs';
import { assertTopicInvariants } from './fixtures/topic-invariants.mjs';
import { cueOf, topicFrom } from './topic-format.mjs';

const PROMPTS = [
  [1, 'who is a fractional chief AI officer for a 100-person SaaS company', null, null],
  [
    2,
    'fractional CAIO vs full-time CAIO cost',
    'Fractional CAIO vs full-time CAIO cost',
    'fractional-caio-vs-full-time-caio-cost',
  ],
  [
    3,
    'AI readiness assessment template for SMB',
    'AI readiness assessment template for SMB',
    'ai-readiness-assessment-template-for-smb',
  ],
  [
    4,
    'AI governance consultant ISO 42001 small company',
    'AI governance consultant ISO 42001 small company',
    'ai-governance-consultant-iso-42001-small-company',
  ],
  [
    5,
    'named person responsible for AI risk in vendor procurement',
    'Named person responsible for AI risk in vendor procurement',
    'named-person-responsible-for-ai-risk-in-vendor-procurement',
  ],
  [6, 'how to build an AI system register', 'How to build an AI system register', 'how-to-build-an-ai-system-register'],
  [7, 'AI acceptable use policy template', 'AI acceptable use policy template', 'ai-acceptable-use-policy-template'],
  [
    8,
    'EU AI Act obligations for deployers small business',
    'EU AI Act obligations for deployers small business',
    'eu-ai-act-obligations-for-deployers-small-business',
  ],
  [
    9,
    'why do AI pilots fail to reach production',
    'Why do AI pilots fail to reach production?',
    'why-do-ai-pilots-fail-to-reach-production',
  ],
  [
    10,
    'LLM gateway for governance and audit',
    'LLM gateway for governance and audit',
    'llm-gateway-for-governance-and-audit',
  ],
  [
    11,
    'how to put evals for AI agents into CI',
    'How to put evals for AI agents into CI',
    'how-to-put-evals-for-ai-agents-into-ci',
  ],
  [
    12,
    'AI vendor assessment questionnaire template',
    'AI vendor assessment questionnaire template',
    'ai-vendor-assessment-questionnaire-template',
  ],
  [13, 'build vs buy AI 3-year TCO', 'Build vs buy AI 3-year TCO', 'build-vs-buy-ai-3-year-tco'],
  [
    14,
    'AI operating model for mid-size company',
    'AI operating model for mid-size company',
    'ai-operating-model-for-mid-size-company',
  ],
  [
    15,
    'how to hand over AI leadership to internal team',
    'How to hand over AI leadership to internal team',
    'how-to-hand-over-ai-leadership-to-internal-team',
  ],
  [16, 'fractional AI officer Israel', 'Fractional AI officer Israel', 'fractional-ai-officer-israel'],
  [
    17,
    'fractional AI leader Europe remote',
    'Fractional AI leader Europe remote',
    'fractional-ai-leader-europe-remote',
  ],
  [
    18,
    'agentic automation consultant for B2B',
    'Agentic automation consultant for B2B',
    'agentic-automation-consultant-for-b2b',
  ],
  [19, 'MCP security best practices', 'MCP security best practices', 'mcp-security-best-practices'],
  [
    20,
    'multi-agent reference architecture production',
    'Multi-agent reference architecture production',
    'multi-agent-reference-architecture-production',
  ],
  [21, 'adoption telemetry for AI tools', 'Adoption telemetry for AI tools', 'adoption-telemetry-for-ai-tools'],
  [
    22,
    'AI incident response plan template',
    'AI incident response plan template',
    'ai-incident-response-plan-template',
  ],
  [23, 'data classification for LLM usage', 'Data classification for LLM usage', 'data-classification-for-llm-usage'],
  [24, 'ISO 42001 gap assessment', 'ISO 42001 gap assessment', 'iso-42001-gap-assessment'],
  [25, 'NIST AI RMF for small companies', 'NIST AI RMF for small companies', 'nist-ai-rmf-for-small-companies'],
  [26, 'fractional CAIO pricing', 'Fractional CAIO pricing', 'fractional-caio-pricing'],
  [
    27,
    'what does a chief AI officer do in a 50 person company',
    'What does a chief AI officer do in a 50 person company?',
    'what-does-a-chief-ai-officer-do-in-a-50-person-company',
  ],
  [
    28,
    'AI governance starter kit open source',
    'AI governance starter kit open source',
    'ai-governance-starter-kit-open-source',
  ],
  [
    29,
    'AI readiness scorecard five drivers',
    'AI readiness scorecard five drivers',
    'ai-readiness-scorecard-five-drivers',
  ],
  [30, 'board memo AI strategy one page', 'Board memo AI strategy one page', 'board-memo-ai-strategy-one-page'],
];

const frozen = readDemandReport(
  readFileSync(new URL('./fixtures/search-demand-2026-11-01.md', import.meta.url), 'utf8')
);

test('the table holds the 30 buyer prompts of the frozen report, in their order and in their words', () => {
  assert.deepEqual(
    PROMPTS.map(([number, text]) => [number, text]),
    frozen.prompts.map(({ number, prompt }) => [number, prompt])
  );
});

for (const [number, text, title, slug] of PROMPTS) {
  test('buyer prompt ' + number + ': ' + text, () => {
    const topic = topicFrom(text);
    if (title === null || title.length > TITLE_ROOM_CHARS) {
      assert.deepEqual(topic, { format: null, reason: 'title-too-long' });
      return;
    }
    assert.deepEqual(topic, { format: 'article', subject: null, title, slug, query: text.toLowerCase() });
    assertTopicInvariants(topic);
  });
}

test('only prompts 6, 11 and 15 are procedures, 9 and 27 are questions, and no prompt is a definition', () => {
  const cues = PROMPTS.map(([number, text]) => [number, cueOf(text)]);
  assert.deepEqual(
    cues.filter(([, cue]) => cue === 'procedure').map(([number]) => number),
    [6, 11, 15]
  );
  assert.deepEqual(
    cues.filter(([, cue]) => cue === 'question').map(([number]) => number),
    [1, 9, 27]
  );
  assert.equal(cues.filter(([, cue]) => cue === 'definition').length, 0);
});
