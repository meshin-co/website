import { entryRoute } from './entry-files.mjs';
import { discoverRoutes } from './gate.mjs';
import { corpusFiles } from './spend-report.mjs';
import { corpusOf, reportModel } from './spend-report-model.mjs';

async function routesOf(dist) {
  try {
    return new Set(await discoverRoutes(dist));
  } catch (error) {
    throw new Error(`the build directory ${dist} cannot be read: ${error.code ?? error.message}`, { cause: error });
  }
}

const entryOf = ({ row, record }) => ({
  route: entryRoute(row),
  slug: row.slug,
  format: row.format,
  title: record.claim.title,
  prompt: record.claim.prompt,
  generatedAt: row.generatedAt,
  input: row.input,
  output: row.output,
  micro: row.micro,
});

export async function entriesInBuild({ repoRoot, dist, instant }) {
  const corpus = corpusOf(corpusFiles(repoRoot));
  const { rows } = reportModel(corpus, { at: instant.toISOString() });
  const built = await routesOf(dist);
  const records = new Map(corpus.records.map((record) => [record.slug, record]));
  const entries = rows
    .map((row) => entryOf({ row, record: records.get(row.slug) }))
    .filter(({ route }) => built.has(route));
  return { entries, problems: corpus.problems };
}
