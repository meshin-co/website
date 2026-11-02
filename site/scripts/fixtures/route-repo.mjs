import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';

import { parseBuyerPrompts } from '../semantic-core.mjs';
import { digestOf, freshDigest, seedDispositions, staleEntries } from './route-dispositions.mjs';
import { CORE_TEXT } from './semantic-core-doc.mjs';

export const GIT_ENVIRONMENT = {
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
};
export const FIXTURE_IDENTITY = ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test'];

export const FACTS_TEXT = `{
  "targetQuery": {
    "/": "fractional chief ai officer",
    "/glossary": "ai governance glossary",
    "/glossary/ai-register": "ai register",
    "/blog": "ai governance writing",
    "/blog/existing-post": "existing post query"
  },
  "numbers": [
    "30"
  ]
}
`;

const START_FILES = {
  '.gitignore': 'site/dist/\n',
  'site/content-facts.json': FACTS_TEXT,
  'site/src/data/post/existing-post.md': '---\ntitle: Existing post\n---\nBody of the existing post.\n',
  'site/src/data/glossary/ai-register.md': '---\ntitle: What is an AI register?\nterm: AI register\n---\n',
  'docs/SEMANTIC-CORE.md': CORE_TEXT,
  'audits/phase-4.7/dispositions/existing.json': '[]\n',
};

export const gitIn = (root, ...args) =>
  execFileSync('git', args, { cwd: root, env: GIT_ENVIRONMENT, encoding: 'utf8' });

const put = (root, path, text) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
};

export function makeRepo() {
  const root = mkdtempSync(join(tmpdir(), 'route-repo-'));
  for (const [path, text] of Object.entries(START_FILES)) put(root, path, text);
  const seeded = seedDispositions(root);
  gitIn(root, 'init', '--quiet', '--initial-branch=main');
  gitIn(root, 'add', '--', ...Object.keys(START_FILES), ...seeded);
  gitIn(root, ...FIXTURE_IDENTITY, 'commit', '--quiet', '-m', 'fixture');
  return root;
}

export function snapshotOf(root) {
  const files = new Map();
  const visit = (directory) => {
    for (const name of readdirSync(directory)) {
      const path = join(directory, name);
      const shown = relative(root, path);
      if (shown === '.git' || shown === 'site/dist') continue;
      if (statSync(path).isDirectory()) {
        files.set(`${shown}/`, 'directory');
        visit(path);
      } else files.set(shown, createHash('sha256').update(readFileSync(path)).digest('hex'));
    }
  };
  visit(root);
  return files;
}

export { digestOf };

const GENERATED = ['<!-- semantic-core:begin generated -->', '<!-- semantic-core:end generated -->'];
const REGISTERS = ['<!-- REGISTERS:BEGIN -->', '<!-- REGISTERS:END -->'];
const blockOf = (text, [begin, end]) => text.slice(text.indexOf(begin) + begin.length, text.indexOf(end)).trim();
const splice = (text, [begin, end], block) =>
  `${text.slice(0, text.indexOf(begin) + begin.length)}\n${block}\n${text.slice(text.indexOf(end))}`;
const stems = (directory) =>
  existsSync(directory) ? readdirSync(directory).map((name) => name.replace(/\.md$/, '')) : [];
const ok = { status: 0, stdout: '', stderr: '' };
const failed = (stdout) => ({ status: 1, stdout, stderr: '' });

export function fakeRun(root, { fail = {}, exits = {} } = {}) {
  const read = (path) => readFileSync(join(root, path), 'utf8');
  const write = (path, text) => put(root, path, text);
  const routes = () => [
    '/',
    ...stems(join(root, 'site/src/data/glossary')).map((slug) => `/glossary/${slug}`),
    ...stems(join(root, 'site/src/data/post')).map((slug) => `/blog/${slug}`),
  ];
  const pageOf = (route) => {
    const file = `site/dist/${route === '/' ? 'index' : route.slice(1)}.html`;
    return existsSync(join(root, file)) ? read(file) : undefined;
  };
  const queryOf = (route) => JSON.parse(read('site/content-facts.json')).targetQuery[route] ?? '';
  const layer = () =>
    pageOf('/') === undefined
      ? null
      : routes()
          .map((route) => `| \`${route}\` | ${queryOf(route)} |`)
          .join('\n');
  const registers = () =>
    routes()
      .filter((route) => route.startsWith('/glossary/'))
      .map((route) => `| \`${route}\` |`)
      .join('\n');

  const commands = {
    'npm run build': () => {
      write('site/dist/gate-routes.json', JSON.stringify({ routes: routes() }));
      for (const route of routes())
        write(`site/dist/${route === '/' ? 'index' : route.slice(1)}.html`, `<main>${readIfEntry(route)}</main>`);
      return ok;
    },
    'node scripts/semantic-core.mjs': () => {
      if (layer() === null) return failed('semantic-core: no built html');
      write('docs/SEMANTIC-CORE.md', splice(read('docs/SEMANTIC-CORE.md'), GENERATED, layer()));
      return ok;
    },
    'node scripts/generate-registers.mjs': () => {
      write('docs/SEMANTIC-CORE.md', splice(read('docs/SEMANTIC-CORE.md'), REGISTERS, registers()));
      return ok;
    },
    'node scripts/semantic-core.mjs --check dist': () => {
      const doc = read('docs/SEMANTIC-CORE.md');
      const findings = blockOf(doc, GENERATED) === layer() ? [] : ['doc-drift'];
      for (const prompt of parseBuyerPrompts(doc))
        for (const { text, route } of prompt.passages)
          if (pageOf(route) !== undefined && !pageOf(route).includes(text))
            findings.push(`buyer-prompt-passage-missing ${route}`);
      return findings.length === 0 ? ok : failed(findings.join('\n'));
    },
    'npm run gate:registers': () =>
      blockOf(read('docs/SEMANTIC-CORE.md'), REGISTERS) === registers() ? ok : failed('registers drift'),
    'npm run gate:editorial': () => {
      const stale = staleEntries(root);
      const samples = stale
        .slice(0, 4)
        .map(({ target }) => `    ${target} | the text changed since it was dispositioned`);
      return stale.length === 0
        ? ok
        : failed([`findings: ${stale.length}`, `  stale dispositions (${stale.length}):`, ...samples].join('\n'));
    },
    'node scripts/stale-dispositions.mjs . dist': () => ({
      status: 0,
      stdout: `${JSON.stringify(staleEntries(root))}\n`,
      stderr: '',
    }),
  };

  function readIfEntry(route) {
    const [, collection, slug] = route.split('/');
    const folder = { glossary: 'glossary', blog: 'post' }[collection];
    return folder ? read(`site/src/data/${folder}/${slug}.md`) : 'home';
  }

  const calls = [];
  const counts = new Map();
  const run = (command, args, { cwd }) => {
    const key = [command, ...args].join(' ');
    calls.push({ key, cwd });
    if (cwd !== join(root, 'site')) return { status: 127, stdout: '', stderr: `wrong directory ${cwd}` };
    const seen = (counts.get(key) ?? 0) + 1;
    counts.set(key, seen);
    if (fail[key] && (fail[key].onCall === undefined || fail[key].onCall === seen)) {
      const injected = { ...fail[key] };
      delete injected.onCall;
      return { status: 1, stdout: '', stderr: '', ...injected };
    }
    const prettier = /^npx prettier --write (\S+(?: \S+)*)$/.exec(key);
    if (prettier) {
      for (const path of prettier[1].split(' ')) write(`site/${path}`, read(`site/${path}`).replace(/[ \t]+$/gm, ''));
      return ok;
    }
    const digest = /^node scripts\/disposition-digest\.mjs \. dist (\S+)$/.exec(key);
    if (digest) {
      const printed = freshDigest(root, digest[1]);
      return printed === null
        ? failed(`no editorial row names ${digest[1]}`)
        : { status: 0, stdout: `${printed}\n`, stderr: '' };
    }
    const gate = /^npm run (gate:(?:content|human|machine))$/.exec(key);
    if (gate) return { status: exits[gate[1]] ?? 0, stdout: '', stderr: '' };
    return commands[key]?.() ?? { status: 127, stdout: '', stderr: `unexpected command ${key}` };
  };
  run.calls = calls;
  return run;
}
