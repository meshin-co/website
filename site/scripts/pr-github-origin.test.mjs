import assert from 'node:assert/strict';
import test from 'node:test';

import { createApi } from './pr-github.mjs';

const REPO = 'meshin-co/website';

function recording() {
  const urls = [];
  const fetch = async (url) => {
    urls.push(url);
    return new Response('{}', { status: 200 });
  };
  return { urls, fetch };
}

test('the client asks api.github.com when it is given no origin, which is what every existing caller relies on', async () => {
  const { urls, fetch } = recording();

  await createApi({ repo: REPO, token: 't', fetch }).get('pulls/7');

  assert.deepEqual(urls, ['https://api.github.com/repos/meshin-co/website/pulls/7']);
});

test('the client asks the origin it is given, which is how GITHUB_API_URL reaches it on an enterprise host or a local fake', async () => {
  const { urls, fetch } = recording();
  const api = createApi({ repo: REPO, token: 't', fetch, origin: 'http://[::1]:4010' });

  await api.get('pulls?state=open');
  await api.post('pulls', { title: 'x' });
  await api.bytes('git/blobs/abc');

  assert.deepEqual(urls, [
    'http://[::1]:4010/repos/meshin-co/website/pulls?state=open',
    'http://[::1]:4010/repos/meshin-co/website/pulls',
    'http://[::1]:4010/repos/meshin-co/website/git/blobs/abc',
  ]);
});

test('an origin with a trailing slash is the same origin, because Actions and people both write it both ways', async () => {
  const { urls, fetch } = recording();

  await createApi({ repo: REPO, token: 't', fetch, origin: 'https://ghe.example/api/v3/' }).get('pulls/1');

  assert.deepEqual(urls, ['https://ghe.example/api/v3/repos/meshin-co/website/pulls/1']);
});

test('an origin that is not an http address is refused when the client is made, not when a request fails', () => {
  for (const origin of ['', '   ', 'api.github.com', 'ftp://example.test', 42]) {
    assert.throws(() => createApi({ repo: REPO, token: 't', origin }), /origin/, String(origin));
  }
});
