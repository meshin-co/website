import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { PAGE_SIZE } from '../src/utils/paginate.mjs';
import { EXECUTORS, FAMILIES, manifestFamilies } from './mutation-smoke.mjs';

const FAMILY = manifestFamilies(FAMILIES).find((entry) => entry.id === 'tag-pagination-page-2');
const PAGINATE_MODULE = new URL('../src/utils/paginate.mjs', import.meta.url).href;
const FIXTURE = new URL(`../tests/guard-mutations/fixtures/${FAMILY.fixture}`, import.meta.url);
const TAG = /^tags:\s*\n\s+-\s+(\S+)\s*$/m.exec(readFileSync(FIXTURE, 'utf8'))[1];

async function renderTagArchive({ mode, paginateModule, tag }) {
  const { mkdirSync, readFileSync, readdirSync, writeFileSync } = await import('node:fs');
  const { firstPage, paginate, paginationLinks } = await import(paginateModule);
  const origin = 'https://meshin.co';
  const route = `/blog/tag/${tag}`;
  const files = readdirSync('src/data/post');
  const posts = files
    .map((name) => ({ id: name.replace(/\.md$/, ''), text: readFileSync(`src/data/post/${name}`, 'utf8') }))
    .filter(({ text }) => text.includes(`  - ${tag}\n`) && !/^draft: true$/m.test(text))
    .map(({ id, text }) => ({ id, date: /^publishDate: (\S+)$/m.exec(text)[1] }))
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  const links = paginationLinks(route, posts);
  const item = (aria, href, text) => `<li><a aria-label="${aria}" href="${href}">${text}</a></li>`;
  const cards = (entries) =>
    entries.map(({ id }) => `<article><h3><a href="/blog/${id}">${id}</a></h3></article>`).join('');
  const pageAt = ({ path, robots, current, entries }) => {
    const numbers = links.map(({ pageNumber, href }) =>
      pageNumber === current
        ? `<li><span aria-current="page">${pageNumber}</span></li>`
        : item(`Page ${pageNumber}`, href, pageNumber)
    );
    const earlier = current === 2 ? route : `${route}/page/${current - 1}`;
    const previous = current > 1 ? item('Previous page', earlier, 'Previous') : '';
    const next = current < links.length ? item('Next page', `${route}/page/${current + 1}`, 'Next') : '';
    const head = `<link href="${origin}${path}" rel="canonical"><meta content="${robots}" name="robots">`;
    return `<html><head>${head}</head><body><nav aria-label="Pagination"><ol>${previous}${numbers.join('')}${next}</ol></nav><main>${cards(entries)}</main></body></html>`;
  };
  mkdirSync(`dist${route}/page`, { recursive: true });
  const unpaginated = mode === 'unpaginated';
  const first = { path: route, robots: 'index, follow', current: 1, entries: unpaginated ? posts : firstPage(posts) };
  writeFileSync(`dist${route}.html`, pageAt(first));
  for (const { pageNumber, entries } of unpaginated ? [] : paginate(posts)) {
    const path = `${route}/page/${pageNumber}`;
    const listed = mode === 'repeats-page-1' ? firstPage(posts) : entries;
    writeFileSync(
      `dist${path}.html`,
      pageAt({ path, robots: 'noindex, follow', current: pageNumber, entries: listed })
    );
  }
  writeFileSync('dist/sitemap-0.xml', `<urlset><url><loc>${origin}${route}</loc></url></urlset>`);
  const planted = files.filter((name) => name.startsWith('mutation-tag-post-')).length;
  writeFileSync('dist/planted.json', JSON.stringify({ planted }));
}

const post = (tag, extra = '') => `---\npublishDate: 2026-10-05\ntags:\n  - ${tag}\n${extra}---\nA real post.\n`;

function site(t, { carrying, drafts = 0, mode = 'paginated' }) {
  const copySite = mkdtempSync(join(tmpdir(), 'tag-pagination-family-'));
  t.after(() => rmSync(copySite, { recursive: true, force: true }));
  const posts = join(copySite, 'src/data/post');
  mkdirSync(posts, { recursive: true });
  writeFileSync(join(copySite, 'package.json'), JSON.stringify({ scripts: { build: 'node stub-build.mjs' } }));
  const settings = JSON.stringify({ mode, paginateModule: PAGINATE_MODULE, tag: TAG });
  writeFileSync(join(copySite, 'stub-build.mjs'), `await (${renderTagArchive})(${settings});`);
  for (let index = 1; index <= carrying; index += 1) writeFileSync(join(posts, `real-${index}.md`), post(TAG));
  for (let index = 1; index <= drafts; index += 1) {
    writeFileSync(join(posts, `draft-${index}.md`), post(TAG, 'draft: true\n'));
  }
  writeFileSync(join(posts, 'real-of-another-tag.md'), post('shadow-ai'));
  return copySite;
}

const plantedAtBuild = (copySite) => JSON.parse(readFileSync(join(copySite, 'dist/planted.json'), 'utf8')).planted;
const plantsLeft = (copySite) =>
  readdirSync(join(copySite, 'src/data/post')).filter((name) => name.startsWith('mutation-'));
const shortfall = (carrying) => Math.max(0, PAGE_SIZE + 1 - carrying);

const SIZES = [
  [0, 'no real post carries the tag'],
  [PAGE_SIZE, 'the tag fills page 1 exactly'],
  [PAGE_SIZE + 1, 'one real post is all that page 2 needs'],
  [2 * PAGE_SIZE, 'real posts fill pages 1 and 2, where a plant dated before them first reaches page 3'],
  [3 * PAGE_SIZE + 4, 'the tag runs to a fourth page'],
];

for (const [carrying, what] of SIZES) {
  test(`the tag family is proven when ${what} (${carrying} real posts) and plants only what page 2 lacks`, async (t) => {
    const copySite = site(t, { carrying });
    const verdict = await EXECUTORS.pagination(copySite, FAMILY);
    assert.equal(verdict.ok, true, verdict.reason);
    assert.equal(plantedAtBuild(copySite), shortfall(carrying));
    assert.deepEqual(plantsLeft(copySite), []);
  });
}

test('a draft carrying the tag is not a post the tag lists, so it does not count toward page 2', async (t) => {
  const copySite = site(t, { carrying: PAGE_SIZE, drafts: 1 });
  const verdict = await EXECUTORS.pagination(copySite, FAMILY);
  assert.equal(verdict.ok, true, verdict.reason);
  assert.equal(plantedAtBuild(copySite), 1);
});

test('the tag family fails when page 2 lists the posts of page 1 again, at sizes where no plant could show it', async (t) => {
  for (const carrying of [3, 2 * PAGE_SIZE]) {
    const copySite = site(t, { carrying, mode: 'repeats-page-1' });
    const verdict = await EXECUTORS.pagination(copySite, FAMILY);
    assert.equal(verdict.ok, false, `${carrying} real posts`);
    assert.match(verdict.reason, /tag page 2 posts that page 1 lists too/, `${carrying} real posts`);
    assert.deepEqual(plantsLeft(copySite), []);
  }
});

test('the tag family fails on an archive that is not paginated, naming the page never built and the page too long', async (t) => {
  const copySite = site(t, { carrying: 2 * PAGE_SIZE, mode: 'unpaginated' });
  const verdict = await EXECUTORS.pagination(copySite, FAMILY);
  assert.equal(verdict.ok, false);
  assert.match(verdict.reason, new RegExp(`/blog/tag/${TAG}/page/2 was not built`));
  assert.match(verdict.reason, new RegExp(`tag page 1 posts listed: got ${2 * PAGE_SIZE}, want ${PAGE_SIZE}`));
});
