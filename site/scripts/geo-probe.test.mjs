import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

import { readEngineConfig } from './engine-config.mjs';
import { parseEntrySource } from './entry-prose.mjs';
import {
  classify,
  competitorHosts,
  personPattern,
  providerRoster,
  renderProbe,
  resolveCitationHosts,
} from './geo-probe.mjs';
import { siteBrand } from './site-brand.mjs';

const HOST = siteBrand().name;
const { dataDirectory, formats } = readEngineConfig().content;
const AUTHOR_FILE = resolve(import.meta.dirname, '..', '..', dataDirectory, 'author', `${formats.article.author}.md`);
const AUTHOR_NAME = parseEntrySource(readFileSync(AUTHOR_FILE, 'utf8')).frontmatter.name;
const STRANGER = 'Zed Placeholder';

test('a citation whose host is ours is cited, the strongest verdict', () => {
  const verdict = classify({
    text: `One option is ${HOST}.`,
    citations: [`https://${HOST}/services`, 'https://example.com/x'],
  });
  assert.equal(verdict.status, 'cited');
  assert.deepEqual(verdict.ourCitations, [`https://${HOST}/services`]);
});

test('a www or subdomain citation still counts as ours', () => {
  assert.equal(classify({ text: '', citations: [`https://www.${HOST}/`] }).status, 'cited');
  assert.equal(classify({ text: '', citations: [`https://docs.${HOST}/`] }).status, 'cited');
});

test('a lookalike host is never ours, because the brand host followed by another domain is a different site', () => {
  assert.equal(classify({ text: '', citations: [`https://${HOST}.evil.com/`] }).status, 'absent');
});

test('the name in prose without a citation is mentioned, not cited', () => {
  assert.equal(classify({ text: `${AUTHOR_NAME} works as a fractional CAIO.`, citations: [] }).status, 'mentioned');
  assert.equal(classify({ text: `See ${HOST} for details.`, citations: [] }).status, 'mentioned');
});

test('the configured author counts however the name is cased or spaced, and a stranger does not', () => {
  const spaced = AUTHOR_NAME.split(/\s+/).join('\n  ');
  assert.equal(classify({ text: `Ask ${AUTHOR_NAME.toUpperCase()} first.`, citations: [] }).status, 'mentioned');
  assert.equal(classify({ text: `Ask ${spaced} first.`, citations: [] }).status, 'mentioned');
  assert.equal(classify({ text: `${STRANGER} works as a fractional CAIO.`, citations: [] }).status, 'absent');
});

test('a person pattern takes the whole name in any case or spacing, and nothing around it', () => {
  const pattern = personPattern('Émile  Zola');
  assert.ok(pattern.test('ask émile\nZOLA today'));
  assert.equal(pattern.test('Émile'), false);
  assert.equal(pattern.test('Xémile Zola'), false);
  assert.equal(pattern.test('Émile Zolas'), false);
});

test('a person pattern matches a name with regular expression characters literally', () => {
  const pattern = personPattern('J. R. Tolkien');
  assert.ok(pattern.test('by J. R. Tolkien.'));
  assert.equal(pattern.test('by JX RX Tolkien'), false);
});

test('an author with no name is refused, because an empty pattern would match every answer', () => {
  assert.throws(() => personPattern('  '), /names nobody/);
  assert.throws(() => personPattern(undefined), /names nobody/);
});

test('neither name nor citation is absent', () => {
  assert.equal(classify({ text: 'Try Accenture or Deloitte.', citations: ['https://deloitte.com'] }).status, 'absent');
});

test('competitor hosts are deduplicated and exclude our own', () => {
  assert.deepEqual(competitorHosts(['https://a.com/x', 'https://a.com/y', `https://${HOST}/`, 'https://b.io/z']), [
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
    { number: 1, prompt: 'p1', provider: 'openai', status: 'cited', detail: `https://${HOST}/` },
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
  const resolver = async (url) => (url.includes('grounding-api-redirect') ? `https://${HOST}/services` : url);
  const hosts = await resolveCitationHosts(
    ['https://vertexaisearch.cloud.google.com/grounding-api-redirect/ABC', 'https://plain.example/x'],
    resolver
  );
  assert.deepEqual(hosts, [`https://${HOST}/services`, 'https://plain.example/x']);
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
