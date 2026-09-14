import { spawn } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = resolve(HERE, '..');
const REPO = resolve(SITE, '..');
const FIXTURES = join(SITE, 'tests', 'guard-mutations', 'fixtures');
const LIVE_POST_TARGET = 13;
const GATES = ['budget', 'jsonld', 'content-gate'];
const CHECKS = ['semantic-title'];

export const FAMILIES = [
  {
    id: 'faq-question-length',
    kind: 'build',
    fixture: 'faq-question-too-long.md',
    plant: 'src/data/faq',
    tokens: ['question: must be 98 characters or fewer'],
  },
  {
    id: 'og-title-length',
    kind: 'build',
    fixture: 'post-title-too-long.md',
    plant: 'src/data/post',
    tokens: ['title: must be 98 characters or fewer'],
  },
  {
    id: 'faq-missing-updated-date',
    kind: 'build',
    fixture: 'faq-missing-updated-date.md',
    plant: 'src/data/faq',
    tokens: ['updatedDate: Required'],
  },
  {
    id: 'post-unknown-tag',
    kind: 'build',
    fixture: 'post-unknown-tag.md',
    plant: 'src/data/post',
    tokens: ['tags.0: Invalid option'],
  },
  {
    id: 'content-banned-phrase',
    kind: 'build-then-gate',
    fixture: 'post-banned-phrase.md',
    plant: 'src/data/post',
    gate: 'content-gate',
    tokens: ['banned-phrase [leverage]'],
  },
  { id: 'budget-page-cap', kind: 'gate', gate: 'budget', tokens: ['OVER BUDGET / page'] },
  { id: 'jsonld-fail-closed', kind: 'gate', gate: 'jsonld', tokens: ['matches no known jsonld route family'] },
  { id: 'semantic-title-pattern', kind: 'pure', check: 'semantic-title' },
  { id: 'machine-feed-coverage', kind: 'unit-covered' },
  { id: 'pagination-page-2', kind: 'pagination', fixture: 'live-post.md', slow: true },
];

const KINDS = ['build', 'build-then-gate', 'gate', 'pure', 'pagination', 'unit-covered'];
const REQUIREMENTS = {
  build: ['fixture', 'plant', 'tokens'],
  'build-then-gate': ['fixture', 'plant', 'tokens', 'gate'],
  gate: ['gate', 'tokens'],
  pure: ['check'],
  pagination: ['fixture'],
  'unit-covered': [],
};

const invalid = (field, value) =>
  field === 'tokens'
    ? !Array.isArray(value) || value.length === 0 || value.some((token) => typeof token !== 'string')
    : typeof value !== 'string' || value.length === 0;

export function manifestFamilies(manifest) {
  if (!Array.isArray(manifest) || manifest.length === 0) throw new Error('mutation smoke: empty family manifest');
  const seen = new Set();
  return manifest.map((entry) => {
    const id = entry?.id;
    if (typeof id !== 'string' || id.length === 0) throw new Error('mutation smoke: family without an id');
    if (seen.has(id)) throw new Error(`mutation smoke: duplicate family id ${id}`);
    seen.add(id);
    if (!KINDS.includes(entry.kind)) throw new Error(`mutation smoke: family ${id} has unknown kind ${entry.kind}`);
    for (const field of REQUIREMENTS[entry.kind]) {
      if (invalid(field, entry[field]))
        throw new Error(`mutation smoke: family ${id} (${entry.kind}) is missing ${field}`);
    }
    if ('gate' in entry && !GATES.includes(entry.gate))
      throw new Error(`mutation smoke: family ${id} has unknown gate ${entry.gate}`);
    if ('check' in entry && !CHECKS.includes(entry.check))
      throw new Error(`mutation smoke: family ${id} has unknown check ${entry.check}`);
    return { ...entry };
  });
}

const ANSI_SEQUENCE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

function flattenOutput(output) {
  return String(output).replace(ANSI_SEQUENCE, '').replace(/\s+/g, ' ');
}

export function expectedFailure(run, tokens) {
  if (!Number.isInteger(run.code) || run.code === 0) return { ok: false, reason: 'guard exited zero' };
  const flattened = flattenOutput(run.output);
  for (const token of tokens) {
    if (!flattened.includes(token)) {
      return { ok: false, reason: `output did not name "${token}": ...${flattened.slice(-300)}` };
    }
  }
  return { ok: true, reason: `non-zero exit naming ${tokens.map((token) => `"${token}"`).join(' ')}` };
}

export function parseArgs(argv) {
  for (const arg of argv) {
    if (arg !== '--fast') throw new Error(`mutation smoke: unknown flag ${arg}`);
  }
  return { fast: argv.includes('--fast') };
}

function run(command, args, cwd) {
  return new Promise((resolveRun) => {
    const child = spawn(command, args, { cwd, env: process.env });
    let output = '';
    const collect = (chunk) => {
      output += chunk;
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    child.on('error', (error) => resolveRun({ code: -1, output: `${output}\n${error.message}` }));
    child.on('close', (code) => resolveRun({ code: code ?? null, output }));
  });
}

const build = (cwd) => run('npm', ['run', 'build'], cwd);

async function plantFixture(copySite, entry) {
  const target = join(copySite, entry.plant, entry.fixture);
  await copyFile(join(FIXTURES, entry.fixture), target);
  return target;
}

async function runPlantedFamily(copySite, entry, gated) {
  const planted = await plantFixture(copySite, entry);
  try {
    const built = await build(copySite);
    if (!gated) return expectedFailure(built, entry.tokens);
    if (built.code !== 0)
      return { ok: false, reason: `planted specimen failed the build itself: ${built.output.slice(-400)}` };
    return expectedFailure(await run('node', ['scripts/content-gate.mjs', 'dist'], copySite), entry.tokens);
  } finally {
    await rm(planted, { force: true });
  }
}

async function runGateFamily(copySite, entry, work) {
  if (entry.gate === 'budget') {
    const dist = join(work, 'budget-dist');
    await mkdir(dist, { recursive: true });
    await writeFile(
      join(dist, 'index.html'),
      '<!doctype html><html><head></head><body>mutation smoke budget specimen</body></html>'
    );
    const budgets = join(work, 'budgets.json');
    await writeFile(budgets, `${JSON.stringify({ js: 10240, css: 20480, page: 1 }, null, 2)}\n`);
    return expectedFailure(await run('node', ['scripts/gate.mjs', dist, budgets], copySite), entry.tokens);
  }
  const dist = join(work, 'jsonld-dist');
  await mkdir(join(dist, 'unknown-route'), { recursive: true });
  await writeFile(join(dist, 'unknown-route/index.html'), '<!doctype html><html><head></head><body>x</body></html>');
  return expectedFailure(await run('node', ['scripts/jsonld-gate.mjs', dist], copySite), entry.tokens);
}

async function runPureFamily(copySite) {
  const { titleFindings } = await import(pathToFileURL(join(copySite, 'scripts/semantic-core.mjs')).href);
  const failing = titleFindings([{ route: '/blog', title: 'Writing' }]);
  const passing = titleFindings([{ route: '/blog', title: 'Writing — meshin.co' }]);
  if (!failing.some((finding) => finding.rule === 'title-suffix'))
    return { ok: false, reason: 'titleFindings stayed green on a wrong-suffix title' };
  if (passing.length > 0) return { ok: false, reason: `titleFindings flagged a compliant title: ${passing[0].rule}` };
  return { ok: true, reason: 'title-suffix finding on wrong suffix, none on compliant title' };
}

const canonicalHref = (html) => /<link[^>]*canonical[^>]*>/.exec(html)?.[0]?.match(/href="([^"]+)"/)?.[1] ?? '';
const robotsMeta = (html) => /<meta[^>]*robots[^>]*>/.exec(html)?.[0] ?? '';

async function paginationArtifacts(copySite) {
  const page2Html = await readFile(join(copySite, 'dist/blog/page/2/index.html'), 'utf8').catch(() => null);
  if (page2Html === null) throw new Error('dist/blog/page/2/index.html was not built');
  const robots = robotsMeta(page2Html);
  if (!/noindex/.test(robots) || !/follow/.test(robots))
    throw new Error(`page 2 robots is not noindex, follow: ${robots}`);
  if (!canonicalHref(page2Html).endsWith('/blog/page/2'))
    throw new Error(`page 2 canonical is not self: ${canonicalHref(page2Html)}`);
  const blogHtml = await readFile(join(copySite, 'dist/blog/index.html'), 'utf8');
  if (/noindex/.test(robotsMeta(blogHtml))) throw new Error('page 1 carries noindex');
  if (!/\/blog$/.test(canonicalHref(blogHtml)))
    throw new Error(`page 1 canonical is not the bare route: ${canonicalHref(blogHtml)}`);
  const sitemap = await readFile(join(copySite, 'dist/sitemap-0.xml'), 'utf8');
  if (sitemap.includes('/blog/page/')) throw new Error('sitemap lists a paginated route');
  if (!/<loc>[^<]*\/blog<\/loc>/.test(sitemap)) throw new Error('sitemap omits /blog');
  return { robots, canonical: canonicalHref(page2Html) };
}

async function livePostCount(copySite) {
  const dir = join(copySite, 'src/data/post');
  let live = 0;
  for (const name of await readdir(dir)) {
    if (!/\.(md|mdx)$/.test(name)) continue;
    const frontmatter = (await readFile(join(dir, name), 'utf8')).split(/^---$/m)[1] ?? '';
    if (!/^draft:\s*true\s*$/m.test(frontmatter)) live += 1;
  }
  return live;
}

async function runPaginationFamily(copySite, entry) {
  const live = await livePostCount(copySite);
  const clones = Math.max(0, LIVE_POST_TARGET - live);
  const planted = [];
  for (let index = 1; index <= clones; index += 1) {
    const target = join(copySite, 'src/data/post', `mutation-live-post-${String(index).padStart(2, '0')}.md`);
    await copyFile(join(FIXTURES, entry.fixture), target);
    planted.push(target);
  }
  try {
    const built = await build(copySite);
    if (built.code !== 0)
      return { ok: false, reason: `build with ${clones} live clones failed: ${built.output.slice(-400)}` };
    const proof = await paginationArtifacts(copySite);
    if (
      clones > 0 &&
      !(await readFile(join(copySite, 'dist/blog/page/2/index.html'), 'utf8')).includes('mutation-live-post')
    )
      return { ok: false, reason: 'page 2 lists no planted live post' };
    return {
      ok: true,
      reason: `${live} live + ${clones} clones; robots ${proof.robots}, canonical ${proof.canonical}`,
    };
  } finally {
    await Promise.all(planted.map((path) => rm(path, { force: true })));
  }
}

async function prepareCopy(work) {
  await run('rsync', [
    '-a',
    '--exclude=node_modules',
    '--exclude=.astro',
    '--exclude=dist',
    '--exclude=.og-cache',
    '--exclude=test-results',
    '--exclude=.git',
    `${REPO}/`,
    join(work, 'repo/'),
  ]);
  const copySite = join(work, 'repo/site');
  await symlink(join(SITE, 'node_modules'), join(copySite, 'node_modules'));
  return copySite;
}

const EXECUTORS = {
  build: (copySite, entry) => runPlantedFamily(copySite, entry, false),
  'build-then-gate': (copySite, entry) => runPlantedFamily(copySite, entry, true),
  gate: (copySite, entry, work) => runGateFamily(copySite, entry, work),
  pure: (copySite) => runPureFamily(copySite),
  pagination: (copySite, entry) => runPaginationFamily(copySite, entry),
  'unit-covered': () => ({
    ok: true,
    reason: 'proven by unit tests (machine.test.mjs feedCoverageFailures); no repo-copy run',
  }),
};

async function main() {
  const { fast } = parseArgs(process.argv.slice(2));
  const work = await mkdtemp(join(tmpdir(), 'mutation-smoke-'));
  const results = [];
  const started = Date.now();

  try {
    const copySite = await prepareCopy(work);
    const baseline = await build(copySite);
    results.push({
      id: 'baseline-green-copy',
      ok: baseline.code === 0,
      reason: baseline.code === 0 ? 'pristine copy builds green' : baseline.output.slice(-400),
    });
    if (baseline.code === 0) {
      for (const entry of manifestFamilies(FAMILIES)) {
        const familyStart = Date.now();
        let outcome;
        if (fast && entry.slow) outcome = { ok: true, reason: 'skipped: --fast (pagination proof needs a full build)' };
        else outcome = await EXECUTORS[entry.kind](copySite, entry, work);
        results.push({ id: entry.id, ...outcome, seconds: Math.round((Date.now() - familyStart) / 1000) });
      }
    }
  } catch (error) {
    results.push({ id: 'smoke-harness', ok: false, reason: error.message });
  }

  for (const result of results) console.log(`${result.ok ? 'ok  ' : 'FAIL'} ${result.id}: ${result.reason}`);
  const failed = results.filter((result) => !result.ok);
  console.log(
    `mutation smoke: ${results.length - failed.length}/${results.length} green in ${Math.round((Date.now() - started) / 1000)}s${fast ? ' [fast]' : ''}`
  );
  if (failed.length > 0 || process.env.MUTATION_SMOKE_KEEP) console.log(`workdir kept for inspection: ${work}`);
  else await rm(work, { recursive: true, force: true });
  process.exitCode = failed.length > 0 ? 1 : 0;
}

if (import.meta.filename === process.argv[1]) {
  await main();
}
