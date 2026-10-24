import { extractGraphs, ownsNode } from './jsonld-gate.mjs';

const EDITORIAL_INSTANT = /^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/;
const LEADING_DAY = /^\d{4}-\d{2}-\d{2}/;
const FURTHEST_AHEAD_MS = 14 * 60 * 60 * 1000;
const NO_STATIC_ROUTE = 'no static route carries an updatedDate, so no date was compared';

export const sidecarUpdated = (text) => /^Updated: (\d{4}-\d{2}-\d{2})$/m.exec(text ?? '')?.[1] ?? null;

export function jsonLdModified(route, html) {
  return extractGraphs(html)
    .flatMap((document) => document['@graph'] ?? [document])
    .filter((node) => node.dateModified !== undefined && ownsNode(route, node))
    .map((node) => ({ type: [node['@type']].flat().join('/'), value: String(node.dateModified) }));
}

const listed = (items) =>
  items.length < 3 ? items.join(' and ') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

const jsonLdLabel = ({ type, value }) => `JSON-LD dateModified ${value} (${type})`;

function statedValues({ jsonLd, lastmod, updated }) {
  const labels = jsonLd.length > 0 ? jsonLd.map(jsonLdLabel) : ['JSON-LD dateModified MISSING'];
  return [...labels, `sitemap lastmod ${lastmod ?? 'MISSING'}`, `sidecar Updated ${updated ?? 'MISSING'}`].join(', ');
}

function problemsOf({ isStatic, jsonLd, lastmod, updated, now }) {
  const problems = [];

  const missing = [
    jsonLd.length === 0 && 'its JSON-LD',
    !lastmod && 'its sitemap entry',
    !updated && 'its sidecar',
  ].filter(Boolean);
  if (isStatic && missing.length > 0) problems.push(`has no modified date in ${listed(missing)}`);

  const days = [...jsonLd.map(({ value }) => value), lastmod, updated]
    .map((value) => LEADING_DAY.exec(value ?? '')?.[0])
    .filter(Boolean);
  if (new Set(days).size > 1) problems.push('modified dates disagree');

  const clocks = [
    ...(lastmod ? [{ label: `sitemap lastmod ${lastmod}`, value: lastmod }] : []),
    ...jsonLd.map((entry) => ({ label: jsonLdLabel(entry), value: entry.value })),
  ].filter(({ value }) => !EDITORIAL_INSTANT.test(value));
  for (const { label } of clocks) problems.push(`${label} is not an editorial date (midnight UTC)`);

  if (lastmod && Date.parse(lastmod) > now + FURTHEST_AHEAD_MS) {
    problems.push(`sitemap lastmod ${lastmod} is in the future (more than 14 hours ahead of the clock)`);
  }
  return problems;
}

export function dateAgreementFailures({ lastmods, htmlByRoute, sidecarTextByRoute, staticRoutes, now = Date.now() }) {
  if (staticRoutes.length === 0) return [NO_STATIC_ROUTE];

  const failures = [];
  for (const route of new Set([...staticRoutes, ...lastmods.keys()])) {
    let jsonLd;
    try {
      jsonLd = jsonLdModified(route, htmlByRoute[route] ?? '');
    } catch {
      failures.push(`${route} carries an ld+json block that does not parse, so its dateModified was not compared`);
      continue;
    }

    const stated = { jsonLd, lastmod: lastmods.get(route) ?? null, updated: sidecarUpdated(sidecarTextByRoute[route]) };
    const problems = problemsOf({ ...stated, isStatic: staticRoutes.includes(route), now });
    if (problems.length > 0) failures.push(`${route} ${listed(problems)}: ${statedValues(stated)}`);
  }
  return failures;
}
