import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { test } from 'node:test';

import { surfacesOf } from './entry-surfaces.mjs';
import { blockKitProblems } from './fixtures/block-kit.mjs';
import { ARTICLE, NOW, SECRETS, STATUS, TERM, aged, failing, flakySlack, liveWorld } from './fixtures/live-world.mjs';
import { reply } from './fixtures/local-server.mjs';
import { runCli } from './live-entry.mjs';
import { siteOrigin } from './links-gate.mjs';
import { SITE_CONFIG } from './site-brand.mjs';
import { monthLineOf } from './spend-ceiling.mjs';
import { monthPart } from './spend-slack.mjs';

const ANNOUNCED = { announced: { '/blog/a-post': '2026-11-02T08:00:00.000Z' } };
const AT = NOW.toISOString();
const NO_NEW = 'live entry: no new entry in this publish, so no message was posted';
const DELIVERED = 'live entry: slack delivered (HTTP 200)';
const live = (slug, attempt = 1) => `live entry: ${slug} is live: HTTP 200 on attempt ${attempt}, checked ${AT}`;
const SCHEDULE = [5, 10, 15, 20, 30, 30, 30].map((seconds) => seconds * 1000);

const world = async (t, options) => {
  const made = await liveWorld({ runCli, ...options });
  t.after(made.close);
  return made;
};
test('a page that answers at once is announced in one message with its cost, prompt, links and the time it was checked', async (t) => {
  const w = await world(t, { entries: [ARTICLE] });
  const { code, out, err } = await w.run();
  assert.deepEqual([code, err, out], [0, [], [live('a-post'), DELIVERED]]);
  const [message, ...others] = w.posted();
  assert.deepEqual(others, []);
  assert.deepEqual(message.blocks.slice(0, 2), monthPart(STATUS).blocks);
  assert.equal(message.text.split('\n')[0], monthLineOf(STATUS));
  for (const fact of [
    'The entry is live.',
    'What an AI system register holds',
    'article a-post',
    'Buyer prompt 3: “How do I keep an AI system register?”',
    '12,000 input tokens, 3,000 output tokens, 0.027 USD',
    'The page answered HTTP 200 on attempt 1, checked 2026-11-03 09:00:00 UTC.',
    '<https://github.test/o/r/actions/runs/777|run 777>',
  ])
    assert.ok(message.text.includes(fact), fact);
  assert.deepEqual(blockKitProblems(message), []);
  assert.deepEqual(w.state(), { announced: { '/blog/a-post': AT } });
});

test('two new entries are one message with both, oldest first, and both are recorded', async (t) => {
  const w = await world(t, { entries: [TERM, ARTICLE] });
  const { code, out } = await w.run();
  assert.deepEqual([code, out], [0, [live('a-post'), live('a-term'), DELIVERED]]);
  const [message, ...others] = w.posted();
  assert.deepEqual(others, []);
  assert.match(message.text, /^2 entries are live\.$/m);
  assert.ok(message.text.indexOf('a-post') < message.text.indexOf('a-term'));
  assert.ok(message.text.includes('6,000 input tokens, 1,200 output tokens'));
  assert.deepEqual(blockKitProblems(message), []);
  assert.deepEqual(w.state(), { announced: { '/blog/a-post': AT, '/glossary/a-term': AT } });
});

test('a publish with no new entry posts nothing, asks the live site nothing, changes no file and prints one line', async (t) => {
  const w = await world(t, { entries: [ARTICLE], state: ANNOUNCED });
  const before = w.stateText();
  assert.deepEqual(await w.run(), { code: 0, out: [NO_NEW], err: [] });
  assert.deepEqual(w.posted(), []);
  assert.equal(w.visits('/blog/a-post'), 0);
  assert.equal(w.stateText(), before);
});

test('an entry is announced once: the next publish of the same build posts nothing and asks nothing', async (t) => {
  const w = await world(t, { entries: [ARTICLE] });
  await w.run();
  const second = await w.run();
  assert.deepEqual([second.code, second.out], [0, [NO_NEW]]);
  assert.equal(w.posted().length, 1);
  assert.equal(w.visits('/blog/a-post'), 1);
});

test('only the entry that is new is announced, and an entry whose page is not in the build waits for a later publish', async (t) => {
  const w = await world(t, {
    entries: [ARTICLE, TERM, { slug: 'later' }],
    built: ['a-post', 'a-term'],
    state: ANNOUNCED,
  });
  assert.deepEqual((await w.run()).out, [live('a-term'), DELIVERED]);
  assert.deepEqual(Object.keys(w.state().announced), ['/blog/a-post', '/glossary/a-term']);
  assert.equal(w.visits('/blog/later'), 0);
});

test('real HTTP: a page that answers 404 twice and then 200 is live on the third attempt, after the first waits of the schedule', async (t) => {
  const w = await world(t, { entries: [ARTICLE], site: failing('/blog/a-post', 404, 2) });
  assert.deepEqual((await w.run()).out, [live('a-post', 3), DELIVERED]);
  assert.deepEqual(w.waits, SCHEDULE.slice(0, 2));
  assert.equal(w.visits('/blog/a-post'), 3);
});

test('real HTTP: a page that answers 200 after a redirect is live, and the message links the address of the entry', async (t) => {
  const site = ({ request, response }) =>
    request.url === '/blog/a-post' ? reply(response, 301, { location: '/blog/a-post/' }) : reply(response, 200);
  const w = await world(t, { entries: [ARTICLE], site });
  assert.deepEqual((await w.run()).out, [live('a-post'), DELIVERED]);
  assert.equal(w.visits('/blog/a-post/'), 1);
  assert.ok(w.posted()[0].text.includes(`<${w.origin}/blog/a-post|/blog/a-post>`));
});

test('real HTTP: a page that never answers 200 is a warning message of its own and a warning annotation, exits 0 and is not recorded', async (t) => {
  const w = await world(t, { entries: [ARTICLE], site: failing('/blog/a-post', 404) });
  const { code, out, err } = await w.run();
  assert.equal(code, 0);
  assert.equal(w.visits('/blog/a-post'), 8);
  assert.deepEqual(w.waits, SCHEDULE);
  assert.deepEqual(out, ['live entry warning: slack delivered (HTTP 200)']);
  assert.deepEqual(err, [
    `::warning::live entry: a-post merged but ${w.origin}/blog/a-post is not reachable: HTTP 404 after 8 attempts, last checked ${AT}`,
  ]);
  const [warning, ...others] = w.posted();
  assert.deepEqual(others, []);
  assert.deepEqual(warning.blocks.slice(0, 2), monthPart(STATUS).blocks);
  assert.match(warning.text, /An entry that merged is not reachable\. A person has something to do\./);
  assert.deepEqual(blockKitProblems(warning), []);
  assert.deepEqual(w.state(), { announced: {} });
});

test('an entry whose page did not answer is checked again by the next publish, and announced once the page answers', async (t) => {
  const answers = { now: 404 };
  const site = ({ response }) => reply(response, answers.now);
  const w = await world(t, { entries: [ARTICLE], site });
  await w.run();
  answers.now = 200;
  const second = await w.run();
  assert.deepEqual(second.out, [live('a-post'), DELIVERED]);
  assert.match(w.posted().at(-1).text, /^The entry is live\.$/m);
  assert.deepEqual(w.state(), { announced: { '/blog/a-post': AT } });
});

test('real HTTP: a closed port is an unreachable page that names the refused connection', async (t) => {
  const w = await world(t, { entries: [ARTICLE], closed: true });
  const { code, err } = await w.run();
  const unreached = surfacesOf({ format: 'article', slug: 'a-post', origin: w.origin }).length;
  assert.equal(code, 0);
  assert.equal(w.waits.length, SCHEDULE.length * unreached);
  assert.match(
    err[0],
    /^::warning::live entry: a-post merged but .*\/blog\/a-post is not reachable: request failed: ECONNREFUSED after 8 attempts/
  );
  assert.deepEqual(w.state(), { announced: {} });
});

test('a post Slack refuses is a warning annotation and exit 0, the entry stays unannounced, and the next publish announces it', async (t) => {
  const { slack, recover } = flakySlack();
  const w = await world(t, { entries: [ARTICLE], slack });
  const first = await w.run();
  assert.deepEqual([first.code, first.out], [0, [live('a-post')]]);
  assert.deepEqual(first.err, [
    '::warning::live entry: slack NOT delivered: Slack answered HTTP 500: no hook at [SLACK_WEBHOOK_URL]',
  ]);
  assert.deepEqual(w.state(), { announced: {} });
  recover();
  assert.deepEqual((await w.run()).out, [live('a-post'), DELIVERED]);
  assert.deepEqual(w.state(), { announced: { '/blog/a-post': AT } });
});

test('first run: an entry made in the 48 hours before the publish is announced, every older one is recorded without a message', async (t) => {
  const entries = [aged('old', 720), aged('a-post', 30), aged('fresh', 1)];
  const w = await world(t, { entries, state: null });
  const { code, out } = await w.run();
  assert.equal(code, 0);
  assert.deepEqual(out, [
    'live entry: first run: recorded 1 existing entry as already announced, without a message',
    live('a-post'),
    live('fresh'),
    DELIVERED,
  ]);
  assert.match(w.posted()[0].text, /^2 entries are live\.$/m);
  assert.equal(w.posted()[0].text.includes('article old'), false);
  assert.deepEqual(w.state(), { announced: { '/blog/a-post': AT, '/blog/fresh': AT, '/blog/old': AT } });
  assert.deepEqual((await w.run()).out, [NO_NEW]);
});

test('first run with nothing recent posts nothing and prints one line, and the state file exists for the next run', async (t) => {
  const w = await world(t, { entries: [aged('old', 720), aged('older', 900)], state: null });
  assert.deepEqual(await w.run(), {
    code: 0,
    out: ['live entry: first run: recorded 2 existing entries as already announced, without a message'],
    err: [],
  });
  assert.deepEqual(w.posted(), []);
  assert.deepEqual(Object.keys(w.state().announced), ['/blog/old', '/blog/older']);
});

test('first run whose only entry is recent and whose post fails still leaves a state file, so a later run announces it however old it grew', async (t) => {
  const { slack, recover } = flakySlack();
  const w = await world(t, { entries: [aged('fresh', 1)], state: null, slack });
  await w.run();
  assert.deepEqual(w.state(), { announced: {} });
  recover();
  const later = new Date(NOW.getTime() + 10 * 24 * 60 * 60 * 1000);
  const { out } = await w.run({ now: () => later });
  assert.equal(out[0], `live entry: fresh is live: HTTP 200 on attempt 1, checked ${later.toISOString()}`);
  assert.deepEqual(w.state(), { announced: { '/blog/fresh': later.toISOString() } });
});

test('first run with no entry in the build writes an empty state and says there was nothing new', async (t) => {
  const w = await world(t, { entries: [aged('later', 1)], built: [], state: null });
  assert.deepEqual(await w.run(), { code: 0, out: [NO_NEW], err: [] });
  assert.deepEqual(w.state(), { announced: {} });
});

test('first run whose post fails keeps the recent entry unannounced, however old it grows, and still records the others', async (t) => {
  const { slack, recover } = flakySlack();
  const w = await world(t, { entries: [aged('old', 720), aged('fresh', 1)], state: null, slack });
  await w.run();
  assert.deepEqual(w.state(), { announced: { '/blog/old': AT } });
  recover();
  const later = new Date(NOW.getTime() + 10 * 24 * 60 * 60 * 1000);
  assert.deepEqual((await w.run({ now: () => later })).out.slice(0, 1), [
    `live entry: fresh is live: HTTP 200 on attempt 1, checked ${later.toISOString()}`,
  ]);
});

test('the webhook appears in no printed line, no posted message and no state file, even when Slack echoes it back', async (t) => {
  const { slack, recover } = flakySlack();
  const w = await world(t, { entries: [ARTICLE, TERM], slack });
  const refused = await w.run();
  recover();
  const delivered = await w.run();
  const shown = [...refused.out, ...refused.err, ...delivered.out, ...delivered.err];
  const everywhere = [...shown, ...w.bodies(), w.stateText()].join('\n');
  assert.doesNotMatch(everywhere, SECRETS);
  assert.equal(everywhere.includes(w.webhook), false);
  assert.ok(shown.some((line) => line.includes('[SLACK_WEBHOOK_URL]')));
});

test('the live origin is the site address of the configuration and nothing else', async (t) => {
  const w = await world(t, { entries: [ARTICLE] });
  const asked = [];
  const fetch = async (url, init) => {
    if (url.startsWith(w.webhook.slice(0, w.webhook.indexOf('/services')))) return globalThis.fetch(url, init);
    asked.push(url);
    return { status: 200, body: null };
  };
  const argv = ['--dist', w.dist, '--state', w.statePath, '--repo-root', w.root];
  await runCli(argv, { ...w.io(), statusOf: () => STATUS, fetch });
  const origin = `${siteOrigin(SITE_CONFIG)}/`;
  assert.ok(asked.length >= 8);
  assert.deepEqual(
    asked.filter((url) => !url.startsWith(origin)),
    []
  );
});

const USAGE_ERRORS = [
  ['no argument at all', [], /--dist and --state are required/],
  ['a missing state file name', ['--dist', 'dist'], /--dist and --state are required/],
  ['an argument nobody knows', ['--dist', 'dist', '--state', 's', '--now', 'x'], /unknown argument --now/],
  ['a flag without its value', ['--dist', 'dist', '--state'], /--state needs a value/],
  ['a bare word', ['dist'], /unknown argument dist/],
];

test('a call that is not understood exits 2 with the usage, and posts nothing', async (t) => {
  const w = await world(t, { entries: [ARTICLE] });
  for (const [name, args, problem] of USAGE_ERRORS) {
    const { code, out, err } = await w.run({ args });
    assert.equal(code, 2, name);
    assert.deepEqual(out, [], name);
    assert.match(err.join('\n'), problem, name);
    assert.match(err.join('\n'), /Usage: node scripts\/live-entry\.mjs --dist/, name);
  }
  assert.deepEqual(w.posted(), []);
});

test('input that cannot be read exits 1, says which, posts nothing and leaves the state file as it was', async (t) => {
  const w = await world(t, { entries: [ARTICLE], state: 'not json' });
  const damaged = await w.run();
  assert.equal(damaged.code, 1);
  assert.ok(damaged.err.join('\n').includes(`${w.statePath} is not readable JSON`));
  assert.equal(w.stateText(), 'not json');
  writeFileSync(w.statePath, '{"announced":{}}\n');
  const dist = await w.run({ args: ['--dist', `${w.dist}-missing`, '--state', w.statePath, '--repo-root', w.root] });
  assert.equal(dist.code, 1);
  assert.match(dist.err.join('\n'), /the build directory .*-missing cannot be read/);
  const status = await w.run({
    statusOf: () => {
      throw new Error('git is not available');
    },
  });
  assert.deepEqual([status.code, status.err], [1, ['live entry: git is not available']]);
  assert.deepEqual(w.posted(), []);
});

test('a record that cannot be read is a warning annotation, and the other entries are still announced', async (t) => {
  const w = await world(t, { entries: [ARTICLE] });
  w.put('audits/autowriter/generations/2026/11/broken.json', 'not json');
  const { code, out, err } = await w.run();
  assert.equal(code, 0);
  assert.deepEqual(out, [live('a-post'), DELIVERED]);
  assert.deepEqual(err, [
    '::warning::live entry: audits/autowriter/generations/2026/11/broken.json is not counted: it is not readable JSON',
  ]);
});

const UNMEASURED = {
  tree: 'bbbbbbbbbbbb',
  last: 'no Lighthouse run is recorded for this repository',
  owed: [{ slug: 'a-post', mergedCommit: 'd716823', recordedAt: '2026-11-04T03:43:07.953Z' }],
  clear: 'cd site && npm run lh:record',
};

test('an entry that ships on a tree no run measured is announced with that fact in the same message', async (t) => {
  const w = await world(t, { entries: [ARTICLE] });
  const { code, err } = await w.run({ unmeasuredOf: async () => UNMEASURED });
  assert.deepEqual([code, err], [0, []]);
  const [message, ...others] = w.posted();
  assert.deepEqual(others, []);
  assert.match(message.text, /This build shipped without a Lighthouse measurement\./);
  assert.match(message.text, /`a-post` owes the measurement/);
  assert.deepEqual(blockKitProblems(message), []);
  assert.deepEqual(w.state(), { announced: { '/blog/a-post': AT } });
});

test('a tree that cannot be described still announces the entry, and the failure is a warning on the run', async (t) => {
  const w = await world(t, { entries: [ARTICLE] });
  const { code, err } = await w.run({
    unmeasuredOf: async () => {
      throw new Error('git cannot describe the tree');
    },
  });
  assert.equal(code, 0);
  assert.deepEqual(err, [
    '::warning::live entry: whether the tree was measured is unknown: git cannot describe the tree',
  ]);
  const [message] = w.posted();
  assert.doesNotMatch(message.text, /Lighthouse/);
  assert.deepEqual(w.state(), { announced: { '/blog/a-post': AT } });
});

test('a publish with no new entry does not look at the tree', async (t) => {
  const w = await world(t, { entries: [ARTICLE], state: ANNOUNCED });
  const { code } = await w.run({
    unmeasuredOf: async () => {
      throw new Error('must not be asked');
    },
  });
  assert.equal(code, 0);
});
