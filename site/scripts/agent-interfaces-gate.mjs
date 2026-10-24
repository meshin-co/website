import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

import { publicJsonRoutes } from './gen-openapi.mjs';
import { invokedDirectly } from './invoked-directly.mjs';

const REQUIRED_SIGNALS = ['search', 'ai-train', 'ai-input'];
const REQUIRED_RELATIONS = ['api-catalog', 'service-desc', 'describedby'];
const LINK_VALUE = /^<([^>]+)>;\s*rel="([^"]+)"(?:;.*)?$/;
const AI_CATALOG_LINK = /<link\b[^>]*\brel="ai-catalog"[^>]*>/i;
const HREF = /\bhref="([^"]+)"/i;

function groupsOf(robotsText) {
  const groups = [];
  for (const line of robotsText.split('\n')) {
    const [name, ...rest] = line.split(':');
    const value = rest.join(':').trim();
    if (name === 'User-agent') groups.push({ agent: value, signals: [] });
    if (name === 'Content-Signal') groups.at(-1)?.signals.push(value);
  }
  return groups;
}

export function contentSignalGaps(robotsText) {
  return groupsOf(robotsText).flatMap(({ agent, signals }) => {
    if (signals.length === 0) return [`robots.txt: the group for ${agent} declares no Content-Signal`];
    if (signals.length > 1)
      return [`robots.txt: the group for ${agent} declares ${signals.length} Content-Signal lines`];
    const declared = new Map(signals[0].split(',').map((pair) => pair.split('=').map((part) => part.trim())));
    return REQUIRED_SIGNALS.filter((signal) => !declared.get(signal)).map(
      (signal) => `robots.txt: the group for ${agent} leaves ${signal} unsaid`
    );
  });
}

export function directiveTarget(robotsText, directive) {
  const line = robotsText.split('\n').find((candidate) => candidate.startsWith(`${directive}:`));
  return line === undefined ? undefined : new URL(line.slice(directive.length + 1).trim()).pathname;
}

export function shippedGaps(label, routes, shipped) {
  return routes
    .filter((route) => !shipped.includes(route))
    .map((route) => `${label}: ${route} is named but not shipped`);
}

export function openApiCoverageGaps(document, jsonRoutes) {
  const described = Object.keys(document.paths ?? {});
  return [
    ...described
      .filter((route) => !jsonRoutes.includes(route))
      .map((route) => `openapi.json: ${route} is described but not shipped`),
    ...jsonRoutes
      .filter((route) => !described.includes(route))
      .map((route) => `openapi.json: ${route} is shipped but undescribed`),
  ];
}

export function linksetTargets(catalog) {
  return (catalog.linkset ?? []).flatMap((entry) =>
    Object.entries(entry)
      .filter(([relation]) => relation !== 'anchor')
      .flatMap(([, links]) => (Array.isArray(links) ? links : []))
      .map(({ href }) => href)
  );
}

export function linksetShapeGaps(catalog) {
  const [entry] = catalog.linkset ?? [];
  if (entry === undefined) return ['api-catalog: the linkset is empty'];
  return [
    ...(entry.anchor ? [] : ['api-catalog: the linkset entry carries no anchor']),
    ...['service-desc', 'service-doc']
      .filter((relation) => !entry[relation])
      .map((relation) => `api-catalog: no ${relation} link`),
  ];
}

export function linkHeaderGaps(headersText, shipped) {
  const section = headersText.split('\n\n').find((block) => block.startsWith('/\n'));
  if (section === undefined) return ['_headers: the home page carries no Link rule'];
  const values = section
    .split('\n')
    .filter((line) => line.trim().startsWith('Link:'))
    .map((line) => line.trim().slice('Link:'.length).trim());
  const parsed = values.map((value) => value.match(LINK_VALUE));
  return [
    ...values
      .filter((_, index) => parsed[index] === null)
      .map((value) => `_headers: Link "${value}" is not <uri>; rel="name"`),
    ...REQUIRED_RELATIONS.filter((relation) => !parsed.some((match) => match !== null && match[2] === relation)).map(
      (relation) => `_headers: the home page declares no ${relation} link`
    ),
    ...shippedGaps(
      '_headers',
      parsed.filter((match) => match !== null).map((match) => match[1]),
      shipped
    ),
  ];
}

export function headLinkGaps(homeHtml, manifestRoute) {
  const tag = homeHtml.match(AI_CATALOG_LINK)?.[0];
  if (tag === undefined) return ['index.html: no <link rel="ai-catalog">'];
  const href = tag.match(HREF)?.[1];
  return href === manifestRoute
    ? []
    : [`index.html: the ai-catalog link points at ${href}, robots.txt points at ${manifestRoute}`];
}

export function manifestEntryGaps(manifest, shipped) {
  const entries = manifest.entries ?? [];
  if (entries.length === 0) return ['ai-catalog.json: the manifest lists no entries'];
  const identifiers = entries.map(({ identifier }) => identifier);
  const duplicates = identifiers.filter((identifier, index) => identifiers.indexOf(identifier) !== index);
  return [
    ...new Set(duplicates.map((identifier) => `ai-catalog.json: ${identifier} is listed twice`)),
    ...shippedGaps(
      'ai-catalog.json',
      entries.map(({ url }) => new URL(url).pathname),
      shipped
    ),
  ];
}

async function shippedRoutes(distDir) {
  const entries = await readdir(distDir, { withFileTypes: true, recursive: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => `/${relative(distDir, join(entry.parentPath, entry.name)).split(sep).join('/')}`);
}

export async function agentInterfaceFindings(distDir) {
  const read = (route) => readFile(join(distDir, route), 'utf8');
  const readJson = async (route) => JSON.parse(await read(route));
  const shipped = await shippedRoutes(distDir);
  const robotsText = await read('robots.txt');
  const manifestRoute = directiveTarget(robotsText, 'Agentmap');
  const catalog = await readJson('.well-known/api-catalog');
  return [
    ...contentSignalGaps(robotsText),
    ...shippedGaps('robots.txt', [manifestRoute, directiveTarget(robotsText, 'Sitemap')], shipped),
    ...openApiCoverageGaps(await readJson('openapi.json'), await publicJsonRoutes(distDir)),
    ...linksetShapeGaps(catalog),
    ...shippedGaps(
      'api-catalog',
      linksetTargets(catalog).map((href) => new URL(href).pathname),
      shipped
    ),
    ...manifestEntryGaps(await readJson(manifestRoute.slice(1)), shipped),
    ...linkHeaderGaps(await read('_headers'), shipped),
    ...headLinkGaps(await read('index.html'), manifestRoute),
  ];
}

async function main(distDir) {
  const findings = await agentInterfaceFindings(distDir);
  for (const finding of findings) console.log(`  ${finding}`);
  console.log(`agents: ${findings.length} findings`);
  if (findings.length > 0) process.exitCode = 1;
}

if (invokedDirectly(import.meta.filename, process.argv[1])) {
  await main(process.argv[2] ?? 'dist');
}
