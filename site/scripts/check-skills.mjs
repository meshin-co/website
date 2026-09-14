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

export function pathCandidates(text) {
  const spans = [...text.matchAll(/`([^`\n]+)`/g)].map(([, span]) => span.trim());
  const bare = [...text.matchAll(/(?<![\w`@./])([\w@.-]+(?:\/[\w@.-]+)+)/g)].map(([token]) => token);
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

async function main(skillsDirArg) {
  const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const repoRoot = resolve(siteRoot, '..');
  const skillsDir = isAbsolute(skillsDirArg ?? '') ? skillsDirArg : join(siteRoot, '.agents', 'skills');

  const findings = await lintSkillsDir(skillsDir, [repoRoot, siteRoot]);
  for (const finding of findings) console.error(`${finding.file} ${finding.rule} [${finding.detail}]`);

  const fileCount = (await readdir(skillsDir, { recursive: true })).filter((name) =>
    String(name).endsWith('.md')
  ).length;
  console.log(findings.length === 0 ? `skills: ${fileCount} files clean` : `skills: ${findings.length} findings`);
  if (findings.length > 0) process.exitCode = 1;
}

if (import.meta.filename === process.argv[1]) {
  await main(process.argv[2]);
}
