import { OG_TITLE_MAX_CHARS } from '../src/utils/content-rules.mjs';
import { claimTableProblems } from './claim-sources.mjs';
import { judgePage, PROFILES } from './content-rows.mjs';
import { COLLECTION_OF, proseBlocks, proseSentences } from './entry-prose.mjs';
import { entryRoute, writtenFormat } from './entry-files.mjs';
import { targetQueryFor } from './route-derive.mjs';
import { bandFor, bandProblems, BAND_FILE, readBandRecord } from './sentence-band.mjs';
import { WriterError } from './writer-error.mjs';
import { headingOf } from './writer-page.mjs';
import { fieldProblems } from './writer-preflight-fields.mjs';
import { pageProblems } from './writer-preflight-page.mjs';
import { listing, REPO_FILES, readText, routeList, tagSlugs } from './writer-tree.mjs';

const REMEASURE = 'node scripts/measure-sentence-band.mjs --write';
const normalised = (query) => query.trim().toLowerCase().replace(/\s+/g, ' ');

function readJson(repoRoot, path) {
  try {
    return JSON.parse(readText(repoRoot, path));
  } catch (error) {
    if (error instanceof WriterError) throw error;
    throw new WriterError('config', `${path} is not readable JSON`);
  }
}

export function loadPreflightContext(repoRoot) {
  const bandRecord = readBandRecord(repoRoot);
  if (!bandRecord) throw new WriterError('config', `${BAND_FILE} does not exist; write it with ${REMEASURE}`);
  return {
    bannedPhrases: readJson(repoRoot, REPO_FILES.bannedPhrases),
    facts: readJson(repoRoot, REPO_FILES.contentFacts),
    controlledWords: readJson(repoRoot, REPO_FILES.controlledWords),
    bandRecord,
    routes: routeList(repoRoot),
    slugs: Object.fromEntries(
      Object.entries(REPO_FILES.collections).map(([name, path]) => [name, listing(repoRoot, path)])
    ),
    tags: tagSlugs(repoRoot),
  };
}

export const draftSentences = ({ draft, claim }) =>
  proseSentences(proseBlocks({ collection: COLLECTION_OF[claim.format], frontmatter: draft.fields, body: draft.body }));

function headingProblems({ claim, query }) {
  const route = entryRoute(claim);
  const page = {
    route,
    profile: claim.format,
    headings: { h1: [headingOf(claim)], sub: [] },
    paragraphs: [],
    lead: null,
    opening: '',
    text: '',
    links: { internal: [], external: [] },
    tables: 0,
    figures: 0,
    takeaways: 0,
    updated: null,
  };
  const found = judgePage(page, PROFILES[claim.format], { numbers: [], targetQuery: { [route]: query } }, []);
  return found
    .filter(({ rule }) => rule === 'h1-query')
    .map(() => ({
      rule: 'query-not-in-title',
      detail: `the heading "${headingOf(claim)}" lacks a word of the target query "${query}"`,
    }));
}

function claimedQueryProblems({ query, context }) {
  const owner = Object.entries(context.facts.targetQuery).find(([, held]) => normalised(held) === normalised(query));
  return owner
    ? [
        {
          rule: 'query-already-targeted',
          detail: `content-facts.json already holds "${query}" as the target query of ${owner[0]}`,
        },
      ]
    : [];
}

export function claimProblems({ claim, context }) {
  let query;
  try {
    writtenFormat(claim.format);
    query = targetQueryFor({ claim });
    headingOf(claim);
  } catch (error) {
    if (error instanceof WriterError)
      return [{ rule: claim.format in COLLECTION_OF ? 'title-shape' : 'format-unsupported', detail: error.message }];
    throw error;
  }
  const collection = COLLECTION_OF[claim.format];
  return [
    ...headingProblems({ claim, query }),
    ...claimedQueryProblems({ query, context }),
    ...(context.slugs[collection].includes(claim.slug)
      ? [{ rule: 'slug-exists', detail: `site/src/data/${collection}/${claim.slug}.md already exists` }]
      : []),
    ...(claim.title.length > OG_TITLE_MAX_CHARS
      ? [
          {
            rule: 'title-length',
            detail: `the title has ${claim.title.length} characters; content.config.ts allows ${OG_TITLE_MAX_CHARS}`,
          },
        ]
      : []),
  ];
}

const claimRow = ({ rule, sentence, detail }) => ({ rule, detail: `"${sentence}": ${detail}` });

const once = (problems) => {
  const seen = new Set();
  return problems.filter(({ rule, detail }) => {
    const key = `${rule}\u0000${detail}`;
    return seen.has(key) ? false : seen.add(key);
  });
};

export function preflight({ draft, claim, context, runDate }) {
  const sentences = draftSentences({ draft, claim });
  return once([
    ...fieldProblems({ draft, claim, context, runDate }),
    ...pageProblems({ draft, claim, context, runDate }),
    ...bandProblems({ sentences, band: bandFor(context.bandRecord, claim.format) }),
    ...claimTableProblems({ claims: draft.claims, sources: draft.sources, sentences }).map(claimRow),
  ]);
}

export function correctionMessage(problems) {
  if (problems.length === 0) throw new RangeError('there is no problem to correct');
  const lines = problems.map(({ rule, detail }, index) => `${index + 1}. ${rule}: ${detail}`);
  return [
    'The entry you returned fails the checks that run before the build.',
    'Fix every problem below and return the complete corrected output: the same JSON shape with every field, not only the fields you changed.',
    'Do not add or invent a fact to fix a problem; reword or remove the text instead.',
    '',
    ...lines,
  ].join('\n');
}
