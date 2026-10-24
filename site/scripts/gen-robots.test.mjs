import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { test } from 'node:test';

import { disallowedPaths, renderRobots } from './gen-robots.mjs';

const SITE_ROOT = fileURLToPath(new URL('..', import.meta.url));
const TRAINING_AGENTS = [
  'GPTBot',
  'ClaudeBot',
  'Google-Extended',
  'CCBot',
  'PerplexityBot',
  'Applebot-Extended',
  'meta-externalagent',
  'Bytespider',
  'Diffbot',
  'cohere-ai',
];
const RETRIEVAL_AGENTS = [
  'OAI-SearchBot',
  'Claude-SearchBot',
  'Claude-User',
  'Perplexity-User',
  'ChatGPT-User',
  'Amazonbot',
  'ImagesiftBot',
  'Timpibot',
  'YouBot',
];
const SEARCH_AGENTS = ['Googlebot', 'Bingbot', 'Applebot'];

function parseRobots(text) {
  const groups = [];
  for (const block of text.split(/\n\s*\n/)) {
    const agents = [...block.matchAll(/^User-agent:\s*(.+)$/gim)].map(([, agent]) => agent.trim().toLowerCase());
    if (agents.length === 0) continue;
    groups.push({
      agents,
      allows: [...block.matchAll(/^Allow:\s*(.+)$/gim)].map(([, path]) => path.trim()),
      disallows: [...block.matchAll(/^Disallow:\s*(.+)$/gim)].map(([, path]) => path.trim()),
      signals: [...block.matchAll(/^Content-Signal:\s*(.+)$/gim)].map(([, line]) => line.trim()),
    });
  }
  return {
    groups,
    sitemap: text.match(/^Sitemap:\s*(.+)$/im)?.[1],
    agentmap: text.match(/^Agentmap:\s*(.+)$/im)?.[1],
  };
}

function groupFor(parsed, userAgent) {
  const ua = userAgent.toLowerCase();
  return (
    parsed.groups.find((group) => group.agents.includes(ua)) ??
    parsed.groups.find((group) => group.agents.includes('*'))
  );
}

test('the star group disallows exactly search and styleguide', () => {
  const { disallows } = groupFor(parseRobots(renderRobots(['/search', '/styleguide'])), 'Googlebot');

  assert.deepEqual(disallows, ['/search', '/styleguide']);
});

test('a named group replaces the star group for that agent, so every AI and search agent repeats the star disallows', () => {
  const parsed = parseRobots(renderRobots(['/search', '/styleguide']));
  const expectedDisallows = groupFor(parsed, 'some-unknown-bot').disallows;

  for (const agent of [...TRAINING_AGENTS, ...RETRIEVAL_AGENTS, ...SEARCH_AGENTS]) {
    const group = groupFor(parsed, agent);
    assert.ok(group, `${agent} has no group`);
    assert.deepEqual(group.allows, ['/'], `${agent} must be allowed site-wide`);
    assert.deepEqual(group.disallows, expectedDisallows, `${agent} must repeat the star disallows`);
  }
});

test('an unlisted agent resolves to the star group', () => {
  const parsed = parseRobots(renderRobots(['/search', '/styleguide']));
  const star = parsed.groups.find((group) => group.agents.includes('*'));

  assert.equal(groupFor(parsed, 'SomeUnlistedBot'), star);
  assert.equal(groupFor(parsed, 'RandomCrawler'), star);
});

test('the crawler register names exactly this pinned set of agents, in this order, so silence is never a decision', () => {
  const parsed = parseRobots(renderRobots(['/search', '/styleguide']));

  assert.deepEqual(
    parsed.groups.map((group) => group.agents[0]),
    [
      '*',
      'gptbot',
      'claudebot',
      'google-extended',
      'ccbot',
      'perplexitybot',
      'applebot-extended',
      'meta-externalagent',
      'bytespider',
      'diffbot',
      'cohere-ai',
      'oai-searchbot',
      'claude-searchbot',
      'claude-user',
      'perplexity-user',
      'chatgpt-user',
      'amazonbot',
      'imagesiftbot',
      'timpibot',
      'youbot',
      'googlebot',
      'bingbot',
      'applebot',
    ]
  );
});

test('blog tag routes stay crawlable for every agent (L31)', () => {
  const parsed = parseRobots(renderRobots(['/search', '/styleguide']));

  for (const group of parsed.groups) {
    const blocker = group.disallows.find((path) => '/blog/tag/x'.startsWith(path));
    assert.ok(!blocker, `tag route blocked by ${group.agents[0]} via ${blocker}`);
  }
});

test('the sitemap line points at the sitemap index', () => {
  assert.equal(parseRobots(renderRobots(['/search', '/styleguide'])).sitemap, 'https://meshin.co/sitemap-index.xml');
});

test('every group carries one Content-Signal line declaring search, ai-train and ai-input as yes', () => {
  const { groups } = parseRobots(renderRobots(['/search', '/styleguide']));

  for (const group of groups) {
    assert.deepEqual(
      group.signals,
      ['search=yes, ai-train=yes, ai-input=yes'],
      `${group.agents[0]} must carry the content signal`
    );
  }
});

test('the number of Content-Signal lines equals the number of User-agent lines, so a new group cannot omit it', () => {
  const text = renderRobots(['/search', '/styleguide']);
  const userAgents = text.match(/^User-agent:/gm) ?? [];
  const signals = text.match(/^Content-Signal:/gm) ?? [];

  assert.ok(userAgents.length > 0);
  assert.equal(signals.length, userAgents.length);
});

test('the Content-Signal line sits inside its group, directly after the User-agent line', () => {
  const blocks = renderRobots(['/search', '/styleguide'])
    .split(/\n\s*\n/)
    .filter((block) => block.startsWith('User-agent:'));

  assert.ok(blocks.length > 0);
  for (const block of blocks) {
    assert.match(block.split('\n')[1], /^Content-Signal: /);
  }
});

test('the Agentmap line is an absolute URL to the ai-catalog on the same origin as the sitemap', () => {
  const { agentmap, sitemap } = parseRobots(renderRobots(['/search', '/styleguide']));

  assert.ok(agentmap, 'Agentmap line missing');
  assert.equal(new URL(agentmap).pathname, '/.well-known/ai-catalog.json');
  assert.equal(new URL(agentmap).origin, new URL(sitemap).origin);
  assert.match(agentmap, /^https:\/\//);
});

test('disallowedPaths picks up an api directory only when one exists', async () => {
  const withApi = await mkdtemp(join(tmpdir(), 'gen-robots-'));
  await mkdir(join(withApi, 'api'));
  const withoutApi = await mkdtemp(join(tmpdir(), 'gen-robots-'));
  await writeFile(join(withoutApi, 'index.astro'), '');

  assert.deepEqual(disallowedPaths(withApi), ['/search', '/styleguide', '/api']);
  assert.deepEqual(disallowedPaths(withoutApi), ['/search', '/styleguide']);
});

test('the committed robots.txt equals the generator output for the real pages directory', async () => {
  const committed = await readFile(join(SITE_ROOT, 'public', 'robots.txt'), 'utf8');
  const generated = renderRobots(disallowedPaths(join(SITE_ROOT, 'src', 'pages')));

  assert.equal(committed, generated);
});
