import { defineCollection, reference } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

import { postTagSchema } from '~/data/tags.mjs';
import { countWords, isNotBeforePublish, isWithinWordRange, ogTitleSchema } from '~/utils/content-rules.mjs';
import {
  DESCRIPTION_MAX_CHARS,
  DESCRIPTION_MIN_CHARS,
  TITLE_ROOM_CHARS,
  faqDescription,
  isDescriptionInRange,
} from '~/utils/faq-meta.mjs';
import { LICENSE_ID, licenseHasText } from '~/utils/resource-license.mjs';

const CATEGORIES = ['governance', 'agentic-architecture', 'operating-model', 'executive'] as const;

const source = z.object({
  title: z.string(),
  url: z.url(),
  publisher: z.string().optional(),
  retrieved: z.string().optional(),
});

const wordRange = (min: number, max: number) => ({
  message: `must be ${min}–${max} words`,
  check: (value: string) => isWithinWordRange(value, min, max),
});

const shortAnswer = () => {
  const rule = wordRange(40, 60);
  return z.string().refine(rule.check, { message: rule.message });
};

const fullAnswer = () => {
  const rule = wordRange(130, 170);
  return z.string().refine(rule.check, { message: rule.message });
};

const publishable = {
  title: ogTitleSchema,
  description: z.string().max(155),
  publishDate: z.date(),
  updatedDate: z.date(),
  draft: z.boolean().default(false),
  noindex: z.boolean().default(false),
  canonical: z.url().optional(),
  ogImage: z.string().optional(),
};

const datesInOrder = <T extends { publishDate: Date; updatedDate: Date }>(entry: T) =>
  isNotBeforePublish(entry.publishDate, entry.updatedDate);

const datesInOrderMessage = { message: 'updatedDate must not be before publishDate', path: ['updatedDate'] };

const licenseTextMessage = {
  message: 'needs its text. Add public/licenses/<license>.txt, or remove the field',
  path: ['license'],
};

const licenseIdMessage = 'must be a licence id such as MIT or CC-BY-4.0';

const postCollection = defineCollection({
  loader: glob({ pattern: ['*.md', '*.mdx'], base: 'src/data/post' }),
  schema: z
    .object({
      ...publishable,
      shortAnswer: shortAnswer(),
      fullAnswer: fullAnswer(),
      keyTakeaways: z.array(z.string()).min(3).max(5),
      faq: z
        .array(z.object({ q: z.string(), a: z.string() }))
        .max(5)
        .default([]),
      category: z.enum(CATEGORIES),
      tags: postTagSchema.default([]),
      sources: z.array(source).min(1),
      author: reference('author'),
      relatedResources: z.array(reference('resource')).default([]),
    })
    .refine(datesInOrder, datesInOrderMessage),
});

const serviceCollection = defineCollection({
  loader: glob({ pattern: ['*.md', '*.mdx'], base: 'src/data/service' }),
  schema: z
    .object({
      ...publishable,
      name: z.string(),
      tagline: z.string(),
      shortAnswer: shortAnswer(),
      feeShape: z.string(),
      duration: z.string(),
      forWhom: z.array(z.string()).min(1),
      notForWhom: z.array(z.string()).min(1),
      deliverables: z.array(z.string()).min(1),
      process: z.array(z.object({ step: z.number().int().positive(), title: z.string(), detail: z.string() })).min(1),
      schedule: z
        .array(z.object({ stage: z.string(), work: z.string(), output: z.string() }))
        .min(3)
        .max(5),
      faq: z
        .array(z.object({ q: z.string(), a: z.string() }))
        .min(3)
        .max(8),
      sources: z.array(source).min(1),
      order: z.number().int().positive(),
    })
    .refine(datesInOrder, datesInOrderMessage),
});

const resourceCollection = defineCollection({
  loader: glob({ pattern: ['*.md', '*.mdx'], base: 'src/data/resource' }),
  schema: z
    .object({
      ...publishable,
      name: z.string(),
      type: z.enum(['template', 'kit', 'scorecard', 'repo', 'checklist']),
      version: z.string(),
      license: z.string().regex(LICENSE_ID, licenseIdMessage).optional(),
      status: z.string(),
      repoUrl: z.url().optional(),
      whatInside: z.array(z.string()).min(1),
      howToUse: z.string(),
      sources: z.array(source).min(1),
      relatedPosts: z.array(reference('post')).default([]),
    })
    .refine(datesInOrder, datesInOrderMessage)
    .refine((entry) => licenseHasText(entry), licenseTextMessage),
});

const caseCollection = defineCollection({
  loader: glob({ pattern: ['*.md', '*.mdx'], base: 'src/data/case' }),
  schema: z
    .object({
      ...publishable,
      client: z.object({ name: z.string().optional(), industry: z.string(), size: z.string() }),
      problem: z.string(),
      approach: z.string(),
      outcome: z.object({
        metrics: z
          .array(z.object({ label: z.string(), before: z.string(), after: z.string() }))
          .max(3)
          .default([]),
      }),
      stack: z.array(z.string()).min(1),
      duration: z.string().optional(),
      offer: reference('service'),
      anonymized: z.boolean(),
    })
    .refine(datesInOrder, datesInOrderMessage),
});

const glossaryCollection = defineCollection({
  loader: glob({ pattern: ['*.md', '*.mdx'], base: 'src/data/glossary' }),
  schema: z
    .object({
      ...publishable,
      term: z.string(),
      shortDefinition: z.string().refine((value) => countWords(value) <= 50, { message: 'must be 50 words or fewer' }),
      definition: z
        .string()
        .refine((value) => isWithinWordRange(value, 100, 200), { message: 'must be 100–200 words' }),
      relatedTerms: z.array(reference('glossary')).default([]),
      sources: z.array(source).min(1),
    })
    .refine(datesInOrder, datesInOrderMessage),
});

const faqCollection = defineCollection({
  loader: glob({ pattern: ['*.md', '*.mdx'], base: 'src/data/faq' }),
  schema: z
    .object({
      question: ogTitleSchema,
      shortTitle: z
        .string()
        .max(TITLE_ROOM_CHARS, { message: `must be ${TITLE_ROOM_CHARS} characters or fewer` })
        .optional(),
      answer: z.string().refine((value) => countWords(value) <= 80, { message: 'must be 80 words or fewer' }),
      description: z
        .string()
        .min(DESCRIPTION_MIN_CHARS, { message: `must be ${DESCRIPTION_MIN_CHARS} characters or more` })
        .max(DESCRIPTION_MAX_CHARS, { message: `must be ${DESCRIPTION_MAX_CHARS} characters or fewer` })
        .optional(),
      category: z.enum([...CATEGORIES, 'general']),
      relatedPage: z.string().optional(),
      sources: z.array(source).optional(),
      order: z.number().int().positive(),
      publishDate: z.date(),
      updatedDate: z.date(),
      draft: z.boolean().default(false),
      noindex: z.boolean().default(false),
    })
    .refine(datesInOrder, datesInOrderMessage)
    .refine(
      (entry) => entry.description !== undefined || isDescriptionInRange(faqDescription(entry.question, entry.answer)),
      {
        message: `computed description must be ${DESCRIPTION_MIN_CHARS}–${DESCRIPTION_MAX_CHARS} characters`,
        path: ['description'],
      }
    ),
});

const authorCollection = defineCollection({
  loader: glob({ pattern: ['*.md', '*.mdx'], base: 'src/data/author' }),
  schema: z.object({
    name: z.string(),
    role: z.string(),
    bio: z.string(),
    sameAs: z.array(z.url()).min(1),
    credentials: z.array(z.string()).default([]),
  }),
});

export const collections = {
  post: postCollection,
  service: serviceCollection,
  resource: resourceCollection,
  case: caseCollection,
  glossary: glossaryCollection,
  faq: faqCollection,
  author: authorCollection,
};
