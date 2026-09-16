import assert from 'node:assert/strict';
import { test } from 'node:test';

import { classify, competitorHosts, providerRoster, renderProbe, resolveCitationHosts } from './geo-probe.mjs';

test('a citation whose host is ours is cited, the strongest verdict', () => {
  const verdict = classify({
    text: 'One option is meshin.co.',
    citations: ['https://meshin.co/services', 'https://example.com/x'],
  });
  assert.equal(verdict.status, 'cited');
  assert.deepEqual(verdict.ourCitations, ['https://meshin.co/services']);
});

test('a www or subdomain citation still counts as ours', () => {
  assert.equal(classify({ text: '', citations: ['https://www.meshin.co/'] }).status, 'cited');
});

test('a lookalike host is never ours, because meshin.co.evil.com is a different site', () => {
  assert.equal(classify({ text: '', citations: ['https://meshin.co.evil.com/'] }).status, 'absent');
});

test('the name in prose without a citation is mentioned, not cited', () => {
  assert.equal(classify({ text: 'Dmitri Meshin works as a fractional CAIO.', citations: [] }).status, 'mentioned');
  assert.equal(classify({ text: 'See meshin.co for details.', citations: [] }).status, 'mentioned');
});

test('neither name nor citation is absent', () => {
  assert.equal(classify({ text: 'Try Accenture or Deloitte.', citations: ['https://deloitte.com'] }).status, 'absent');
});

test('competitor hosts are deduplicated and exclude our own', () => {
  assert.deepEqual(competitorHosts(['https://a.com/x', 'https://a.com/y', 'https://meshin.co/', 'https://b.io/z']), [
    'a.com',
    'b.io',
  ]);
});

test('a provider with no key is reported as skipped, never silently dropped', () => {
  const roster = providerRoster({ OPENAI_API_KEY: 'x' });
  const openai = roster.find((entry) => entry.id === 'openai');
  const anthropic = roster.find((entry) => entry.id === 'anthropic');
  assert.equal(openai.available, true);
  assert.equal(anthropic.available, false);
  assert.equal(anthropic.keyName, 'ANTHROPIC_API_KEY');
});

test('the roster never carries a key value, only its variable name', () => {
  const roster = providerRoster({ OPENAI_API_KEY: 'sk-secret-value' });
  assert.equal(JSON.stringify(roster).includes('sk-secret-value'), false);
});

test('the report counts each verdict per provider and lists the prompts we lost', () => {
  const md = renderProbe([
    { number: 1, prompt: 'p1', provider: 'openai', status: 'cited', detail: 'https://meshin.co/' },
    { number: 1, prompt: 'p1', provider: 'sonar', status: 'absent', detail: 'a.com, b.io' },
  ]);
  assert.match(md, /openai/);
  assert.match(md, /cited: 1/);
  assert.match(md, /absent: 1/);
  assert.match(md, /a\.com/);
});

test('an answer with no citations is marked as not retrieved, because absent then means the model never looked', () => {
  const verdict = classify({ text: 'Some general advice.', citations: [] });
  assert.equal(verdict.status, 'absent');
  assert.equal(verdict.retrieved, false);
});

test('an answer with citations is marked retrieved, so a loss can be told from a non-search', () => {
  assert.equal(classify({ text: 'x', citations: ['https://a.com'] }).retrieved, true);
});

test('a grounding redirect is resolved to the host it points at, or it can never match ours', async () => {
  const resolver = async (url) => (url.includes('grounding-api-redirect') ? 'https://meshin.co/services' : url);
  const hosts = await resolveCitationHosts(
    ['https://vertexaisearch.cloud.google.com/grounding-api-redirect/ABC', 'https://plain.example/x'],
    resolver
  );
  assert.deepEqual(hosts, ['https://meshin.co/services', 'https://plain.example/x']);
});

test('a redirect that cannot be resolved keeps its original url rather than vanishing', async () => {
  const resolver = async () => {
    throw new Error('network');
  };
  const hosts = await resolveCitationHosts(
    ['https://vertexaisearch.cloud.google.com/grounding-api-redirect/ABC'],
    resolver
  );
  assert.equal(hosts.length, 1);
  assert.match(hosts[0], /vertexaisearch/);
});
