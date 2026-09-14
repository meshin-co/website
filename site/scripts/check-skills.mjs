import { readdir, readFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_LINES = 80;

const FORBIDDEN = [
  { test: (text) => /\bpagefind\b/i.test(text), detail: 'Pagefind claim (search is the custom index; PLAN §3 step 6)' },
  { test: (text) => /\bdecap\b/i.test(text), detail: 'Decap CMS claim (this repo never had a CMS)' },
  {
    test: (text) => /contact form/i.test(text),
    detail: 'contact form claim (L6: /contact is an email address plus a Cal.com link)',
  },
  {
    test: (text) => /(^|[\s(`"])\.perfect-coder\//.test(text),
    detail: 'repo-side .perfect-coder/ path (plugin state lives home-side, never in the repo)',
  },
];

const SCHEME = /^[a-z][\w+.-]*:\/\//i;
const KNOWN_ROOT_SEGMENTS = new Set(['site', 'docs', 'audits', 'src', 'scripts', 'tests', 'public', '.github']);
const GENERATED_PREFIXES = ['dist/', '.lighthouseci', 'node_modules/', 'test-results/'];

const isDirectory = (path) => existsSync(path) && statSync(path).isDirectory();

const looksLikePath = (token) => {
  if (token.includes(' ') || token.includes(':') || SCHEME.test(token)) return false;
  if (!token.includes('/')) return false;
  if (GENERATED_PREFIXES.some((prefix) => token.startsWith(prefix))) return false;
  return KNOWN_ROOT_SEGMENTS.has(token.split('/')[0]);
};

const TRAILING_PUNCTUATION = /[.,;:!?)]+$/;

export function pathCandidates(text) {
  const spans = [...text.matchAll(/`([^`\n]+)`/g)].map(([, span]) => span.trim());
  const bare = [...text.matchAll(/(?<![\w`@./])([\w@.-]+(?:\/[\w@.-]+)+)/g)].map(([token]) =>
    token.replace(TRAILING_PUNCTUATION, '')
  );
  return [...new Set([...spans, ...bare])].filter(looksLikePath);
}

const TEMPLATE_CHARS = /[{}<>[\]$]/;
const TEMPLATE_PHASE = /^phase-[a-z]+$/i;

function existsWithPlaceholders(path) {
  if (existsSync(path)) return true;
  const segments = path.split('/');
  for (let cut = segments.length - 1; cut > 0; cut -= 1) {
    const head = segments.slice(0, cut).join('/');
    const tail = segments.slice(cut).filter((segment) => segment !== '');
    if (existsSync(head)) {
      const templated = tail.some((segment) => TEMPLATE_CHARS.test(segment) || TEMPLATE_PHASE.test(segment));
      return isDirectory(head) && templated;
    }
  }
  return false;
}

export function resolveCandidate(token, roots) {
  const candidates = token.startsWith('~/')
    ? roots.map((root) => join(root, 'src', token.slice(2)))
    : roots.map((root) => join(root, token));
  for (const candidate of candidates) {
    if (existsWithPlaceholders(candidate)) return candidate;
  }
  return null;
}

export function skillFindings({ file, content, roots }) {
  const findings = [];

  const lineCount = content.split('\n').length;
  if (lineCount > MAX_LINES) {
    findings.push({ file, rule: 'max-lines', detail: `${lineCount} lines (cap ${MAX_LINES})` });
  }

  for (const rule of FORBIDDEN) {
    if (rule.test(content)) {
      findings.push({ file, rule: 'forbidden-claim', detail: rule.detail });
    }
  }

  for (const token of pathCandidates(content)) {
    if (!resolveCandidate(token, roots)) {
      findings.push({ file, rule: 'missing-path', detail: `${token} does not resolve against the repo` });
    }
  }

  return findings;
}

export async function lintSkillsDir(skillsDir, roots) {
  const entries = await readdir(skillsDir, { withFileTypes: true, recursive: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => join(entry.parentPath, entry.name))
    .sort();

  const findings = [];
  for (const path of files) {
    const content = await readFile(path, 'utf8');
    findings.push(...skillFindings({ file: path.slice(skillsDir.length + 1), content, roots }));
  }
  return findings;
}

const ONE_OFF_SCRIPTS = [
  {
    name: 'content-rows.mjs',
    reason:
      'row-scoring library imported only by content-gate.mjs and semantic-core.mjs, both documented in content-gate.md',
  },
  {
    name: 'prose-rules.mjs',
    reason:
      'duplicate-sentence and prose-quality checks imported only by content-gate.mjs, documented in content-gate.md',
  },
  {
    name: 'content-html.mjs',
    reason: 'HTML-extraction library imported only by content-gate.mjs, documented in content-gate.md',
  },
];

const SCRIPT_FILE = /\.(mjs|cjs)$/;
const TEST_FILE = /\.test\.(mjs|cjs)$/;
const NAMED_SCRIPT_CALL = /scripts\/([\w.-]+\.(?:mjs|cjs))/g;

export function scriptInvokers(scripts) {
  const invokers = new Map();
  for (const [key, command] of Object.entries(scripts)) {
    for (const [, basename] of command.matchAll(NAMED_SCRIPT_CALL)) {
      if (!invokers.has(basename)) invokers.set(basename, new Set());
      invokers.get(basename).add(key);
    }
  }
  return invokers;
}

export function scriptCoverageFindings({ scriptFiles, skillsText, scripts }) {
  const invokers = scriptInvokers(scripts);
  const oneOff = new Set(ONE_OFF_SCRIPTS.map((entry) => entry.name));
  const findings = [];
  for (const file of scriptFiles) {
    if (!SCRIPT_FILE.test(file) || TEST_FILE.test(file)) continue;
    if (oneOff.has(file) || skillsText.includes(file)) continue;
    const invokingKeys = [...(invokers.get(file) ?? [])];
    if (invokingKeys.some((key) => skillsText.includes(key))) continue;
    findings.push({
      file: 'site/scripts',
      rule: 'undocumented-script',
      detail: `${file} is named by no skill, no documented npm script invokes it, and it carries no one-off declaration`,
    });
  }
  return findings;
}

export function gateTestScriptFindings({ scripts, skillsText }) {
  const findings = [];
  for (const key of Object.keys(scripts)) {
    if (!/^(gate|test):/.test(key)) continue;
    if (!skillsText.includes(key)) {
      findings.push({ file: 'package.json', rule: 'undocumented-npm-script', detail: `"${key}" is named by no skill` });
    }
  }
  return findings;
}

export function extractCommandsBlock(agentsMdText) {
  const headingIndex = agentsMdText.indexOf('## Commands');
  if (headingIndex === -1) return null;
  const match = agentsMdText.slice(headingIndex).match(/```([\s\S]*?)```/);
  return match ? match[1] : null;
}

export function commandsScriptNames(commandsBlockText) {
  if (!commandsBlockText) return [];
  const names = [];
  for (const line of commandsBlockText.split('\n')) {
    const match = line.match(/npm run (\S+)/);
    if (match) names.push(match[1]);
  }
  return names;
}

export function agentsCommandsFindings({ agentsMdText, scripts }) {
  const names = commandsScriptNames(extractCommandsBlock(agentsMdText));
  return names
    .filter((name) => !(name in scripts))
    .map((name) => ({
      file: 'AGENTS.md',
      rule: 'missing-npm-script',
      detail: `"npm run ${name}" has no matching script in package.json`,
    }));
}

async function main(skillsDirArg) {
  const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const repoRoot = resolve(siteRoot, '..');
  const skillsDir = isAbsolute(skillsDirArg ?? '') ? skillsDirArg : join(siteRoot, '.agents', 'skills');

  const findings = await lintSkillsDir(skillsDir, [repoRoot, siteRoot]);

  const skillFiles = (await readdir(skillsDir, { recursive: true })).filter((name) => String(name).endsWith('.md'));
  const skillsText = (await Promise.all(skillFiles.map((name) => readFile(join(skillsDir, name), 'utf8')))).join('\n');
  const { scripts } = JSON.parse(await readFile(join(siteRoot, 'package.json'), 'utf8'));
  const scriptFiles = await readdir(join(siteRoot, 'scripts'));
  const agentsMdText = await readFile(join(repoRoot, 'AGENTS.md'), 'utf8');

  findings.push(...gateTestScriptFindings({ scripts, skillsText }));
  findings.push(...scriptCoverageFindings({ scriptFiles, skillsText, scripts }));
  findings.push(...agentsCommandsFindings({ agentsMdText, scripts }));

  for (const finding of findings) console.error(`${finding.file} ${finding.rule} [${finding.detail}]`);
  console.log(
    findings.length === 0 ? `skills: ${skillFiles.length} files clean` : `skills: ${findings.length} findings`
  );
  if (findings.length > 0) process.exitCode = 1;
}

if (import.meta.filename === process.argv[1]) {
  await main(process.argv[2]);
}
