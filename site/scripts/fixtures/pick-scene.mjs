import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';

import { table } from '../markdown-table.mjs';
import { runCli } from '../pick-a-topic.mjs';
import { siteBrand } from '../site-brand.mjs';

const BRAND = siteBrand().name;

export const NOW = new Date('2026-11-02T04:00:00.000Z');

const FIXTURE_CONCEPTS = [
  [
    'Evals',
    '/glossary/evals',
    'An eval is a repeatable test that scores an AI system against examples with known answers.',
  ],
  [
    'AI register',
    '/glossary/ai-register',
    'An AI register is a company inventory of every AI system it builds, buys or uses.',
  ],
  [
    'Guardrails',
    '/glossary/guardrails',
    'A guardrail is a rule that stops an AI system before it does something it may not do.',
  ],
];

const EMPTY_CORE = [
  '# Semantic core',
  '',
  '<!-- semantic-core:begin generated -->',
  '',
  '<!-- semantic-core:end generated -->',
  '',
  '#### Concept register (3)',
  '',
  table(
    ['Concept', 'Defined by', 'Definition'],
    FIXTURE_CONCEPTS.map(([concept, route, text]) => [concept, `\`${route}\``, text])
  ),
  '',
].join('\n');
const POSTS = 'site/src/data/post';
const QUERY_HEADER = ['Query', 'Impressions', 'Clicks', 'Position', 'CTR', 'Page', 'Prompts'];
const PROMPT_HEADER = ['#', 'Prompt', 'Must win', 'Impressions', 'Position', 'Carried by'];
const NOTHING = 'Nothing was measured.';

export const queryRow = (text, impressions, position, page = '/blog') => [
  text,
  impressions,
  0,
  position.toFixed(1),
  '0.0%',
  `\`${page}\``,
  '-',
];

export const unprovenPrompt = (number, text) => [number, text, '-', 'unproven', '-', '-'];

export const provenPrompt = (number, text) => [number, text, '-', 3, '40.0', '-'];

export const reportText = ({ prompts = [], queries = [] } = {}) =>
  [
    '# Search demand: what Search Console measured',
    '',
    'Generated-from: b5d0639',
    '',
    'Measured: 2026-11-01 (window 2026-08-01 to 2026-10-30)',
    '',
    `Property: sc-domain:${BRAND}`,
    '',
    '## Queries',
    '',
    queries.length === 0 ? NOTHING : table(QUERY_HEADER, queries),
    '',
    '## Buyer prompts',
    '',
    prompts.length === 0 ? NOTHING : table(PROMPT_HEADER, prompts),
    '',
  ].join('\n');

export const postSource = ({ title, category, publishDate }) => {
  const head = ['---', `title: '${title}'`, `category: ${category}`, `publishDate: ${publishDate}`, '---'];
  return [...head, '', 'Body.', ''].join('\n');
};

const put = (root, path, text) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
};

const filesBelow = (root, directory) => {
  try {
    return readdirSync(join(root, directory), { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map(({ parentPath, name }) => relative(root, join(parentPath, name)))
      .sort();
  } catch {
    return [];
  }
};

export const modelNeverCalled = () => {
  throw new Error('the picker called the model');
};

function sceneOf(root) {
  const run = async (argv = [], { vendor, rotation, schedule, env, fetch, now = () => NOW } = {}) => {
    const stdout = [];
    const stderr = [];
    const exit = await runCli(argv, {
      repoRoot: root,
      env: env ?? vendor?.env ?? {},
      fetch: fetch ?? vendor?.fetch ?? modelNeverCalled,
      now,
      ...(rotation === undefined ? {} : { rotation }),
      ...(schedule === undefined ? {} : { schedule }),
      stdout: (line) => stdout.push(line),
      stderr: (line) => stderr.push(line),
    });
    return { exit, stdout, stderr };
  };
  return {
    root,
    run,
    put: (path, value) => put(root, path, typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`),
    read: (path) => readFileSync(join(root, path), 'utf8'),
    json: (path) => JSON.parse(readFileSync(join(root, path), 'utf8')),
    filesBelow: (directory) => filesBelow(root, directory),
  };
}

export async function withPickRepo({ report = reportText(), posts = {}, core = EMPTY_CORE } = {}, body) {
  const root = mkdtempSync(join(tmpdir(), 'pick-scene-'));
  try {
    mkdirSync(join(root, POSTS), { recursive: true });
    mkdirSync(join(root, 'docs'), { recursive: true });
    put(root, 'docs/SEMANTIC-CORE.md', core);
    put(root, 'audits/search-demand.md', report);
    put(root, 'site/src/config.yaml', `site:\n  name: ${BRAND}\n`);
    put(root, 'site/content-facts.json', '{}\n');
    for (const [slug, frontmatter] of Object.entries(posts)) put(root, `${POSTS}/${slug}.md`, postSource(frontmatter));
    return await body(sceneOf(root));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
