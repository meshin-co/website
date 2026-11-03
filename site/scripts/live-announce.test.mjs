import assert from 'node:assert/strict';
import { test } from 'node:test';

import { entriesInBuild } from './entries-in-build.mjs';
import { surfacesOf } from './entry-surfaces.mjs';
import { runLink } from './github-links.mjs';
import { blockKitProblems } from './fixtures/block-kit.mjs';
import { ARTICLE, NOW, RUN_ENV, STATUS, TERM, failing, liveWorld } from './fixtures/live-world.mjs';
import { announceEntries } from './live-announce.mjs';
import { OWED, SURFACES } from './route-parity.mjs';
import { selectEntries } from './live-state.mjs';

const AT = NOW.toISOString();

async function announced(t, options, { webhook = true } = {}) {
  const w = await liveWorld({ runCli: null, ...options });
  t.after(w.close);
  const { entries } = await entriesInBuild({ repoRoot: w.root, dist: w.dist, instant: NOW });
  const { fresh } = selectEntries({ carried: entries, state: { announced: {} }, instant: NOW });
  const recorded = [];
  await announceEntries({
    entries: fresh,
    origin: w.origin,
    status: STATUS,
    links: { run: runLink(RUN_ENV) },
    fetch: globalThis.fetch,
    record: (routes) => recorded.push(routes),
    ...w.io({ hook: webhook }),
  });
  for (const message of w.posted()) assert.deepEqual(blockKitProblems(message), []);
  return { w, recorded, ...w.lines() };
}

test('every surface the shared derivation lists is a link in the message and was asked for on the live origin', async (t) => {
  const { w } = await announced(t, { entries: [ARTICLE] });
  const surfaces = surfacesOf({ format: 'article', slug: 'a-post', origin: w.origin });
  assert.ok(surfaces.length >= 8);
  for (const { url } of surfaces) {
    const { pathname } = new URL(url);
    assert.ok(w.posted()[0].text.includes(`<${url}|${pathname}>`), url);
    assert.equal(w.visits(pathname), 1, pathname);
  }
});

test('when the shared derivation gains a surface, the message gains it and the live origin is asked for it', async (t) => {
  SURFACES.planted = { label: 'a planted surface', artifact: ({ route }) => `/planted${route}`, absence: () => null };
  OWED.entry.push('planted');
  t.after(() => {
    OWED.entry.pop();
    delete SURFACES.planted;
  });
  const { w } = await announced(t, { entries: [ARTICLE] });
  assert.ok(w.posted()[0].text.includes(`A planted surface: <${w.origin}/planted/blog/a-post|/planted/blog/a-post>`));
  assert.equal(w.visits('/planted/blog/a-post'), 1);
});

test('a surface that two entries share, the sitemap and the full llms file, is asked for once, not once per entry', async (t) => {
  const { w } = await announced(t, { entries: [ARTICLE, TERM] });
  const shared = ['/sitemap-0.xml', '/llms-full.txt'];
  assert.deepEqual(
    shared.map((path) => w.visits(path)),
    [1, 1]
  );
  assert.equal(w.visits('/blog/a-post'), 1);
  assert.equal(w.visits('/glossary/a-term'), 1);
});

test('entries that do not fit one message are announced in groups of three, each recorded once it is delivered', async (t) => {
  const entries = ['a', 'b', 'c', 'd'].map((letter, at) => ({ slug: `post-${letter}`, hoursAgo: 10 - at }));
  const { w, recorded } = await announced(t, { entries });
  assert.equal(w.posted().length, 2);
  assert.deepEqual(recorded, [['/blog/post-a', '/blog/post-b', '/blog/post-c'], ['/blog/post-d']]);
  assert.match(w.posted()[0].text, /^3 entries are live\.$/m);
  assert.match(w.posted()[1].text, /^The entry is live\.$/m);
});

test('one live and one unreachable entry are two messages, the live one first, and only the live one is recorded', async (t) => {
  const { w, recorded, out, err } = await announced(t, {
    entries: [ARTICLE, TERM],
    site: failing('/glossary/a-term', 404),
  });
  assert.deepEqual(recorded, [['/blog/a-post']]);
  assert.equal(w.posted().length, 2);
  assert.match(w.posted()[0].text, /^The entry is live\.$/m);
  assert.match(w.posted()[1].text, /^An entry that merged is not reachable\./m);
  assert.deepEqual(out, [
    `live entry: a-post is live: HTTP 200 on attempt 1, checked ${AT}`,
    'live entry: slack delivered (HTTP 200)',
    'live entry warning: slack delivered (HTTP 200)',
  ]);
  assert.deepEqual(err, [
    `::warning::live entry: a-term merged but ${w.origin}/glossary/a-term is not reachable: HTTP 404 after 8 attempts, last checked ${AT}`,
  ]);
});

test('a surface that does not answer is plain text with its status, a warning section and a warning annotation, and the entry is announced', async (t) => {
  const { w, recorded, out, err } = await announced(t, { entries: [ARTICLE], site: failing('/blog/a-post.md', 404) });
  assert.deepEqual(recorded, [['/blog/a-post']]);
  assert.equal(out.length, 2);
  assert.deepEqual(err, [
    `::warning::live entry: a-post is live, but a surface does not answer: a markdown sidecar ${w.origin}/blog/a-post.md, HTTP 404 after 8 attempts, last checked ${AT}`,
  ]);
  const { text } = w.posted()[0];
  assert.ok(text.includes('A markdown sidecar: /blog/a-post.md (HTTP 404, checked 2026-11-03 09:00:00 UTC)'));
  assert.ok(text.includes('A surface of an entry that is live does not answer'));
});

test('a message Slack refuses, and one with no webhook to go to, is never recorded as announced', async (t) => {
  const refused = await announced(t, {
    entries: [ARTICLE],
    slack: failing('/services/T0SECRET/B0SECRET/xoxSECRETpath', 500),
  });
  assert.deepEqual(refused.recorded, []);
  assert.match(refused.err[0], /^::warning::live entry: slack NOT delivered: Slack answered HTTP 500/);
  const unset = await announced(t, { entries: [ARTICLE] }, { webhook: false });
  assert.deepEqual(unset.recorded, []);
  assert.deepEqual(unset.err, [
    '::warning::live entry: slack NOT delivered: SLACK_WEBHOOK_URL is not set; create the repository secret of that name',
  ]);
});
