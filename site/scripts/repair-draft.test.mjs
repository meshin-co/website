import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { resolveClaimTable } from './claim-sources.mjs';
import { renderEntry } from './entry-files.mjs';
import { validateJsonSchema } from './json-schema.mjs';
import { draftOfEntry, publishDateOf, sameEntry } from './repair-draft.mjs';
import { RepairStop } from './repair-outcome.mjs';
import { outputSchema } from './writer-output.mjs';
import { RUN_DATE, claimFor, cleanDraft } from './fixtures/writer-drafts.mjs';

const FORMATS = ['article', 'term'];

function citedDraft(format) {
  const draft = cleanDraft(format);
  for (const { id } of draft.sources) {
    if (draft.claims.some(({ sourceId }) => sourceId === id)) continue;
    draft.claims.push({ sentence: `Row that cites ${id}.`, marker: 'sourced', sourceId: id, span: `span of ${id}` });
  }
  return draft;
}

const entryOf = (format, draft) => renderEntry({ claim: claimFor(format), draft, runDate: RUN_DATE }).text;

const readBack = (format, draft, overrides = {}) =>
  draftOfEntry({
    claim: claimFor(format),
    entryText: entryOf(format, draft),
    claimTable: resolveClaimTable(draft),
    passage: draft.passage,
    ...overrides,
  });

const withFrontmatter = (text, replace) =>
  text.replace(/^---\n([\s\S]*?)\n---/, (_, yaml) => `---\n${replace(yaml)}\n---`);

const failedStop = (match) => (error) =>
  error instanceof RepairStop && error.outcome === 'failed' && match.test(error.message);

for (const format of FORMATS) {
  test(`a ${format} entry read back is the draft it was rendered from, when every source is cited`, () => {
    const draft = citedDraft(format);

    assert.deepEqual(readBack(format, draft), draft);
  });

  test(`a ${format} draft read back validates against the output schema`, () => {
    const draft = citedDraft(format);

    assert.deepEqual(validateJsonSchema(outputSchema(format), readBack(format, draft)), []);
  });

  test(`a ${format} source no claim cites gets a generated id and everything else is equal`, () => {
    const draft = citedDraft(format);
    const uncited = { id: 'S9', title: 'Uncited', url: 'https://example.com/uncited', publisher: 'Example' };
    draft.sources.splice(1, 0, uncited);
    const position = 2;

    const back = readBack(format, draft);

    assert.deepEqual(back.sources[position - 1], { ...uncited, id: `source-${position}` });
    assert.deepEqual(
      { ...back, sources: back.sources.filter((source) => source.id !== `source-${position}`) },
      { ...draft, sources: draft.sources.filter(({ id }) => id !== uncited.id) }
    );
  });
}

test('a generated source id never collides with an id the claim table already gives', () => {
  const draft = cleanDraft('term');
  draft.sources[0].id = 'source-2';
  draft.claims[0].sourceId = 'source-2';

  const back = draftOfEntry({
    claim: claimFor('term'),
    entryText: entryOf('term', draft),
    claimTable: resolveClaimTable(draft),
    passage: draft.passage,
  });

  assert.equal(back.sources[0].id, 'source-2');
  assert.notEqual(back.sources[1].id, 'source-2');
  assert.equal(new Set(back.sources.map(({ id }) => id)).size, back.sources.length);
});

test('an omitted optional list comes back as an empty list, and an absent publisher as an empty string', () => {
  const article = cleanDraft('article');
  Object.assign(article.fields, { faq: [], tags: [], relatedResources: [] });
  article.sources[0].publisher = '';
  const term = cleanDraft('term');
  term.fields.relatedTerms = [];

  const backArticle = readBack('article', article);
  const backTerm = readBack('term', term);

  assert.doesNotMatch(entryOf('article', article), /^(?:faq|tags|relatedResources):/m);
  assert.doesNotMatch(entryOf('term', term), /^relatedTerms:/m);
  assert.deepEqual(
    [backArticle.fields.faq, backArticle.fields.tags, backArticle.fields.relatedResources],
    [[], [], []]
  );
  assert.deepEqual(backTerm.fields.relatedTerms, []);
  assert.equal(backArticle.sources[0].publisher, '');
});

test('fields hold exactly the members the output schema names for the format', () => {
  for (const format of FORMATS) {
    const named = Object.keys(outputSchema(format).properties.fields.properties);

    assert.deepEqual(Object.keys(readBack(format, cleanDraft(format)).fields).sort(), named.sort());
  }
});

test('an entry whose front matter lacks a member the format needs is refused', () => {
  const draft = cleanDraft('article');
  const text = withFrontmatter(entryOf('article', draft), (yaml) => yaml.replace(/^shortAnswer:.*$/m, ''));

  assert.throws(() => readBack('article', draft, { entryText: text }), failedStop(/shortAnswer/));
});

test('a claim table that names a url the entry does not list is refused', () => {
  const draft = cleanDraft('term');
  const claimTable = resolveClaimTable(draft);
  claimTable[0].source.url = 'https://example.com/not-listed';

  assert.throws(() => readBack('term', draft, { claimTable }), failedStop(/not-listed/));
});

test('an entry with no readable front matter is refused', () => {
  assert.throws(
    () => readBack('term', cleanDraft('term'), { entryText: 'no front matter' }),
    failedStop(/front matter/)
  );
});

test('publishDate gives YYYY-MM-DD from a string and from a YAML timestamp', () => {
  assert.equal(publishDateOf("---\npublishDate: '2026-11-02'\n---\n"), '2026-11-02');
  assert.equal(publishDateOf('---\npublishDate: 2026-11-02\n---\n'), '2026-11-02');
  assert.equal(publishDateOf('---\npublishDate: !!timestamp 2026-11-02\n---\n'), '2026-11-02');
  assert.equal(publishDateOf(entryOf('term', cleanDraft('term'))), RUN_DATE);
});

test('a publish date that is missing, not a calendar day or not readable is refused', () => {
  for (const text of [
    '---\ntitle: x\n---\n',
    '---\npublishDate: 2026-02-30\n---\n',
    '---\npublishDate: soon\n---\n',
    '---\npublishDate: 20261102\n---\n',
    '---\npublishDate: [a\n---\n',
    'no front matter',
    '---\n- a\n---\n',
  ])
    assert.throws(() => publishDateOf(text), failedStop(/publishDate|front matter/), text);
});

const changed = {
  'one word of the body': (draft) => ({ ...draft, body: draft.body.replace('assessor', 'reviewer') }),
  'a field': (draft) => ({ ...draft, fields: { ...draft.fields, description: `${draft.fields.description} Now.` } }),
  'a source url': (draft) => ({
    ...draft,
    sources: draft.sources.map((source, index) => (index === 0 ? { ...source, url: 'https://example.com/x' } : source)),
  }),
  'a claim span': (draft) => ({
    ...draft,
    claims: draft.claims.map((claim, index) => (index === 0 ? { ...claim, span: 'another span' } : claim)),
  }),
  'the passage': (draft) => ({ ...draft, passage: `${draft.passage} More.` }),
};

for (const [what, change] of Object.entries(changed))
  test(`two drafts differ after ${what} changes`, () => {
    const draft = citedDraft('term');

    assert.equal(sameEntry(draft, change(draft)), false);
    assert.equal(sameEntry(change(draft), draft), false);
  });

test('two drafts are the same entry after a source id is renamed consistently, and after the body is padded', () => {
  const draft = citedDraft('article');
  const renamed = structuredClone(draft);
  renamed.sources[0].id = 'renamed';
  for (const claim of renamed.claims) if (claim.sourceId === draft.sources[0].id) claim.sourceId = 'renamed';

  assert.equal(sameEntry(draft, renamed), true);
  assert.equal(sameEntry(draft, { ...draft, body: `\n${draft.body}\n\n` }), true);
  assert.equal(sameEntry(draft, structuredClone(draft)), true);
});

test('a claim that names an unknown source id makes the drafts different instead of throwing', () => {
  const draft = citedDraft('term');
  const broken = structuredClone(draft);
  broken.claims[0].sourceId = 'nowhere';

  assert.equal(sameEntry(draft, broken), false);
  assert.equal(sameEntry(broken, draft), false);
});

test('a source id that moves from one claim to another source counts as a change', () => {
  const draft = citedDraft('term');
  const swapped = structuredClone(draft);
  swapped.claims[0].sourceId = draft.sources[1].id;

  assert.equal(sameEntry(draft, swapped), false);
});
