import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

import { paginatedCopySpecimens } from './paginated-copy-specimens.mjs';

const FIRST_PAGE = 'dist/blog/tag/ai-governance.html';
const SECOND_PAGE = 'dist/blog/tag/ai-governance/page/2.html';
const ROUTES = 'dist/gate-routes.json';
const WORDING_FILE = 'src/utils/paginate.mjs';
const WORDING = "export const PAGE_HEADING_FORMAT = '{heading}, page {number}';\n";
const FIRST_PAGE_HTML =
  '<html><head><title>AI governance posts — meshin.co</title></head><body><h1 class="big">AI governance posts</h1><p>All posts tagged AI governance, newest first.</p></body></html>';

const addUntrackedFile = async (path, content) => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
  return () => rm(path, { force: true });
};

const editFile = async (path, change) => {
  const pristine = await readFile(path, 'utf8');
  await writeFile(path, change(pristine));
  return () => writeFile(path, pristine);
};

const specimens = paginatedCopySpecimens({ addUntrackedFile, editFile });

async function copyWith(files) {
  const copySite = await mkdtemp(join(tmpdir(), 'paginated-copy-specimen-'));
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(copySite, path)), { recursive: true });
    await writeFile(join(copySite, path), content);
  }
  return copySite;
}

const fullCopy = () =>
  copyWith({
    [FIRST_PAGE]: FIRST_PAGE_HTML,
    [ROUTES]: JSON.stringify({ routes: ['/', '/blog/tag/ai-governance'], built: 'today' }),
    [WORDING_FILE]: WORDING,
  });

const read = (copySite, path) => readFile(join(copySite, path), 'utf8');

test('the scene makes a second page out of the first page, changing only its title and its heading, and lists its route', async () => {
  const copySite = await fullCopy();
  try {
    assert.equal(await specimens.numberedRouteHandWritten.scene({ copySite }), copySite);
    assert.equal(
      await read(copySite, SECOND_PAGE),
      FIRST_PAGE_HTML.replace('<title>AI governance posts', '<title>AI governance posts, page 2').replace(
        '>AI governance posts</h1>',
        '>AI governance posts, page 2</h1>'
      )
    );
    assert.deepEqual(JSON.parse(await read(copySite, ROUTES)), {
      routes: ['/', '/blog/tag/ai-governance', '/blog/tag/ai-governance/page/2'],
      built: 'today',
    });
  } finally {
    await rm(copySite, { recursive: true, force: true });
  }
});

test('the hand-written specimen puts one sentence under the heading, and its token names that very sentence', async () => {
  const copySite = await fullCopy();
  try {
    const specimen = specimens.numberedRouteHandWritten;
    await specimen.scene({ copySite });
    const numbered = await read(copySite, SECOND_PAGE);

    const restore = await specimen.plant(copySite);
    const [, sentence] = /<\/h1><p>([^<]*)<\/p>/.exec(await read(copySite, SECOND_PAGE));
    assert.equal(specimen.token, `unreviewed copy (1): /blog/tag/ai-governance/page/2 | ${sentence}`);
    assert.ok(sentence.length <= 70, 'the gate prints only the first 70 characters of a row');

    await restore();
    assert.equal(await read(copySite, SECOND_PAGE), numbered);
  } finally {
    await rm(copySite, { recursive: true, force: true });
  }
});

test('the wording specimen edits the format in the pagination source, leaves the pages alone, and restores the source', async () => {
  const copySite = await fullCopy();
  try {
    const specimen = specimens.paginationWordingEdited;
    await specimen.scene({ copySite });
    const numbered = await read(copySite, SECOND_PAGE);

    const restore = await specimen.plant(copySite);
    assert.match(await read(copySite, WORDING_FILE), /'\{heading\} — page \{number\}'/);
    assert.equal(await read(copySite, SECOND_PAGE), numbered);
    assert.equal(specimen.token, 'stale dispositions (1): src/utils/paginate.mjs');

    await restore();
    assert.equal(await read(copySite, WORDING_FILE), WORDING);
  } finally {
    await rm(copySite, { recursive: true, force: true });
  }
});

test('a first page with no heading, or a source that lost the wording, stops the specimen loudly instead of planting nothing', async () => {
  const withoutHeading = await copyWith({
    [FIRST_PAGE]: '<html><head><title>AI governance posts — meshin.co</title></head></html>',
    [ROUTES]: JSON.stringify({ routes: [] }),
  });
  const withoutWording = await copyWith({ [WORDING_FILE]: 'export const PAGE_SIZE = 12;\n' });
  try {
    await assert.rejects(specimens.numberedRouteHandWritten.scene({ copySite: withoutHeading }), /no h1 to number/);
    await assert.rejects(specimens.paginationWordingEdited.plant(withoutWording), /found no/);
  } finally {
    await rm(withoutHeading, { recursive: true, force: true });
    await rm(withoutWording, { recursive: true, force: true });
  }
});
