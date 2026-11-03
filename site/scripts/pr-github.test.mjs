import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LedgerError } from './autowriter-ledger.mjs';
import { scenario, withHead, withoutPullRequestRun } from './fixtures/pr-watch.mjs';
import { GitHubError, createApi } from './pr-github.mjs';
import {
  REPO,
  ROOT,
  HEAD,
  LEDGER_FILINGS,
  LEDGER_PATH,
  NOT_THE_LEDGER,
  json,
  apiAnswering,
  ledgerAt,
  ledgerBody,
  snapshotOf,
  own,
  aLedger,
  treeListing,
} from './fixtures/github-fake.mjs';
import { autowriterAgent } from './site-brand.mjs';

test('a request goes to the repository url with the github headers', async () => {
  const { api, calls } = apiAnswering(() => json({}));

  await api.get('pulls/1?per_page=100');

  assert.equal(calls[0].url, `${ROOT}pulls/1?per_page=100`);
  assert.equal(calls[0].method, 'GET');
  assert.deepEqual(calls[0].headers, {
    Authorization: 'Bearer secret',
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': autowriterAgent(),
  });
  assert.equal(calls[0].body, undefined);
});

test('a post carries its body as json with a content type', async () => {
  const { api, calls } = apiAnswering(() => json({}));

  await api.post('issues', { title: 'x' });

  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].headers['Content-Type'], 'application/json');
  assert.equal(calls[0].body, '{"title":"x"}');
});

test('a put carries its body as json with the put method', async () => {
  const { api, calls } = apiAnswering(() => json({}));

  await api.put('contents/a.json', { content: 'eA==' });

  assert.equal(calls[0].method, 'PUT');
  assert.equal(calls[0].body, '{"content":"eA=="}');
});

test('every request carries a timeout signal', async () => {
  const { api, calls } = apiAnswering(() => json({}));

  await api.get('a');
  await api.post('b', {});

  assert.ok(calls.every(({ signal }) => signal instanceof AbortSignal));
});

test('a 204 answer resolves null', async () => {
  const { api } = apiAnswering(() => new Response(null, { status: 204 }));

  assert.equal(await api.post('actions/workflows/w/dispatches', {}), null);
});

test('a non-2xx answer throws a github error carrying method, path, status and body', async () => {
  const { api } = apiAnswering(() => json({ message: 'Bad credentials' }, 401));

  await assert.rejects(api.get('pulls/1'), (error) => {
    assert.ok(error instanceof GitHubError);
    assert.equal(error.method, 'GET');
    assert.equal(error.path, 'pulls/1');
    assert.equal(error.status, 401);
    assert.deepEqual(error.body, { message: 'Bad credentials' });
    assert.equal(error.message, 'GitHub GET pulls/1 answered 401: Bad credentials');
    return true;
  });
});

test('a non-json error body is kept as text', async () => {
  const { api } = apiAnswering(() => new Response('upstream down', { status: 502 }));

  await assert.rejects(api.put('a', {}), (error) => {
    assert.equal(error.body, 'upstream down');
    assert.equal(error.message, 'GitHub PUT a answered 502: upstream down');
    return true;
  });
});

test('a blank token is refused', () => {
  for (const token of ['', '  ', undefined]) {
    assert.throws(() => createApi({ repo: REPO, token, fetch: async () => json({}) }), /^Error: github: no token$/);
  }
});

test('a snapshot carries every list and no ledger for a branch the watcher does not own', async () => {
  const bundle = scenario('green');

  const { snapshot } = await snapshotOf(bundle);

  assert.deepEqual(snapshot, {
    pullRequest: bundle.pullRequest,
    commits: bundle.commits,
    checkRuns: bundle.checkRuns,
    runs: bundle.runs,
    jobs: bundle.jobs,
    ledger: null,
  });
});

test('a snapshot reads the pull request first and last', async () => {
  const bundle = scenario('green');

  const { paths } = await snapshotOf(bundle);

  const pull = `pulls/${bundle.pullRequest.number}`;
  assert.equal(paths[0], pull);
  assert.equal(paths.at(-1), pull);
  assert.equal(paths.filter((path) => path === pull).length, 2);
});

test('a snapshot asks for the check runs and the workflow runs of the head', async () => {
  const bundle = scenario('green');
  const head = bundle.pullRequest.head.sha;

  const { paths } = await snapshotOf(bundle);

  assert.ok(paths.includes(`commits/${head}/check-runs?per_page=100`));
  assert.ok(paths.includes(`actions/runs?head_sha=${head}&per_page=100`));
  assert.ok(paths.includes(`pulls/${bundle.pullRequest.number}/commits?per_page=100`));
});

test('a snapshot asks for the latest jobs of the pull request run', async () => {
  const bundle = scenario('green');
  const run = bundle.runs.workflow_runs.find(({ event }) => event === 'pull_request');

  const { paths } = await snapshotOf(bundle);

  assert.ok(paths.includes(`actions/runs/${run.id}/jobs?filter=latest&per_page=100`));
});

test('a snapshot asks for no jobs when there is no pull request run', async () => {
  const unfiltered = withoutPullRequestRun(scenario('green'));
  const bundle = { ...unfiltered, runs: { ...unfiltered.runs, total_count: unfiltered.runs.workflow_runs.length } };

  const { snapshot, paths } = await snapshotOf(bundle);

  assert.deepEqual(snapshot.jobs, { total_count: 0, jobs: [] });
  assert.ok(paths.every((path) => !path.includes('/jobs')));
});

test('a snapshot of a branch the watcher does not own reads no tree and no ledger', async () => {
  const { paths } = await snapshotOf(scenario('green'));

  assert.ok(paths.every((path) => !path.startsWith('contents/') && !path.startsWith('git/trees/')));
});

test('a snapshot of an owned branch lists the tree of the head, then reads the ledger it finds there', async () => {
  const bundle = own(scenario('green'));
  const head = bundle.pullRequest.head.sha;

  const { paths } = await snapshotOf(bundle, { tree: [LEDGER_PATH] });

  const listing = paths.indexOf(`git/trees/${head}?recursive=1`);
  const reading = paths.indexOf(`contents/${LEDGER_PATH}?ref=${head}`);
  assert.ok(listing >= 0 && reading > listing, paths.join('\n'));
});

test('a head that moved between the two pull request reads is returned as the second payload', async () => {
  const bundle = own(scenario('green'));
  const moved = withHead(bundle, HEAD).pullRequest;

  const { snapshot } = await snapshotOf(bundle, { second: moved });

  assert.equal(snapshot.pullRequest.head.sha, HEAD);
});

test('a ledger that is not in the tree is null, and nothing is read for it', async () => {
  const { snapshot, paths } = await snapshotOf(own(scenario('green')));

  assert.equal(snapshot.ledger, null);
  assert.ok(paths.every((path) => !path.startsWith('contents/')));
});

test('another slug, a claim, a generation record and a page of the same name are not the ledger', async () => {
  const { snapshot, paths } = await snapshotOf(own(scenario('green')), { tree: NOT_THE_LEDGER });

  assert.equal(snapshot.ledger, null);
  assert.ok(paths.every((path) => !path.startsWith('contents/')));
});

test('a ledger that the tree lists but the contents no longer find is null', async () => {
  const { snapshot } = await snapshotOf(own(scenario('green')), { tree: [LEDGER_PATH] });

  assert.equal(snapshot.ledger, null);
});

for (const [place, path] of Object.entries(LEDGER_FILINGS)) {
  test(`a valid ledger filed ${place} is found by its slug and comes back with its blob sha and the path found`, async () => {
    const ledger = aLedger();
    const bundle = own(scenario('green'));

    const { snapshot, paths } = await snapshotOf(bundle, {
      tree: [...NOT_THE_LEDGER, path],
      ledger: ledgerAt(path, ledger),
    });

    assert.deepEqual(snapshot.ledger, { value: ledger, blobSha: 'blob-9', path });
    assert.deepEqual(
      paths.filter((asked) => asked.startsWith('contents/')),
      [`contents/${path}?ref=${bundle.pullRequest.head.sha}`]
    );
  });
}

test('a ledger filed twice fails loudly, naming both files, because the tree cannot say which of them is the ledger', async () => {
  await assert.rejects(snapshotOf(own(scenario('green')), { tree: [LEDGER_PATH, LEDGER_FILINGS.flat] }), (error) => {
    assert.match(error.message, /ledger a-slug is filed more than once/);
    assert.ok(error.message.includes(LEDGER_PATH) && error.message.includes(LEDGER_FILINGS.flat), error.message);
    return true;
  });
});

test('a tree GitHub cut short fails the snapshot, and is never read as a branch without a ledger', async () => {
  const cut = () => treeListing([LEDGER_PATH], { truncated: true });

  await assert.rejects(snapshotOf(own(scenario('green')), { tree: cut }), /incomplete/);
});

test('a ledger that is not json fails loudly', async () => {
  const text = () => json({ content: Buffer.from('{oops').toString('base64'), sha: 's', encoding: 'base64' });

  await assert.rejects(snapshotOf(own(scenario('green')), { tree: [LEDGER_PATH], ledger: text }), (error) => {
    assert.ok(error instanceof LedgerError);
    assert.match(error.problems[0], /^is not JSON: /);
    return true;
  });
});

test('a ledger that breaks the schema fails loudly', async () => {
  const broken = () => ledgerBody({ ...aLedger(), attempts: 'many' });

  await assert.rejects(snapshotOf(own(scenario('green')), { tree: [LEDGER_PATH], ledger: broken }), LedgerError);
});

test('a ledger whose slug differs from its file name fails loudly', async () => {
  const other = () => ledgerBody(aLedger('other-slug'));

  await assert.rejects(snapshotOf(own(scenario('green')), { tree: [LEDGER_PATH], ledger: other }), (error) => {
    assert.ok(error instanceof LedgerError);
    assert.match(error.message, /does not match the file name a-slug\.json/);
    return true;
  });
});

test('a hundred commits are refused as an incomplete list', async () => {
  const bundle = scenario('green');
  const full = { ...bundle, commits: Array.from({ length: 100 }, () => bundle.commits[0]) };

  await assert.rejects(snapshotOf(full), /commits.*incomplete.*more than one page/s);
});

test('a check run total beyond the page is refused as an incomplete list', async () => {
  const bundle = scenario('green');
  const cut = { ...bundle, checkRuns: { ...bundle.checkRuns, total_count: 101 } };

  await assert.rejects(snapshotOf(cut), /check runs.*incomplete.*more than one page/s);
});

test('a workflow run total beyond the page is refused as an incomplete list', async () => {
  const bundle = scenario('green');
  const cut = { ...bundle, runs: { ...bundle.runs, total_count: 101 } };

  await assert.rejects(snapshotOf(cut), /workflow runs.*incomplete.*more than one page/s);
});

test('a job total beyond the page is refused as an incomplete list', async () => {
  const bundle = scenario('green');
  const cut = { ...bundle, jobs: { ...bundle.jobs, total_count: 101 } };

  await assert.rejects(snapshotOf(cut), /jobs.*incomplete.*more than one page/s);
});
