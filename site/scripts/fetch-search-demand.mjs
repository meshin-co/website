import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { withProvenance } from './evidence-gate.mjs';
import { parsePrompts } from './geo-baseline.mjs';
import { invokedDirectly } from './invoked-directly.mjs';
import { generatorRevision } from './report.mjs';
import {
  CREDENTIAL_EXIT_CODE,
  TOKEN_URL,
  collectDemand,
  credentialsFrom,
  measuredWindow,
  queryRejection,
  queryUrl,
  signAssertion,
  tokenRejection,
  tokenRequestBody,
} from './search-demand.mjs';
import { renderDemand } from './search-demand-render.mjs';
import { buildDemand } from './search-demand-rows.mjs';

const CORE = '../docs/SEMANTIC-CORE.md';
const OUT = '../audits/search-demand.md';
const TIMEOUT_MS = 30_000;

const answer = (response) => response.json().catch(() => ({}));

const keySourceFrom = (argv) => {
  const at = argv.indexOf('--key-source');
  return at === -1 ? 'file' : argv[at + 1];
};

async function accessToken(account, source) {
  const assertion = signAssertion({ ...account, now: Math.floor(Date.now() / 1000), source });
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: tokenRequestBody(assertion),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = await answer(response);
  if (!response.ok || !body.access_token) throw tokenRejection(response.status, body, source);
  return body.access_token;
}

const poster = (token, property, source) => async (request) => {
  const response = await fetch(queryUrl(property), {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = await answer(response);
  if (!response.ok) throw queryRejection(response.status, body, property, source);
  return body;
};

async function main(source) {
  const { property, ...account } = credentialsFrom(process.env, source);
  const prompts = parsePrompts(readFileSync(CORE, 'utf8'));
  if (prompts.length === 0) throw new Error('no buyer prompts parsed from docs/SEMANTIC-CORE.md');
  const revision = generatorRevision(OUT);
  const window = measuredWindow(new Date().toISOString().slice(0, 10));

  const post = poster(await accessToken(account, source), property, source);
  const data = await collectDemand({ post, ...window });
  const model = buildDemand({ window, property, prompts, data });

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, withProvenance(renderDemand(model), revision));
  const proven = model.prompts.filter((entry) => entry.impressions > 0).length;
  console.log(
    `audit:demand: wrote ${OUT} (${model.totals.impressions} impressions; queries: ${model.queries.length}; prompts proven: ${proven} of ${prompts.length})`
  );
}

if (invokedDirectly(import.meta.filename, process.argv[1])) {
  const source = keySourceFrom(process.argv);
  if (source !== 'file' && source !== 'secret') {
    console.error('audit:demand: --key-source must be file or secret');
    process.exitCode = 2;
  } else {
    main(source).catch((error) => {
      console.error(`audit:demand: ${error.message}`);
      process.exitCode = error.credential ? CREDENTIAL_EXIT_CODE : 1;
    });
  }
}
