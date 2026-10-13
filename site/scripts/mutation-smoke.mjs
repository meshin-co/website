import { spawn } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { SPECIMENS, assertStandaloneRepo, flatten, proveWithSpecimen } from './mutation-specimens.mjs';
import { canonicalHref, robotsContent, robotsMeta, tagArchiveFindings } from './pagination-markup.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = resolve(HERE, '..');
const REPO = resolve(SITE, '..');
const FIXTURES = join(SITE, 'tests', 'guard-mutations', 'fixtures');
const LIVE_POST_TARGET = 13;
const GATES = ['budget', 'jsonld', 'jsonld-properties', 'content-gate', 'docs', 'external'];
const CHECKS = ['semantic-title'];
const SCOPES = ['category', 'tag'];

export const FAMILIES = [
  {
    id: 'faq-question-length',
    kind: 'build',
    proves: 'build',
    fixture: 'faq-question-too-long.md',
    plant: 'src/data/faq',
    tokens: ['question: must be 98 characters or fewer'],
  },
  {
    id: 'og-title-length',
    kind: 'build',
    proves: 'build',
    fixture: 'post-title-too-long.md',
    plant: 'src/data/post',
    tokens: ['title: must be 98 characters or fewer'],
  },
  {
    id: 'faq-missing-updated-date',
    kind: 'build',
    proves: 'build',
    fixture: 'faq-missing-updated-date.md',
    plant: 'src/data/faq',
    tokens: ['updatedDate: Required'],
  },
  {
    id: 'post-unknown-tag',
    kind: 'build',
    proves: 'build',
    fixture: 'post-unknown-tag.md',
    plant: 'src/data/post',
    tokens: ['tags.0: Invalid option'],
  },
  {
    id: 'content-banned-phrase',
    kind: 'build-then-gate',
    proves: 'gate:content',
    fixture: 'post-banned-phrase.md',
    plant: 'src/data/post',
    gate: 'content-gate',
    tokens: ['banned-phrase [leverage]'],
  },
  { id: 'budget-page-cap', kind: 'gate', proves: 'build', gate: 'budget', tokens: ['OVER BUDGET / page'] },
  { id: 'docs-dead-path', kind: 'gate', proves: 'gate:docs', gate: 'docs', tokens: ['dead-path'] },
  { id: 'record-marker-must-be-exact', kind: 'specimen', specimen: 'docsRecord' },
  { id: 'record-marker-never-exempts-the-index', kind: 'specimen', specimen: 'docsIndexMarked' },
  { id: 'record-marker-never-exempts-a-live-doc', kind: 'specimen', specimen: 'docsRecordOutsideCorpus' },
  { id: 'citation-of-an-ignored-file-is-not-held', kind: 'specimen', specimen: 'docsIgnoredPath' },
  { id: 'archived-change-is-still-checked-for-citations', kind: 'specimen', specimen: 'docsArchiveDeadPath' },
  {
    id: 'external-link-rel',
    kind: 'gate',
    proves: 'gate:external',
    gate: 'external',
    tokens: ['is missing nofollow'],
  },
  {
    id: 'jsonld-fail-closed',
    kind: 'gate',
    proves: 'gate:jsonld',
    gate: 'jsonld',
    tokens: ['matches no known jsonld route family'],
  },
  {
    id: 'jsonld-property-completeness',
    kind: 'gate',
    proves: 'gate:jsonld',
    gate: 'jsonld-properties',
    tokens: ['is missing required property logo'],
  },
  {
    id: 'faq-description-floor',
    kind: 'build',
    proves: 'build',
    fixture: 'faq-description-too-short.md',
    plant: 'src/data/faq',
    tokens: ['description: must be 120 characters or more'],
  },
  { id: 'semantic-title-pattern', kind: 'pure', proves: 'gate:content', check: 'semantic-title' },
  { id: 'machine-feed-coverage', kind: 'specimen', specimen: 'machine' },
  { id: 'canonical-names-a-built-file', kind: 'specimen', specimen: 'canonical' },
  { id: 'gate-wiring-removed-from-ci', kind: 'specimen', specimen: 'wiringRemoved' },
  { id: 'harness-gate-waived-by-a-sentence', kind: 'specimen', specimen: 'gateWaivedByProse' },
  { id: 'pending-specimen-names-a-missing-phase', kind: 'specimen', specimen: 'pendingUnknownPhase' },
  { id: 'pending-specimen-phase-already-done', kind: 'specimen', specimen: 'pendingPhaseDone' },
  { id: 'brand-literal-typed-into-a-module', kind: 'specimen', specimen: 'brand' },
  { id: 'editorial-row-without-a-disposition', kind: 'specimen', specimen: 'editorialRowUnreviewed' },
  { id: 'route-removed-without-an-explanation', kind: 'specimen', specimen: 'routesShrink' },
  { id: 'html-duplicate-id', kind: 'specimen', specimen: 'html' },
  { id: 'link-to-a-missing-route', kind: 'specimen', specimen: 'links' },
  { id: 'route-nothing-links-to', kind: 'specimen', specimen: 'orphans' },
  { id: 'search-shard-over-budget', kind: 'specimen', specimen: 'search' },
  { id: 'skill-names-a-missing-script', kind: 'specimen', specimen: 'skills' },
  { id: 'generated-report-without-provenance', kind: 'specimen', specimen: 'evidence' },
  { id: 'report-revision-that-is-not-a-commit', kind: 'specimen', specimen: 'evidenceRevisionNotACommit' },
  { id: 'report-prose-provenance-off-the-allow-list', kind: 'specimen', specimen: 'evidenceProseOffAllowList' },
  { id: 'spec-requirement-without-a-scenario', kind: 'specimen', specimen: 'specScenarioMissing' },
  { id: 'spec-validator-that-checked-nothing', kind: 'specimen', specimen: 'specValidatorSawNothing' },
  { id: 'spec-the-validator-never-reads', kind: 'specimen', specimen: 'specHiddenFromValidator' },
  { id: 'spec-requirement-renamed-behind-the-census', kind: 'specimen', specimen: 'specRequirementRenamed' },
  { id: 'spec-deleted-but-left-in-the-census', kind: 'specimen', specimen: 'specCapabilityDeleted' },
  { id: 'spec-index-edited-by-hand', kind: 'specimen', specimen: 'specIndexHandEdited' },
  { id: 'spec-citing-a-locked-row-that-does-not-exist', kind: 'specimen', specimen: 'specLockedRowMissing' },
  { id: 'change-named-without-a-number', kind: 'specimen', specimen: 'changeWithoutNumber' },
  { id: 'change-numbered-below-ten', kind: 'specimen', specimen: 'changeBelowTen' },
  { id: 'change-number-already-taken', kind: 'specimen', specimen: 'changeNumberTaken' },
  { id: 'change-without-a-task-list', kind: 'specimen', specimen: 'changeWithoutTasks' },
  { id: 'active-change-that-skips-spec-validation', kind: 'specimen', specimen: 'changeSkippingSpecs' },
  { id: 'two-changes-in-flight-at-once', kind: 'specimen', specimen: 'changesInFlight' },
  { id: 'change-parked-on-a-sentence', kind: 'specimen', specimen: 'changeParkedWithoutAGapRow' },
  {
    id: 'change-parked-on-a-gap-row-that-does-not-exist',
    kind: 'specimen',
    specimen: 'changeParkedOnAGapRowThatDoesNotExist',
  },
  { id: 'change-owing-a-calibration-gate', kind: 'specimen', specimen: 'changeOwingCalibration' },
  { id: 'registers-block-drifted', kind: 'specimen', specimen: 'registers' },
  { id: 'axe-violation-in-a-real-browser', kind: 'specimen', specimen: 'visualAxe', slow: true },
  { id: 'controlled-word-on-a-page', kind: 'specimen', specimen: 'humanControlledWord' },
  { id: 'sentence-one-word-over-the-length-ceiling', kind: 'specimen', specimen: 'humanSentenceOverCeiling' },
  { id: 'long-sentences-one-over-the-share-limit', kind: 'specimen', specimen: 'humanLongSentencesOverShare' },
  { id: 'long-sentences-one-over-the-cap-on-a-long-page', kind: 'specimen', specimen: 'humanLongSentencesOverCap' },
  { id: 'lighthouse-shard-unlabelled-image', kind: 'specimen', specimen: 'lighthouseShard', slow: true },
  { id: 'lighthouse-both-factors-unlabelled-image', kind: 'specimen', specimen: 'lighthouseBothFactors', slow: true },
  { id: 'noindex-page-cannot-waive-its-seo', kind: 'specimen', specimen: 'lighthouseSelfWaivingNoindex', slow: true },
  { id: 'pagination-page-2', kind: 'pagination', proves: 'build', fixture: 'live-post.md', slow: true },
  {
    id: 'category-pagination-page-2',
    kind: 'pagination',
    proves: 'build',
    fixture: 'live-post.md',
    scope: 'category',
    slow: true,
  },
  {
    id: 'tag-pagination-page-2',
    kind: 'pagination',
    proves: 'build',
    fixture: 'live-post.md',
    scope: 'tag',
    slow: true,
  },
];

const KINDS = ['build', 'build-then-gate', 'gate', 'pure', 'pagination', 'specimen'];
const REQUIREMENTS = {
  build: ['proves', 'fixture', 'plant', 'tokens'],
  'build-then-gate': ['proves', 'fixture', 'plant', 'tokens', 'gate'],
  gate: ['proves', 'gate', 'tokens'],
  pure: ['proves', 'check'],
  pagination: ['proves', 'fixture'],
  specimen: ['specimen'],
};

export const provesOf = (entry) => (entry.kind === 'specimen' ? SPECIMENS[entry.specimen]?.gate : entry.proves);

export function unprovenGates(scripts, families, pending) {
  const proven = new Set(families.map(provesOf));
  const waiting = new Set(pending.map((entry) => entry.gate));
  return Object.keys(scripts)
    .filter((name) => name.startsWith('gate:'))
    .filter((gate) => !proven.has(gate) && !waiting.has(gate))
    .sort();
}

export function stalePending(scripts, families, pending) {
  const proven = new Set(families.map(provesOf));
  return pending
    .filter((entry) => !(entry.gate in scripts) || proven.has(entry.gate))
    .map((entry) => entry.gate)
    .sort();
}

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
    if ('scope' in entry && !SCOPES.includes(entry.scope))
      throw new Error(`mutation smoke: family ${id} has unknown scope ${entry.scope}`);
    if (entry.kind === 'specimen' && !Object.hasOwn(SPECIMENS, entry.specimen))
      throw new Error(`mutation smoke: family ${id} has unknown specimen ${entry.specimen}`);
    return { ...entry };
  });
}

export function expectedFailure(run, tokens) {
  if (!Number.isInteger(run.code) || run.code === 0) return { ok: false, reason: 'guard exited zero' };
  const flattened = flatten(run.output);
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

const pristineDist = (work) => `${join(work, 'pristine-dist')}/`;
const snapshotDist = (copySite, work) =>
  run('rsync', ['-a', '--delete', `${join(copySite, 'dist')}/`, pristineDist(work)]);
const restoreDist = (copySite, work) =>
  run('rsync', ['-a', '--delete', pristineDist(work), `${join(copySite, 'dist')}/`]);

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
  if (entry.gate === 'external') {
    const dist = join(work, 'external-dist');
    await mkdir(dist, { recursive: true });
    await writeFile(
      join(dist, 'index.html'),
      '<!doctype html><html><body><a href="https://iso.org/standard/42001" rel="noopener">ISO</a></body></html>'
    );
    return expectedFailure(await run('node', ['scripts/run-external-links.mjs', dist], copySite), entry.tokens);
  }
  if (entry.gate === 'docs') {
    const repo = join(work, 'docs-repo');
    await mkdir(join(repo, 'docs/plan/reference'), { recursive: true });
    await mkdir(join(repo, 'site/.agents/skills'), { recursive: true });
    await writeFile(
      join(repo, 'AGENTS.md'),
      'The build reads `docs/this-file-does-not-exist.md` before anything else.\n'
    );
    await writeFile(join(repo, 'docs/plan/reference/locked-decisions.md'), '| L1 | Row | Decision |\n');
    await writeFile(join(repo, 'site/package.json'), `${JSON.stringify({ scripts: {} }, null, 2)}\n`);
    return expectedFailure(await run('node', ['scripts/run-docs-gate.mjs', repo], copySite), entry.tokens);
  }
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
  if (entry.gate === 'jsonld-properties') {
    const dist = join(work, 'jsonld-properties-dist');
    await mkdir(dist, { recursive: true });
    const graph = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          '@id': 'https://example.com/#org',
          name: 'Test',
          url: 'https://example.com/',
          sameAs: [],
          contactPoint: {},
        },
        {
          '@type': 'Person',
          '@id': 'https://example.com/#person',
          name: 'Test',
          jobTitle: 'x',
          url: 'https://example.com/about',
          sameAs: [],
          knowsAbout: [],
        },
        {
          '@type': 'WebSite',
          '@id': 'https://example.com/#website',
          url: 'https://example.com/',
          name: 'Test',
          publisher: {},
          potentialAction: {},
        },
      ],
    };
    await writeFile(
      join(dist, 'index.html'),
      `<!doctype html><html><head><script type="application/ld+json">${JSON.stringify(graph)}</script></head><body>x</body></html>`
    );
    return expectedFailure(await run('node', ['scripts/jsonld-gate.mjs', dist], copySite), entry.tokens);
  }
  const dist = join(work, 'jsonld-dist');
  await mkdir(dist, { recursive: true });
  await writeFile(join(dist, 'unknown-route.html'), '<!doctype html><html><head></head><body>x</body></html>');
  return expectedFailure(await run('node', ['scripts/jsonld-gate.mjs', dist], copySite), entry.tokens);
}

async function runPureFamily(copySite) {
  const { titleFindings } = await import(pathToFileURL(join(copySite, 'scripts/semantic-core.mjs')).href);
  const failing = titleFindings([{ route: '/blog', title: 'Writing' }]);
  const { brandFromDisk, titleSuffix } = await import(pathToFileURL(join(copySite, 'src/utils/brand.mjs')).href);
  const suffix = titleSuffix(brandFromDisk(join(copySite, 'src/config.yaml')));
  const passing = titleFindings([{ route: '/blog', title: `Writing${suffix}` }]);
  if (!failing.some((finding) => finding.rule === 'title-suffix'))
    return { ok: false, reason: 'titleFindings stayed green on a wrong-suffix title' };
  if (passing.length > 0) return { ok: false, reason: `titleFindings flagged a compliant title: ${passing[0].rule}` };
  return { ok: true, reason: 'title-suffix finding on wrong suffix, none on compliant title' };
}

async function paginationArtifacts(copySite) {
  const page2Html = await readFile(join(copySite, 'dist/blog/page/2.html'), 'utf8').catch(() => null);
  if (page2Html === null) throw new Error('dist/blog/page/2.html was not built');
  const robots = robotsMeta(page2Html);
  if (!/noindex/.test(robots) || !/follow/.test(robots))
    throw new Error(`page 2 robots is not noindex, follow: ${robots}`);
  if (!canonicalHref(page2Html).endsWith('/blog/page/2'))
    throw new Error(`page 2 canonical is not self: ${canonicalHref(page2Html)}`);
  const blogHtml = await readFile(join(copySite, 'dist/blog.html'), 'utf8');
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

async function fixtureCategory(entry) {
  const raw = await readFile(join(FIXTURES, entry.fixture), 'utf8');
  const frontmatter = raw.split(/^---$/m)[1] ?? '';
  const match = /^category:\s*(\S+)\s*$/m.exec(frontmatter);
  if (!match) throw new Error(`mutation smoke: fixture ${entry.fixture} has no category for category-pagination`);
  return match[1];
}

async function livePostCountByCategory(copySite, category) {
  const dir = join(copySite, 'src/data/post');
  let live = 0;
  for (const name of await readdir(dir)) {
    if (!/\.(md|mdx)$/.test(name)) continue;
    const frontmatter = (await readFile(join(dir, name), 'utf8')).split(/^---$/m)[1] ?? '';
    if (/^draft:\s*true\s*$/m.test(frontmatter)) continue;
    if (new RegExp(`^category:\\s*${category}\\s*$`, 'm').test(frontmatter)) live += 1;
  }
  return live;
}

async function categoryPaginationArtifacts(copySite, category) {
  const page2Path = `dist/blog/category/${category}/page/2.html`;
  const page2Html = await readFile(join(copySite, page2Path), 'utf8').catch(() => null);
  if (page2Html === null) throw new Error(`${page2Path} was not built`);
  const robots = robotsMeta(page2Html);
  if (!/noindex/.test(robots) || !/follow/.test(robots))
    throw new Error(`category page 2 robots is not noindex, follow: ${robots}`);
  if (!canonicalHref(page2Html).endsWith(`/blog/category/${category}/page/2`))
    throw new Error(`category page 2 canonical is not self: ${canonicalHref(page2Html)}`);
  const page1Html = await readFile(join(copySite, `dist/blog/category/${category}.html`), 'utf8');
  if (/noindex/.test(robotsMeta(page1Html))) throw new Error('category page 1 carries noindex');
  if (!canonicalHref(page1Html).endsWith(`/blog/category/${category}`))
    throw new Error(`category page 1 canonical is not the bare route: ${canonicalHref(page1Html)}`);
  return { robots, canonical: canonicalHref(page2Html) };
}

async function runCategoryPaginationFamily(copySite, entry) {
  const category = await fixtureCategory(entry);
  const live = await livePostCountByCategory(copySite, category);
  const clones = Math.max(0, LIVE_POST_TARGET - live);
  const planted = [];
  for (let index = 1; index <= clones; index += 1) {
    const target = join(copySite, 'src/data/post', `mutation-category-post-${String(index).padStart(2, '0')}.md`);
    await copyFile(join(FIXTURES, entry.fixture), target);
    planted.push(target);
  }
  try {
    const built = await build(copySite);
    if (built.code !== 0)
      return { ok: false, reason: `build with ${clones} category clones failed: ${built.output.slice(-400)}` };
    const proof = await categoryPaginationArtifacts(copySite, category);
    if (
      clones > 0 &&
      !(await readFile(join(copySite, `dist/blog/category/${category}/page/2.html`), 'utf8')).includes(
        'mutation-category-post'
      )
    )
      return { ok: false, reason: 'category page 2 lists no planted live post' };
    return {
      ok: true,
      reason: `${category}: ${live} live + ${clones} clones; robots ${proof.robots}, canonical ${proof.canonical}`,
    };
  } finally {
    await Promise.all(planted.map((path) => rm(path, { force: true })));
  }
}

async function fixtureTag(entry) {
  const frontmatter = (await readFile(join(FIXTURES, entry.fixture), 'utf8')).split(/^---$/m)[1] ?? '';
  const match = /^tags:\s*\n\s+-\s+(\S+)\s*$/m.exec(frontmatter);
  if (!match) throw new Error(`mutation smoke: fixture ${entry.fixture} has no tag for tag-pagination`);
  return match[1];
}

async function runTagPaginationFamily(copySite, entry) {
  const tag = await fixtureTag(entry);
  const route = `/blog/tag/${tag}`;
  const planted = [];
  for (let index = 1; index <= LIVE_POST_TARGET; index += 1) {
    const target = join(copySite, 'src/data/post', `mutation-tag-post-${String(index).padStart(2, '0')}.md`);
    await copyFile(join(FIXTURES, entry.fixture), target);
    planted.push(target);
  }
  try {
    const built = await build(copySite);
    if (built.code !== 0)
      return { ok: false, reason: `build with ${planted.length} tag clones failed: ${built.output.slice(-400)}` };
    const read = (file) => readFile(join(copySite, 'dist', file), 'utf8').catch(() => '');
    const page2Html = await read(`${route}/page/2.html`);
    const problems = [
      ...tagArchiveFindings({
        route,
        page1Html: await read(`${route}.html`),
        page2Html,
        hasPage3: (await read(`${route}/page/3.html`)) !== '',
        sitemap: await read('sitemap-0.xml'),
      }),
      ...(page2Html.includes('mutation-tag-post') ? [] : ['tag page 2 lists no planted live post']),
    ];
    if (problems.length > 0) return { ok: false, reason: problems.join('; ') };
    return {
      ok: true,
      reason: `${tag}: ${planted.length} clones; robots ${robotsContent(page2Html)}, canonical ${canonicalHref(page2Html)}`,
    };
  } finally {
    await Promise.all(planted.map((path) => rm(path, { force: true })));
  }
}

async function runBlogPaginationFamily(copySite, entry) {
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
    if (clones > 0 && !(await readFile(join(copySite, 'dist/blog/page/2.html'), 'utf8')).includes('mutation-live-post'))
      return { ok: false, reason: 'page 2 lists no planted live post' };
    return {
      ok: true,
      reason: `${live} live + ${clones} clones; robots ${proof.robots}, canonical ${proof.canonical}`,
    };
  } finally {
    await Promise.all(planted.map((path) => rm(path, { force: true })));
  }
}

const PAGINATION_RUNNERS = { category: runCategoryPaginationFamily, tag: runTagPaginationFamily };

async function runPaginationFamily(copySite, entry) {
  return (PAGINATION_RUNNERS[entry.scope] ?? runBlogPaginationFamily)(copySite, entry);
}

async function prepareCopy(work) {
  await run('rsync', [
    '-a',
    '--exclude=node_modules',
    '--exclude=.astro',
    '--exclude=dist',
    '--exclude=.og-cache',
    '--exclude=test-results',
    `${REPO}/`,
    join(work, 'repo/'),
  ]);
  const copySite = join(work, 'repo/site');
  await symlink(join(SITE, 'node_modules'), join(copySite, 'node_modules'));
  assertStandaloneRepo(copySite);
  return copySite;
}

const EXECUTORS = {
  build: (copySite, entry) => runPlantedFamily(copySite, entry, false),
  'build-then-gate': (copySite, entry) => runPlantedFamily(copySite, entry, true),
  gate: (copySite, entry, work) => runGateFamily(copySite, entry, work),
  pure: (copySite) => runPureFamily(copySite),
  pagination: (copySite, entry) => runPaginationFamily(copySite, entry),
  specimen: async (copySite, entry, work) => {
    await restoreDist(copySite, work);
    return proveWithSpecimen(SPECIMENS[entry.specimen], { copySite, run });
  },
};

export function label(result) {
  if (result.skipped) return 'skip';
  return result.ok ? 'ok  ' : 'FAIL';
}

export function tally(results, familyCount, seconds) {
  const families = results.filter((result) => result.id !== 'baseline-green-copy');
  const proven = families.filter((result) => result.ok && !result.skipped).length;
  const skipped = families.filter((result) => result.skipped).length;
  const parts = [`mutation smoke: ${proven}/${familyCount} families proven`];
  if (skipped > 0) parts.push(`${skipped} skipped`);
  const failedCount = families.filter((result) => !result.ok && !result.skipped).length;
  if (failedCount > 0) parts.push(`${failedCount} FAILED`);
  return `${parts.join(', ')} in ${seconds}s`;
}

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
      await snapshotDist(copySite, work);
      for (const entry of manifestFamilies(FAMILIES)) {
        const familyStart = Date.now();
        let outcome;
        if (fast && entry.slow)
          outcome = { skipped: true, reason: 'skipped: --fast (needs a full build or a browser)' };
        else outcome = await EXECUTORS[entry.kind](copySite, entry, work);
        results.push({ id: entry.id, ...outcome, seconds: Math.round((Date.now() - familyStart) / 1000) });
      }
    }
  } catch (error) {
    results.push({ id: 'smoke-harness', ok: false, reason: error.message });
  }

  for (const result of results) console.log(`${label(result)} ${result.id}: ${result.reason}`);
  console.log(tally(results, FAMILIES.length, Math.round((Date.now() - started) / 1000)));
  const failed = results.filter((result) => !result.ok && !result.skipped);
  if (failed.length > 0 || process.env.MUTATION_SMOKE_KEEP) console.log(`workdir kept for inspection: ${work}`);
  else await rm(work, { recursive: true, force: true });
  process.exitCode = failed.length > 0 ? 1 : 0;
}

if (import.meta.filename === process.argv[1]) {
  await main();
}
