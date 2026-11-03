import assert from 'node:assert/strict';
import { test } from 'node:test';

import { issueLink, issueUrl, pullRequestLink, pullRequestUrl, runLink, runUrl } from './github-links.mjs';

const ENV = { GITHUB_SERVER_URL: 'https://github.test', GITHUB_REPOSITORY: 'owner/name', GITHUB_RUN_ID: '777' };
const without = (...names) => Object.fromEntries(Object.entries(ENV).filter(([name]) => !names.includes(name)));

test('every address is built from the server, the repository and the run the environment names', () => {
  assert.equal(runUrl(ENV), 'https://github.test/owner/name/actions/runs/777');
  assert.equal(pullRequestUrl(ENV, 84), 'https://github.test/owner/name/pull/84');
  assert.equal(issueUrl(ENV, 12), 'https://github.test/owner/name/issues/12');
});

test('another server and another repository give other addresses, so nothing is written into the code', () => {
  const other = {
    GITHUB_SERVER_URL: 'https://git.example.org/',
    GITHUB_REPOSITORY: 'someone/else',
    GITHUB_RUN_ID: '9',
  };
  assert.equal(runUrl(other), 'https://git.example.org/someone/else/actions/runs/9');
  assert.equal(pullRequestUrl(other, 1), 'https://git.example.org/someone/else/pull/1');
});

test('a server or repository that is missing or blank gives no address at all, never a guessed host', () => {
  for (const name of ['GITHUB_SERVER_URL', 'GITHUB_REPOSITORY'])
    for (const env of [{ ...ENV, [name]: '  ' }, without(name)]) {
      assert.equal(runUrl(env), null, name);
      assert.equal(pullRequestUrl(env, 5), null, name);
      assert.equal(issueUrl(env, 5), null, name);
    }
  assert.equal(runUrl({}), null);
});

test('a run that is not named gives no run address, and the other addresses still stand', () => {
  for (const env of [{ ...ENV, GITHUB_RUN_ID: ' ' }, without('GITHUB_RUN_ID')]) {
    assert.equal(runUrl(env), null);
    assert.equal(pullRequestUrl(env, 5), 'https://github.test/owner/name/pull/5');
  }
});

test('a pull request or an issue is a whole number from one, and anything else gives no address', () => {
  for (const bad of [0, -3, 1.5, NaN, '84', null, undefined]) {
    assert.equal(pullRequestUrl(ENV, bad), null, String(bad));
    assert.equal(issueUrl(ENV, bad), null, String(bad));
  }
});

test('a link is the label a person reads and the address behind it', () => {
  assert.deepEqual(runLink(ENV), { label: 'run 777', url: 'https://github.test/owner/name/actions/runs/777' });
  assert.deepEqual(pullRequestLink(ENV, 84), { label: '#84', url: 'https://github.test/owner/name/pull/84' });
  assert.deepEqual(issueLink(ENV, 12), { label: '#12', url: 'https://github.test/owner/name/issues/12' });
});

test('with no address known a pull request or an issue is still its number, and a run that is not named is nothing', () => {
  assert.deepEqual(pullRequestLink({}, 84), { label: '#84', url: null });
  assert.deepEqual(issueLink(without('GITHUB_REPOSITORY'), 12), { label: '#12', url: null });
  assert.equal(runLink(without('GITHUB_RUN_ID')), null);
  assert.deepEqual(runLink(without('GITHUB_SERVER_URL')), { label: 'run 777', url: null });
  assert.equal(pullRequestLink(ENV, 0), null);
  assert.equal(issueLink(ENV, null), null);
});
