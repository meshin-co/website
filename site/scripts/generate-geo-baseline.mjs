import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { withProvenance } from './evidence-gate.mjs';
import { parsePrompts, renderBaseline, scorePrompt } from './geo-baseline.mjs';
import { generatorRevision } from './report.mjs';
import { invokedDirectly } from './invoked-directly.mjs';

const CORE = '../docs/SEMANTIC-CORE.md';
const OUT = '../audits/geo-baseline.md';

function pagesFrom(dist) {
  const routes = JSON.parse(readFileSync(join(dist, 'gate-routes.json'), 'utf8')).routes;
  const llms = readFileSync(join(dist, 'llms.txt'), 'utf8');
  const pages = {};
  for (const route of routes) {
    const file = join(dist, route === '/' ? 'index.html' : `${route.slice(1)}.html`);
    if (!existsSync(file)) continue;
    const html = readFileSync(file, 'utf8');
    const main = /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(html)?.[1] ?? html;
    pages[route] = {
      text: main.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' '),
      hasShortAnswer: /data-answer|data-gate-lead/.test(main),
      hasJsonLd: /application\/ld\+json/.test(html),
      inLlms: llms.includes(`${route}`),
    };
  }
  return pages;
}

function main(dist) {
  const prompts = parsePrompts(readFileSync(CORE, 'utf8'));
  if (prompts.length === 0) throw new Error('no buyer prompts parsed from docs/SEMANTIC-CORE.md');
  const pages = pagesFrom(dist);
  const scores = prompts.map((prompt) => scorePrompt(prompt, pages));
  writeFileSync(OUT, withProvenance(renderBaseline(scores), generatorRevision(OUT)));
  const ready = scores.filter((score) => score.state === 'ready').length;
  console.log(`geo baseline: ${ready}/${scores.length} prompts on-site ready -> ${OUT}`);
}

if (invokedDirectly(import.meta.filename, process.argv[1])) main(process.argv[2] ?? 'dist');
