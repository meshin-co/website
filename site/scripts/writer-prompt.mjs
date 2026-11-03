import { LENGTH_FILE } from './entry-length.mjs';
import { writtenFormat } from './entry-files.mjs';
import { COLLECTION_OF, RESOURCE_COLLECTION } from './entry-prose.mjs';
import { BAND_FILE } from './sentence-band.mjs';
import { outputSchema } from './writer-output.mjs';
import { readSources } from './writer-prompt-read.mjs';
import { systemPrompt, userPrompt } from './writer-prompt-text.mjs';
import { DATA_DIRECTORY, sha256Of } from './writer-tree.mjs';

export const MAX_OUTPUT_TOKENS = 32000;

const SEPARATOR = '\n\u0000\n';
const SKILLS = 'site/.agents/skills';
const COLLECTION_HELPERS = ['const CATEGORIES', 'const postCollection = defineCollection('];

const whole = { kind: 'whole' };
const bullet = (anchor) => ({ kind: 'bullet', anchor });
const section = (anchor, formats) => ({ kind: 'section', anchor, ...(formats && { formats }) });
const data = (kind, key, field) => ({ kind, key, ...(field && { field }) });

export const PROMPT_SOURCES = [
  {
    path: 'AGENTS.md',
    part: 'The four hard rules that govern copy: the content rules, no invented fact, the copy tone and no unreviewed string.',
    take: [
      bullet('Content rules: every post'),
      bullet('Never invent an owner fact'),
      bullet('Copy tone: direct and engineering'),
      bullet('No user-facing string ships unreviewed'),
    ],
  },
  { path: `${SKILLS}/write-copy.md`, part: 'The whole skill on how copy is written.', take: [whole] },
  { path: `${SKILLS}/write-for-humans.md`, part: 'The whole skill on writing for human readers.', take: [whole] },
  { path: `${SKILLS}/place-a-new-text.md`, part: 'The whole skill on where a new text belongs.', take: [whole] },
  {
    path: `${SKILLS}/add-collection-entry.md`,
    part: 'The whole skill on adding an entry to a collection.',
    take: [whole],
  },
  {
    path: 'site/src/content.config.ts',
    part: 'The shared helpers (categories, word ranges, publishable fields) and the collection of the format.',
    take: [
      { kind: 'between', anchor: COLLECTION_HELPERS },
      { kind: 'declaration', anchor: 'const glossaryCollection = defineCollection(', formats: ['term'] },
      { kind: 'declaration', anchor: COLLECTION_HELPERS[1], formats: ['article'] },
    ],
  },
  {
    path: 'docs/CONTENT-GATE.md',
    part: 'The mechanical rows of every page, the extra rows of an article and the honesty rows.',
    take: [
      section('### Every content page'),
      section('### Articles additionally', ['article']),
      section('### Honesty rows (every page, no exceptions)'),
    ],
  },
  {
    path: 'docs/SEMANTIC-CORE.md',
    part: 'Why each family exists, the strategy of the families and the block of the buyer prompt the claim answers.',
    take: [
      section('### Why each family exists'),
      section('### Family strategy'),
      { kind: 'promptBlock', key: 'promptBlock', anchor: (claim) => claim.prompt.number },
    ],
  },
  {
    path: 'site/banned-phrases.json',
    part: 'The whole list of banned phrases.',
    take: [data('json', 'bannedPhrases')],
  },
  {
    path: 'site/controlled-words.json',
    part: 'The whole list of plain words and their replacements.',
    take: [data('json', 'controlledWords')],
  },
  {
    path: 'site/content-facts.json',
    part: 'The numbers a page may state without a source.',
    take: [{ ...data('json', 'numbers', 'numbers'), allowEmpty: true }],
  },
  { path: BAND_FILE, part: 'The sentence band of the format of the claim.', take: [data('band', 'band')] },
  {
    path: LENGTH_FILE,
    part: 'The length floor and the target range of the body of the format of the claim.',
    take: [data('length', 'length')],
  },
  { path: 'audits/routes.json', part: 'The whole list of routes the site serves.', take: [data('routes', 'routes')] },
  { path: `${DATA_DIRECTORY}/tags.mjs`, part: 'The slugs of the tags that exist.', take: [data('tags', 'tags')] },
  {
    path: `${DATA_DIRECTORY}/${COLLECTION_OF.term}`,
    part: 'The slugs of the glossary terms that exist.',
    take: [data('slugs', 'glossary')],
  },
  {
    path: `${DATA_DIRECTORY}/${RESOURCE_COLLECTION}`,
    part: 'The slugs of the resources that exist.',
    take: [data('slugs', 'resource')],
  },
];

export function buildPrompt({
  repoRoot,
  claim,
  demandRow,
  runDate,
  userOf = (read) => userPrompt({ claim, demandRow, runDate, read }),
}) {
  writtenFormat(claim.format);
  const read = readSources({ repoRoot, claim, sources: PROMPT_SOURCES });
  const system = systemPrompt({ claim, read });
  const user = userOf(read);
  return {
    system,
    user,
    files: read.files,
    digest: sha256Of(`${system}${SEPARATOR}${user}`),
    schemaDigest: sha256Of(JSON.stringify(outputSchema(claim.format))),
    maxOutputTokens: MAX_OUTPUT_TOKENS,
  };
}
