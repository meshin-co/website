import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

import { classifyFindings, MIN_TARGET, renderSweep, WIDTHS } from './polish-sweep.mjs';
import { generatorRevision } from './report.mjs';

const PORT = Number(process.env.GATE_SERVER_PORT ?? 4340);
const OUT = '../audits/phase-5/polish-sweep.md';

const probe = (MIN_TARGET) => {
  const visible = (el) => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  };
  const hiddenForSighted = (el) => {
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return (rect.width <= 1 && rect.height <= 1) || style.clipPath.includes('inset(50%)');
  };
  const inProse = (el) => {
    const parent = el.parentElement;
    if (!parent) return false;
    const proseTag = ['P', 'LI', 'TD', 'TH', 'DD', 'FIGCAPTION', 'BLOCKQUOTE'].includes(parent.tagName);
    return proseTag && getComputedStyle(el).display.startsWith('inline');
  };

  const targets = [...document.querySelectorAll('a[href], button, input, select, summary, [role="button"]')]
    .filter(visible)
    .filter((el) => !hiddenForSighted(el) && !inProse(el))
    .map((el) => ({
      label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40),
      ...el.getBoundingClientRect().toJSON(),
    }))
    .filter((box) => box.width < MIN_TARGET || box.height < MIN_TARGET)
    .map((box) => ({ label: box.label, w: box.width, h: box.height }));

  const clipped = [...document.querySelectorAll('h1, h2, h3, p, li, td, th, button, a')]
    .filter(visible)
    .filter((el) => !hiddenForSighted(el))
    .filter((el) => el.scrollWidth - el.clientWidth > 2 && getComputedStyle(el).overflow !== 'visible')
    .map((el) => ({ tag: el.tagName, text: (el.textContent || '').trim() }));

  const ids = [...document.querySelectorAll('[id]')].map((el) => el.id);
  const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];

  return {
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    smallTargets: targets,
    clipped,
    duplicateIds,
  };
};

async function main() {
  const routes = JSON.parse(readFileSync('dist/gate-routes.json', 'utf8')).routes;
  const browser = await chromium.launch();
  const findings = [];

  for (const width of WIDTHS) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    for (const route of routes) {
      await page.goto(`http://127.0.0.1:${PORT}${route}`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      findings.push(...classifyFindings({ route, width, ...(await page.evaluate(probe, MIN_TARGET)) }));
    }
    await context.close();
    console.log(`swept ${routes.length} routes at ${width}px, ${findings.length} findings so far`);
  }

  await browser.close();
  mkdirSync('../audits/phase-5', { recursive: true });
  writeFileSync(
    OUT,
    renderSweep({ routes: routes.length, widths: WIDTHS, findings, revision: generatorRevision(OUT) })
  );
  console.log(`polish sweep: ${findings.length} findings -> ${OUT}`);
}

await main();
