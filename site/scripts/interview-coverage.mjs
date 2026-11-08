import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const INTERVIEW_PATH = 'docs/plan/reference/new-site-interview.md';

const ENV_EXAMPLE_PATH = 'site/.env.example';
const WORKFLOWS_DIRECTORY = '.github/workflows';
const WORKFLOW_FILE = /\.ya?ml$/;
const RULE = 'interview-gap';
const DUPLICATE_RULE = 'interview-duplicate-id';
const STEP_HEADING = /^#### (S\d+)\. (.+)$/gm;
const ISSUED_BY_GITHUB = 'GITHUB_TOKEN';
const CONFIG_KIND = 'config value';
const ENV_KIND = 'env example variable';
const CONTEXT_KINDS = { secrets: 'workflow secret', vars: 'workflow variable' };
const CONTEXT_READ = /(?<![\w.-])(secrets|vars)(?:\.([A-Za-z_]\w*)|\[\s*['"]([A-Za-z_]\w*)['"]\s*\])/g;
const ENV_ASSIGNMENT = /^[ \t]*(?:#[ \t]*)?(?:export[ \t]+)?([A-Za-z_]\w*)=/gm;

const workflowReads = (text) =>
  [...text.matchAll(CONTEXT_READ)]
    .map(([, context, dotted, indexed]) => ({ kind: CONTEXT_KINDS[context], name: dotted ?? indexed }))
    .filter(({ name }) => name !== ISSUED_BY_GITHUB);

const envReads = (text) => [...text.matchAll(ENV_ASSIGNMENT)].map(([, name]) => ({ kind: ENV_KIND, name }));

function kindsByName({ configPaths, workflows, envExample }) {
  const found = new Map();
  const reads = [
    ...configPaths.map((name) => ({ kind: CONFIG_KIND, name })),
    ...workflows.flatMap(workflowReads),
    ...envReads(envExample),
  ];
  for (const { kind, name } of reads) {
    const kinds = found.get(name) ?? [];
    if (!kinds.includes(kind)) kinds.push(kind);
    found.set(name, kinds);
  }
  return found;
}

const isWordCharacter = (character) => character !== undefined && /\w/.test(character);

function isNamed(text, name) {
  for (let at = text.indexOf(name); at !== -1; at = text.indexOf(name, at + 1)) {
    if (!isWordCharacter(text[at - 1]) && !isWordCharacter(text[at + name.length])) return true;
  }
  return false;
}

function duplicateIdFindings(bank) {
  const titlesById = new Map();
  for (const [, id, title] of bank.matchAll(STEP_HEADING)) {
    titlesById.set(id, [...(titlesById.get(id) ?? []), title.trim()]);
  }
  return [...titlesById]
    .filter(([, titles]) => titles.length > 1)
    .map(([id, titles]) => ({
      rule: DUPLICATE_RULE,
      where: id,
      detail: `${titles.length} questions in ${INTERVIEW_PATH} head with ${id} (${titles.join('; ')}), so an answer recorded against that id names two questions`,
    }));
}

export function interviewFindings({ configPaths, workflows, envExample, bank }) {
  const gaps = [...kindsByName({ configPaths, workflows, envExample })]
    .filter(([name]) => !isNamed(bank, name))
    .map(([name, kinds]) => ({
      rule: RULE,
      where: name,
      detail: `${kinds.join(', ')}; no question in ${INTERVIEW_PATH} names it, so the owner is never asked for it`,
    }));
  return [...gaps, ...duplicateIdFindings(bank)];
}

const readIfPresent = (file) => (existsSync(file) ? readFileSync(file, 'utf8') : '');

function readWorkflows(root) {
  const directory = join(root, WORKFLOWS_DIRECTORY);
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((file) => WORKFLOW_FILE.test(file))
    .sort()
    .map((file) => readFileSync(join(directory, file), 'utf8'));
}

export const readInterviewInputs = (root) => ({
  workflows: readWorkflows(root),
  envExample: readIfPresent(join(root, ENV_EXAMPLE_PATH)),
  bank: readIfPresent(join(root, INTERVIEW_PATH)),
});
