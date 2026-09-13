import { z } from 'astro/zod';

export const TAGS = [
  { slug: 'acceptable-use-policy', name: 'Acceptable use policy' },
  { slug: 'agentic-architecture', name: 'Agentic architecture' },
  { slug: 'ai-governance', name: 'AI governance' },
  { slug: 'ai-pilots', name: 'AI pilots' },
  { slug: 'ai-register', name: 'AI register' },
  { slug: 'evals-in-ci', name: 'Evals in CI' },
  { slug: 'eu-ai-act', name: 'EU AI Act' },
  { slug: 'llm-as-judge', name: 'LLM as judge' },
  { slug: 'policy-enforcement', name: 'Policy enforcement' },
  { slug: 'production-readiness', name: 'Production readiness' },
  { slug: 'security-review', name: 'Security review' },
  { slug: 'shadow-ai', name: 'Shadow AI' },
];

export const TAG_SLUGS = TAGS.map((tag) => tag.slug);

export const tagBySlug = Object.fromEntries(TAGS.map((tag) => [tag.slug, tag]));

export const postTagSchema = z.array(z.enum(TAG_SLUGS));
