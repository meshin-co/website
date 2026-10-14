import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { brandFromDisk } from '../src/utils/brand.mjs';
import { evidenceSpecimens } from './evidence-specimens.mjs';
import { REGISTERS_BEGIN } from './registers.mjs';
import { SPEC_SPECIMENS } from './spec-specimens.mjs';

const ANSI_SEQUENCE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');
export const flatten = (output) => String(output).replace(ANSI_SEQUENCE, '').replace(/\s+/g, ' ');
const tail = (output) => flatten(output).slice(-300);

const ORIGIN = `https://${brandFromDisk().name}`;

const git = (path, ...args) => execFileSync('git', [...args, path], { cwd: dirname(path), stdio: 'ignore' });

const gitOutput = (cwd, ...args) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

export function assertStandaloneRepo(repo) {
  const top = gitOutput(repo, 'rev-parse', '--show-toplevel');
  const gitDir = gitOutput(repo, 'rev-parse', '--absolute-git-dir');
  if (!gitDir.startsWith(`${top}/`))
    throw new Error(
      `git directory ${gitDir} lies outside ${top}, so a specimen staged there would reach another repository`
    );
}

export async function addUntrackedFile(path, content) {
  const created = await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
  return () => rm(created ?? path, { recursive: true, force: true });
}

export async function addFile(path, content) {
  const removeFile = await addUntrackedFile(path, content);
  git(path, 'add', '-f');
  return async () => {
    git(path, 'rm', '-q', '--cached', '-f');
    await removeFile();
  };
}

export async function editFile(path, change) {
  const pristine = await readFile(path, 'utf8');
  const edited = change(pristine);
  if (edited === pristine) throw new Error(`specimen edit changed nothing in ${path}`);
  await writeFile(path, edited);
  return () => writeFile(path, pristine);
}

async function addPage(copySite, route, html) {
  const file = join(copySite, 'dist', `${route}.html`);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, html);
  return () => rm(file, { force: true });
}

async function moveAside(path) {
  const aside = `${path}.specimen-aside`;
  await rename(path, aside);
  return () => rename(aside, path);
}

const PENDING_FILE = 'scripts/mutation-pending.mjs';
const PENDING_ANCHOR = 'export const PENDING = [';
const plantPendingEntry = (copySite, change) =>
  editFile(join(copySite, PENDING_FILE), (text) =>
    text.replace(
      PENDING_ANCHOR,
      `${PENDING_ANCHOR}\n  { gate: 'gate:zz-specimen', change: '${change}', reason: 'planted specimen' },`
    )
  );

const DUPLICATE_ID_PAGE =
  '<!DOCTYPE html><html lang="en"><head><title>x</title></head><body><p id="a"></p><p id="a"></p></body></html>';
const UNLABELLED_IMAGE_PAGE =
  '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">' +
  '<title>Specimen</title><meta name="description" content="A planted specimen page."></head>' +
  '<body><main><h1>Specimen</h1><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width="10" height="10"></main></body></html>';
const CONTROLLED_WORD_PAGE =
  '<!DOCTYPE html><html lang="en"><head><title>Specimen</title></head><body><main><h1>Specimen</h1><p>We commence the work on Monday.</p></main></body></html>';
const LONG_SENTENCE_PAGE =
  '<!DOCTYPE html><html lang="en"><head><title>Specimen</title></head><body><main><h1>Specimen</h1><p>We keep the plan short. The owner reads it each week. Every row names one person. The register lists every system the company runs, and each row names one owner, one risk tier, one review date and one short note on what the system does, who may use it and what data it may see at work. A new row takes a day.</p></main></body></html>';
const specimenPage = (sentences) =>
  `<!DOCTYPE html><html lang="en"><head><title>Specimen</title></head><body><main><h1>Specimen</h1><p>${sentences.join(' ')}</p></main></body></html>`;
const LONG_ROW_SENTENCE =
  'Each row names one owner, one risk tier, one review date and one short note on what the system does, who may use it and what data it may see.';
const SHORT_ROW_SENTENCE = 'A new row takes a day.';
const sentencesOf = (sentence, count) => Array.from({ length: count }, () => sentence);
const LONG_SENTENCES_OVER_SHARE_PAGE = specimenPage([
  ...sentencesOf(LONG_ROW_SENTENCE, 2),
  ...sentencesOf(SHORT_ROW_SENTENCE, 7),
]);
const LONG_SENTENCES_OVER_CAP_PAGE = specimenPage([
  ...sentencesOf(LONG_ROW_SENTENCE, 8),
  ...sentencesOf(SHORT_ROW_SENTENCE, 32),
]);
const LIGHTHOUSE_ROUTES = 'tests/guard-mutations/fixtures/lighthouse-specimen-routes.json';
const DEAD_PATH_SENTENCE = 'Read `docs/zz-specimen-missing.md` first.';

export const SPECIMENS = {
  html: {
    gate: 'gate:html',
    token: 'no-dup-id',
    plant: (copySite) => addPage(copySite, 'zz-specimen', DUPLICATE_ID_PAGE),
  },
  links: {
    gate: 'gate:links',
    env: { LINKS_SKIP_EXTERNAL: '1' },
    token: 'zz-specimen-missing',
    plant: (copySite) =>
      editFile(join(copySite, 'dist/about.html'), (html) =>
        html.replace('</body>', '<a href="/zz-specimen-missing/">x</a></body>')
      ),
  },
  orphans: {
    gate: 'gate:orphans',
    token: 'zero inbound links /zz-specimen',
    plant: async (copySite) =>
      addPage(copySite, 'zz-specimen', await readFile(join(copySite, 'dist/about.html'), 'utf8')),
  },
  machine: {
    gate: 'gate:machine',
    token: 'feed.json does not mirror rss.xml item-for-item',
    plant: (copySite) =>
      editFile(join(copySite, 'dist/feed.json'), (text) => {
        const feed = JSON.parse(text);
        feed.items.pop();
        return JSON.stringify(feed);
      }),
  },
  canonical: {
    gate: 'gate:machine',
    token: `/about canonical is ${ORIGIN}/about.html, expected ${ORIGIN}/about`,
    plant: (copySite) =>
      editFile(join(copySite, 'dist/about.html'), (html) =>
        html.replace(
          `<link href="${ORIGIN}/about" rel="canonical">`,
          `<link href="${ORIGIN}/about.html" rel="canonical">`
        )
      ),
  },
  search: {
    gate: 'gate:search',
    token: 'over 65536',
    plant: (copySite) =>
      editFile(join(copySite, 'dist/search-index-post.json'), (text) =>
        JSON.stringify([...JSON.parse(text), { pad: randomBytes(96 * 1024).toString('base64') }])
      ),
  },
  skills: {
    gate: 'gate:skills',
    token: 'scripts/zz-specimen-missing.mjs does not resolve',
    plant: (copySite) =>
      addFile(
        join(copySite, '.agents/skills/zz-specimen.md'),
        '# Specimen\n\nRun `scripts/zz-specimen-missing.mjs` before anything else.\n'
      ),
  },
  evidence: {
    gate: 'gate:evidence',
    token: 'no-provenance audits/phase-zz/REPORT.md',
    plant: (copySite) =>
      addFile(
        join(copySite, '../audits/phase-zz/REPORT.md'),
        '# Report\n\nGenerated from raw check output. All green.\n'
      ),
  },
  registers: {
    gate: 'gate:registers',
    token: 'registers-drift',
    plant: (copySite) =>
      editFile(join(copySite, '../docs/SEMANTIC-CORE.md'), (text) =>
        text.replace(REGISTERS_BEGIN, `${REGISTERS_BEGIN}\n| zz-specimen | /nowhere | 0 |`)
      ),
  },
  docsRecord: {
    gate: 'gate:docs',
    token: 'dead-path investigation/zz-specimen.md',
    plant: (copySite) =>
      addFile(
        join(copySite, '../investigation/zz-specimen.md'),
        `---\nrecord: false\n---\n\n# Not a record\n\n${DEAD_PATH_SENTENCE}\n`
      ),
  },
  docsIndexMarked: {
    gate: 'gate:docs',
    token: 'dead-path investigation/00-INDEX.md',
    plant: (copySite) =>
      editFile(
        join(copySite, '../investigation/00-INDEX.md'),
        (text) => `---\nrecord: true\n---\n${text}\n${DEAD_PATH_SENTENCE}\n`
      ),
  },
  docsRecordOutsideCorpus: {
    gate: 'gate:docs',
    token: 'dead-path docs/zz-specimen.md',
    plant: (copySite) =>
      addFile(
        join(copySite, '../docs/zz-specimen.md'),
        `---\nrecord: true\n---\n\n# Marked, but not under investigation\n\n${DEAD_PATH_SENTENCE}\n`
      ),
  },
  docsIgnoredPath: {
    gate: 'gate:docs',
    token: 'ignored-path docs/zz-specimen-ignored.md: audits/phase-local/zz-specimen.json',
    plant: async (copySite) => {
      const removeIgnored = await addUntrackedFile(join(copySite, '../audits/phase-local/zz-specimen.json'), '[]');
      const removeDoc = await addFile(
        join(copySite, '../docs/zz-specimen-ignored.md'),
        '# Not a real doc\n\nThe build writes `audits/phase-local/zz-specimen.json`.\n'
      );
      return async () => {
        await removeDoc();
        await removeIgnored();
      };
    },
  },
  docsArchiveDeadPath: {
    gate: 'gate:docs',
    token: 'dead-path openspec/changes/archive/2026-01-01-zz-specimen/design.md',
    plant: (copySite) =>
      addFile(
        join(copySite, '../openspec/changes/archive/2026-01-01-zz-specimen/design.md'),
        `# Archived specimen\n\n${DEAD_PATH_SENTENCE}\n`
      ),
  },
  routesShrink: {
    gate: 'gate:routes',
    token: 'ROUTES UNEXPLAINED REMOVAL /zz-specimen-route',
    plant: (copySite) =>
      editFile(join(copySite, '../audits/routes.json'), (ledger) =>
        JSON.stringify([...JSON.parse(ledger), '/zz-specimen-route'])
      ),
  },
  brand: {
    gate: 'gate:brand',
    token: 'src/utils/zz-specimen.mjs:1',
    plant: (copySite) =>
      addFile(
        join(copySite, 'src/utils/zz-specimen.mjs'),
        `export const TYPED_BRAND = '${brandFromDisk(join(copySite, 'src/config.yaml')).name}';\n`
      ),
  },
  editorialRowUnreviewed: {
    gate: 'gate:editorial',
    token: 'unreviewed:',
    plant: (copySite) => moveAside(join(copySite, '../audits/phase-4.7/dispositions/faq.json')),
  },
  pendingUnknownChange: {
    gate: 'gate:plan',
    token: 'pending-specimen-unknown-change',
    plant: (copySite) => plantPendingEntry(copySite, '99-zz-specimen'),
  },
  pendingChangeArchived: {
    gate: 'gate:plan',
    token: 'pending-specimen-change-archived',
    plant: (copySite) => plantPendingEntry(copySite, '01-initialization'),
  },
  wiringRemoved: {
    gate: 'gate:plan',
    token: 'gate-not-in-ci',
    plant: (copySite) =>
      editFile(join(copySite, '../.github/workflows/ci.yml'), (text) =>
        text.replace('npm run gate:editorial', 'echo skipped')
      ),
  },
  gateWaivedByProse: {
    gate: 'gate:plan',
    token: 'unwaivable-gate-declared-local-only',
    plant: (copySite) =>
      editFile(join(copySite, 'package.json'), (text) =>
        text.replace('"localOnlyGates": {', '"localOnlyGates": {\n    "gate:spec": "slow on my laptop",')
      ),
  },
  visualAxe: {
    gate: 'gate:visual',
    env: { CI: '1' },
    args: ['--project=desktop', '--grep', '(/about|/zz-specimen) has no accessibility violations in light'],
    token: 'image-alt: 1 node(s)',
    plant: (copySite) => addPage(copySite, 'zz-specimen', UNLABELLED_IMAGE_PAGE),
  },
  humanControlledWord: {
    gate: 'gate:human',
    token: '/zz-specimen controlled-word: commence',
    plant: (copySite) => addPage(copySite, 'zz-specimen', CONTROLLED_WORD_PAGE),
  },
  humanSentenceOverCeiling: {
    gate: 'gate:human',
    token: '/zz-specimen sentence-longest:',
    plant: (copySite) => addPage(copySite, 'zz-specimen', LONG_SENTENCE_PAGE),
  },
  humanLongSentencesOverShare: {
    gate: 'gate:human',
    token: '/zz-specimen long-sentences: 2 of 9 sentences over 25 words, limit 1',
    plant: (copySite) => addPage(copySite, 'zz-specimen', LONG_SENTENCES_OVER_SHARE_PAGE),
  },
  humanLongSentencesOverCap: {
    gate: 'gate:human',
    token: '/zz-specimen long-sentences: 8 of 40 sentences over 25 words, limit 7',
    plant: (copySite) => addPage(copySite, 'zz-specimen', LONG_SENTENCES_OVER_CAP_PAGE),
  },
  lighthouseShard: {
    gate: 'gate:lh:one',
    env: { LH_ONLY_ROUTES: LIGHTHOUSE_ROUTES, LHCI_FORM_FACTOR: 'mobile', GATE_PHASE: 'specimen' },
    token: 'categories.accessibility failure for minScore assertion',
    plant: (copySite) => addPage(copySite, 'zz-specimen', UNLABELLED_IMAGE_PAGE),
  },
  lighthouseBothFactors: {
    gate: 'gate:lh',
    env: { LH_ONLY_ROUTES: LIGHTHOUSE_ROUTES, GATE_PHASE: 'specimen' },
    token: 'categories.accessibility failure for minScore assertion',
    plant: (copySite) => addPage(copySite, 'zz-specimen', UNLABELLED_IMAGE_PAGE),
  },
  lighthouseSelfWaivingNoindex: {
    gate: 'gate:lh:one',
    env: { LH_ONLY_ROUTES: LIGHTHOUSE_ROUTES, LHCI_FORM_FACTOR: 'mobile', GATE_PHASE: 'specimen' },
    token: 'categories.seo failure for minScore assertion',
    plant: (copySite) =>
      addPage(
        copySite,
        'zz-specimen',
        UNLABELLED_IMAGE_PAGE.replace('<img ', '<img alt="" ').replace(
          '<title>',
          '<meta name="robots" content="noindex, follow"><title>'
        )
      ),
  },
  ...evidenceSpecimens({ addUntrackedFile }),
  ...SPEC_SPECIMENS,
};

const commandFor = (specimen, copySite) => {
  const npm = ['npm', 'run', specimen.gate, ...(specimen.args ? ['--', ...specimen.args] : [])];
  if (!specimen.env) return [npm[0], npm.slice(1), copySite];
  const assignments = Object.entries(specimen.env).map(([key, value]) => `${key}=${value}`);
  return ['env', [...assignments, ...npm], copySite];
};

export async function proveWithSpecimen(specimen, { copySite, run }) {
  const command = commandFor(specimen, copySite);
  const pristine = await run(...command);
  if (pristine.code !== 0)
    return { ok: false, reason: `${specimen.gate} was already red on the pristine copy: ${tail(pristine.output)}` };
  if (flatten(pristine.output).includes(specimen.token))
    return {
      ok: false,
      reason: `${specimen.gate} already prints "${specimen.token}" on the pristine copy, so the token proves nothing`,
    };

  const restore = await specimen.plant(copySite);
  let planted;
  try {
    planted = await run(...command);
  } finally {
    await restore();
  }

  if (planted.code === 0) return { ok: false, reason: `${specimen.gate} stayed green on the specimen` };
  if (!flatten(planted.output).includes(specimen.token))
    return { ok: false, reason: `${specimen.gate} failed for the wrong reason: ${tail(planted.output)}` };
  return { ok: true, reason: `${specimen.gate} red on the specimen (${specimen.token}), green without it` };
}
