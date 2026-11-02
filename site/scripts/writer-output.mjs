import { describeProblem } from './autowriter-records.mjs';
import { CATEGORIES } from './entry-limits.mjs';
import { validateJsonSchema } from './json-schema.mjs';
import { WriterError } from './writer-error.mjs';

export const OUTPUT_SCHEMA_NAME = 'entry_draft';

const CLAIM_MARKERS = ['sourced', 'own-reading'];
const MAX_LISTED_PROBLEMS = 6;
const MAX_PROBLEM_CHARS = 160;

const text = { type: 'string' };
const nullableText = { type: ['string', 'null'] };
const textList = { type: 'array', items: text };
const choice = (values) => ({ type: 'string', enum: values });
const arrayOf = (items) => ({ type: 'array', items });
const objectOf = (properties) => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

const SOURCE = objectOf({ id: text, title: text, url: text, publisher: text });
const CLAIM = objectOf({ sentence: text, marker: choice(CLAIM_MARKERS), sourceId: nullableText, span: nullableText });

const FIELDS = {
  term: { description: text, shortDefinition: text, definition: text, relatedTerms: textList },
  article: {
    description: text,
    shortAnswer: text,
    fullAnswer: text,
    keyTakeaways: textList,
    faq: arrayOf(objectOf({ q: text, a: text })),
    category: choice(CATEGORIES),
    tags: textList,
    relatedResources: textList,
  },
};

export function outputSchema(format) {
  if (!Object.hasOwn(FIELDS, format)) throw new Error(`no output schema for the format "${format}"`);
  return structuredClone(
    objectOf({
      format: choice([format]),
      fields: objectOf(FIELDS[format]),
      body: text,
      sources: arrayOf(SOURCE),
      claims: arrayOf(CLAIM),
      passage: text,
    })
  );
}

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

function listed(problems) {
  const shown = problems
    .slice(0, MAX_LISTED_PROBLEMS)
    .map((found) => describeProblem(found).slice(0, MAX_PROBLEM_CHARS));
  const rest = problems.length - shown.length;
  return `${shown.join('; ')}${rest > 0 ? ` (+${rest} more)` : ''}`;
}

export function parseOutput(json, { format }) {
  if (!isRecord(json)) throw new WriterError('output', 'the model output is not a JSON object');
  const problems = validateJsonSchema(outputSchema(format), json);
  if (problems.length > 0) {
    throw new WriterError('output', `the model output does not match the ${format} schema: ${listed(problems)}`);
  }
  return json;
}
