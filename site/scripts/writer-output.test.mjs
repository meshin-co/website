import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CATEGORIES } from './entry-limits.mjs';
import { OUTPUT_SCHEMA_NAME, outputSchema, parseOutput } from './writer-output.mjs';
import { WriterError } from './writer-error.mjs';

const FORMATS = ['term', 'article'];
const ALLOWED_KEYWORDS = new Set(['type', 'properties', 'required', 'additionalProperties', 'items', 'enum']);
const ALLOWED_TYPES = new Set(['object', 'array', 'string', 'integer', 'boolean', 'null']);
const STRICT_NESTING_LIMIT = 10;
const STRICT_PROPERTY_LIMIT = 5000;
const STRICT_ENUM_VALUE_LIMIT = 1000;

const FIELD_NAMES = {
  term: ['description', 'shortDefinition', 'definition', 'relatedTerms'],
  article: ['description', 'shortAnswer', 'fullAnswer', 'keyTakeaways', 'faq', 'category', 'tags', 'relatedResources'],
};

function nodesOf(schema, path = '$', depth = 1) {
  const children = [
    ...Object.entries(schema.properties ?? {}).map(([name, child]) => [`${path}.${name}`, child]),
    ...(schema.items ? [[`${path}[]`, schema.items]] : []),
  ];
  return [{ path, schema, depth }, ...children.flatMap(([at, child]) => nodesOf(child, at, depth + 1))];
}

function subsetViolations(schema) {
  return nodesOf(schema).flatMap(({ path, schema: node }) => {
    const found = [];
    for (const keyword of Object.keys(node)) {
      if (!ALLOWED_KEYWORDS.has(keyword)) found.push(`${path} uses ${keyword}`);
    }
    for (const name of [node.type].flat()) {
      if (!ALLOWED_TYPES.has(name)) found.push(`${path} has the type ${name}`);
    }
    if (node.type === 'object') {
      if (node.additionalProperties !== false) found.push(`${path} allows extra keys`);
      const listed = [...(node.required ?? [])].sort();
      const declared = Object.keys(node.properties ?? {}).sort();
      if (JSON.stringify(listed) !== JSON.stringify(declared)) found.push(`${path} leaves a property optional`);
    }
    if (node.type === 'array' && !node.items) found.push(`${path} has no items`);
    return found;
  });
}

const minimal = {
  term: { description: 'd', shortDefinition: 's', definition: 'l', relatedTerms: [] },
  article: {
    description: 'd',
    shortAnswer: 's',
    fullAnswer: 'f',
    keyTakeaways: ['k'],
    faq: [{ q: 'q?', a: 'a.' }],
    category: 'governance',
    tags: [],
    relatedResources: [],
  },
};

const draftOf = (format) => ({
  format,
  fields: structuredClone(minimal[format]),
  body: '',
  sources: [{ id: 'S1', title: 'A source', url: 'https://example.org/a', publisher: '' }],
  claims: [{ sentence: 'A sentence.', marker: 'own-reading', sourceId: null, span: null }],
  passage: 'A sentence.',
});

const refusal = (run, ...named) =>
  assert.throws(run, (error) => {
    assert.ok(error instanceof WriterError, 'the refusal is a WriterError');
    assert.equal(error.kind, 'output');
    for (const part of named) assert.ok(error.message.includes(part), `the message names ${part}: ${error.message}`);
    return true;
  });

test('the schema name is one a strict json_schema format accepts as a name', () => {
  assert.match(OUTPUT_SCHEMA_NAME, /^[A-Za-z0-9_-]{1,64}$/);
});

for (const format of FORMATS) {
  test(`the ${format} schema stays inside the strict structured-output subset`, () => {
    assert.deepEqual(subsetViolations(outputSchema(format)), []);
  });

  test(`the ${format} schema stays inside the published strict-mode limits`, () => {
    const nodes = nodesOf(outputSchema(format));
    assert.ok(Math.max(...nodes.map(({ depth }) => depth)) <= STRICT_NESTING_LIMIT);
    assert.ok(
      nodes.reduce((sum, { schema }) => sum + Object.keys(schema.properties ?? {}).length, 0) <= STRICT_PROPERTY_LIMIT
    );
    assert.ok(nodes.reduce((sum, { schema }) => sum + (schema.enum?.length ?? 0), 0) <= STRICT_ENUM_VALUE_LIMIT);
  });

  test(`the ${format} schema asks for the draft the contract names, and nothing else`, () => {
    const schema = outputSchema(format);
    assert.equal(schema.type, 'object');
    assert.deepEqual(Object.keys(schema.properties), ['format', 'fields', 'body', 'sources', 'claims', 'passage']);
    assert.deepEqual(schema.properties.format, { type: 'string', enum: [format] });
    assert.deepEqual(Object.keys(schema.properties.fields.properties), FIELD_NAMES[format]);
    assert.deepEqual(Object.keys(schema.properties.sources.items.properties), ['id', 'title', 'url', 'publisher']);
    assert.deepEqual(Object.keys(schema.properties.claims.items.properties), [
      'sentence',
      'marker',
      'sourceId',
      'span',
    ]);
  });
}

test('a claim marker is one of two words, and a claim may leave its source and span null', () => {
  const claim = outputSchema('article').properties.claims.items.properties;
  assert.deepEqual(claim.marker, { type: 'string', enum: ['sourced', 'own-reading'] });
  assert.deepEqual(claim.sourceId, { type: ['string', 'null'] });
  assert.deepEqual(claim.span, { type: ['string', 'null'] });
});

test('the category is an enum of the categories the collection accepts', () => {
  assert.deepEqual(outputSchema('article').properties.fields.properties.category?.enum, CATEGORIES);
});

test('a format the writer has no schema for is refused, the dropped faq-answer included', () => {
  for (const format of ['case-study', 'faq-answer']) assert.throws(() => outputSchema(format), new RegExp(format));
});

test('the subset check can fail: a length, a pattern, a reference, a union or a loose object is named', () => {
  const planted = {
    type: 'object',
    properties: {
      a: { type: 'string', minLength: 1 },
      b: { type: 'string', pattern: '^x' },
      c: { $ref: '#/$defs/c' },
      d: { oneOf: [{ type: 'string' }] },
      e: { type: 'object', properties: { f: { type: 'string' } }, required: [] },
      g: { type: 'array' },
      h: { type: 'number' },
    },
    required: ['a', 'b', 'c', 'd', 'e', 'g', 'h'],
    additionalProperties: false,
  };
  const found = subsetViolations(planted).join(' | ');
  for (const part of [
    'uses minLength',
    'uses pattern',
    'uses $ref',
    'uses oneOf',
    'allows extra keys',
    'leaves a property optional',
    'has no items',
    'has the type number',
  ]) {
    assert.ok(found.includes(part), `${part} was not caught: ${found}`);
  }
});

for (const format of FORMATS) {
  test(`a ${format} draft that matches the schema is returned whole`, () => {
    const draft = draftOf(format);
    assert.deepEqual(parseOutput(structuredClone(draft), { format }), draft);
  });
}

test('output that is not a JSON object is refused as output', () => {
  for (const value of ['text', null, [], 7]) refusal(() => parseOutput(value, { format: 'term' }), 'JSON object');
});

test('a missing field is refused, naming the field', () => {
  const draft = draftOf('article');
  delete draft.fields.shortAnswer;
  refusal(() => parseOutput(draft, { format: 'article' }), 'fields.shortAnswer');
});

test('a field of the wrong type is refused, naming the field and not echoing its value', () => {
  const draft = draftOf('article');
  draft.fields.keyTakeaways = 'SENTINEL-TEXT-THE-MODEL-WROTE';
  refusal(() => parseOutput(draft, { format: 'article' }), 'fields.keyTakeaways');
  try {
    parseOutput(draft, { format: 'article' });
  } catch (error) {
    assert.ok(!error.message.includes('SENTINEL'));
  }
});

test('a nested field is named by its path', () => {
  const sourced = draftOf('term');
  sourced.sources[0].url = 7;
  refusal(() => parseOutput(sourced, { format: 'term' }), 'sources[0].url');
  const marked = draftOf('term');
  marked.claims[0].marker = 'guess';
  refusal(() => parseOutput(marked, { format: 'term' }), 'claims[0].marker');
  const unbound = draftOf('term');
  delete unbound.claims[0].sourceId;
  refusal(() => parseOutput(unbound, { format: 'term' }), 'claims[0].sourceId');
  const faq = draftOf('article');
  faq.fields.faq[0].q = null;
  refusal(() => parseOutput(faq, { format: 'article' }), 'fields.faq[0].q');
});

test('a category the collection does not accept is refused, naming the field', () => {
  const draft = draftOf('article');
  draft.fields.category = 'general';
  refusal(() => parseOutput(draft, { format: 'article' }), 'fields.category');
});

test('a key the schema does not know is refused, and a long one is cut', () => {
  const draft = draftOf('term');
  draft.notes = 'x';
  refusal(() => parseOutput(draft, { format: 'term' }), 'notes');
  const loud = draftOf('term');
  loud['k'.repeat(5000)] = 1;
  try {
    parseOutput(loud, { format: 'term' });
    assert.fail('the long key was accepted');
  } catch (error) {
    assert.equal(error.kind, 'output');
    assert.ok(error.message.length < 800, `the message is ${error.message.length} characters`);
  }
});

test('a draft of another format than the one asked for is refused, naming the format field', () => {
  refusal(() => parseOutput(draftOf('term'), { format: 'article' }), 'format');
});

test('many problems are listed up to a limit, then counted', () => {
  const draft = draftOf('article');
  for (const name of Object.keys(draft.fields)) draft.fields[name] = 7;
  draft.body = 7;
  draft.passage = 7;
  try {
    parseOutput(draft, { format: 'article' });
    assert.fail('the draft was accepted');
  } catch (error) {
    assert.match(error.message, /\(\+\d+ more\)/);
  }
});
