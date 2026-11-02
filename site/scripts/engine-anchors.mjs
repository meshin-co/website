const file = (path, role) => ({ path, kind: 'file', role });
const directory = (path, role) => ({ path, kind: 'directory', role });

export const FIXED_ANCHORS = [
  file('AGENTS.md', 'the repository law; the writer prompt quotes its four copy rules'),
  file(
    'docs/SEMANTIC-CORE.md',
    'the concept register, the buyer prompts and the family strategy the selector and the writer read'
  ),
  file('docs/CONTENT-GATE.md', 'the content-gate rows the writer prompt quotes'),
  file('audits/routes.json', 'the list of routes the site serves, read by the writer and the route gate'),
  file('audits/search-demand.md', 'the committed Search Console demand report the selector reads'),
  file('audits/sentence-band.json', 'the measured sentence band of each written format'),
  file('site/banned-phrases.json', 'the phrases no page may hold, read by the content gate and the writer prompt'),
  file('site/content-facts.json', 'the numbers a page may state without a source'),
  file(
    'site/controlled-words.json',
    'the plain words and their replacements, read by the content gate and the writer prompt'
  ),
  file('site/package.json', 'the npm scripts every workflow runs'),
  file('site/.nvmrc', 'the Node version every job installs'),
  file('site/src/config.yaml', 'the site name every title suffix and contact address derives from'),
  file('site/src/content.config.ts', 'the collection schemas the writer prompt quotes'),
  directory('site/.agents/skills', 'the skills the writer prompt quotes and the skill gate reads'),
  file('.github/workflows/ci.yml', 'the job graph; its changes job must call the diff classifier'),
  file('.github/workflows/watch-pr.yml', 'the watcher that merges, repairs or escalates a pull request'),
  file('.github/workflows/write-daily.yml', 'the daily run that picks a topic and writes one entry'),
];

export function anchorsFor({ content }) {
  const { dataDirectory, formats } = content;
  return [
    ...FIXED_ANCHORS,
    file(`${dataDirectory}/tags.mjs`, 'the tag slugs an article may use'),
    directory(
      `${dataDirectory}/${formats.term.collection}`,
      'the entries of the term format, whose slugs a related term may name'
    ),
    directory(`${dataDirectory}/${formats.article.collection}`, 'the entries of the article format'),
    directory(`${dataDirectory}/${formats.article.resourceCollection}`, 'the resources an article may relate to'),
  ];
}
