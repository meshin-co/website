import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

import { withProvenance } from './evidence-gate.mjs';
import { parsePrompts } from './geo-baseline.mjs';
import { classify, competitorHosts, providerRoster, renderProbe, resolveCitationHosts } from './geo-probe.mjs';
import { generatorRevision } from './report.mjs';

const CORE = process.argv[2] ?? '../docs/SEMANTIC-CORE.md';
const OUT = process.argv[3] ?? '../audits/geo-probe.md';
const LIMIT = Number(process.env.GEO_PROBE_LIMIT ?? 0);
const CONCURRENCY = Number(process.env.GEO_PROBE_CONCURRENCY ?? 4);
const TIMEOUT = 180_000;
const REVISION = generatorRevision(OUT);

const ask = {
  async openai(prompt, model) {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      signal: AbortSignal.timeout(TIMEOUT),
      headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model, tools: [{ type: 'web_search' }], input: prompt }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(`HTTP ${response.status} ${body?.error?.message ?? ''}`);
    const messages = (body.output ?? []).filter((item) => item.type === 'message');
    const text = messages
      .flatMap((item) => item.content ?? [])
      .map((part) => part.text ?? '')
      .join('\n');
    const citations = messages
      .flatMap((item) => item.content ?? [])
      .flatMap((part) => part.annotations ?? [])
      .map((annotation) => annotation.url)
      .filter(Boolean);
    return { text, citations };
  },

  async anthropic(prompt, model) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: AbortSignal.timeout(TIMEOUT),
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 4 }],
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(`HTTP ${response.status} ${body?.error?.message ?? ''}`);
    const blocks = body.content ?? [];
    const text = blocks
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n');
    const citations = [
      ...blocks
        .filter((block) => block.type === 'web_search_tool_result')
        .flatMap((block) => block.content ?? [])
        .map((result) => result.url),
      ...blocks
        .filter((block) => block.type === 'text')
        .flatMap((block) => block.citations ?? [])
        .map((citation) => citation.url),
    ].filter(Boolean);
    return { text, citations };
  },

  async gemini(prompt, model) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      signal: AbortSignal.timeout(TIMEOUT),
      headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
      }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(`HTTP ${response.status} ${body?.error?.message ?? ''}`);
    const candidate = body.candidates?.[0];
    const text = (candidate?.content?.parts ?? []).map((part) => part.text ?? '').join('\n');
    const chunks = candidate?.groundingMetadata?.groundingChunks ?? [];
    const citations = chunks.map((chunk) => chunk.web?.uri).filter(Boolean);
    const titles = chunks.map((chunk) => chunk.web?.title).filter(Boolean);
    return { text: `${text}\n${titles.join('\n')}`, citations };
  },

  async sonar(prompt, model) {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: AbortSignal.timeout(TIMEOUT),
      headers: { authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }] }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(`HTTP ${response.status} ${body?.error?.message ?? ''}`);
    const message = body.choices?.[0]?.message ?? {};
    const citations = [
      ...(body.citations ?? []),
      ...(message.annotations ?? []).map((annotation) => annotation.url_citation?.url),
    ].filter(Boolean);
    return { text: message.content ?? '', citations };
  },
};

const followRedirect = async (url) => {
  const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20_000) });
  return response.url;
};

const roster = providerRoster(process.env);
const active = roster.filter((provider) => provider.available);
const skipped = roster.filter((provider) => !provider.available);

const allPrompts = parsePrompts(readFileSync(CORE, 'utf8'));
const prompts = LIMIT > 0 ? allPrompts.slice(0, LIMIT) : allPrompts;

const jobs = prompts.flatMap((prompt) => active.map((provider) => ({ prompt, provider })));
const rows = [];
let index = 0;

const worker = async () => {
  while (index < jobs.length) {
    const job = jobs[index++];
    const { prompt, provider } = job;
    try {
      const answer = await ask[provider.id](prompt.prompt, provider.model);
      answer.citations = await resolveCitationHosts(answer.citations, followRedirect);
      const verdict = classify(answer);
      rows.push({
        number: prompt.number,
        prompt: prompt.prompt,
        provider: provider.id,
        model: provider.model,
        status: verdict.status,
        retrieved: verdict.retrieved,
        detail:
          verdict.status === 'absent'
            ? competitorHosts(answer.citations).slice(0, 4).join(', ')
            : verdict.ourCitations.join(', ') || 'named in prose',
      });
    } catch (error) {
      rows.push({
        number: prompt.number,
        prompt: prompt.prompt,
        provider: provider.id,
        model: provider.model,
        status: 'error',
        detail: String(error.message).slice(0, 120),
      });
    }
    console.log(`${rows.length}/${jobs.length} ${provider.id} #${prompt.number}`);
  }
};

await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));

rows.sort((a, b) => a.number - b.number || a.provider.localeCompare(b.provider));

const header = [
  `Engines queried: ${active.map((provider) => `${provider.id} (${provider.model}, ${provider.retrieval})`).join('; ')}.`,
  skipped.length > 0
    ? `Skipped for want of a key: ${skipped.map((provider) => `${provider.id} (${provider.keyName})`).join(', ')}.`
    : 'No engine was skipped.',
  'Keys are read from the environment at run time. This artifact records variable names only, never a value.',
].join(' ');

mkdirSync(OUT.slice(0, OUT.lastIndexOf('/')), { recursive: true });
const report = withProvenance(renderProbe(rows), REVISION);
writeFileSync(OUT, `${report}\n## Method\n\n${header}\n`);
writeFileSync(
  OUT.replace(/\.md$/, '.json'),
  `${JSON.stringify({ rows, active: active.map(({ id, model, keyName }) => ({ id, model, keyName })) }, null, 2)}\n`
);

const tally = (status) => rows.filter((row) => row.status === status).length;
console.log(
  `geo probe: ${rows.length} answers — cited ${tally('cited')}, mentioned ${tally('mentioned')}, absent ${tally('absent')}, error ${tally('error')} -> ${OUT}`
);
