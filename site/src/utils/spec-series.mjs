import { lastmod } from './lastmod.mjs';

export const SPEC_NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export const SPEC_VERSION = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/;

export const specId = ({ name, version }) => `${name}/${version}`;

const numbersOf = (version) => version.split('.').map(Number);

export function compareVersions(a, b) {
  const [majorA, minorA] = numbersOf(a);
  const [majorB, minorB] = numbersOf(b);
  return majorA - majorB || minorA - minorB;
}

const isListed = ({ data }) => !data.draft && !data.noindex;

const newestFirst = (a, b) => compareVersions(b.data.version, a.data.version);

const byName = (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

const earliest = (stamps) => stamps.reduce((a, b) => (a < b ? a : b));

const latest = (stamps) => stamps.reduce((a, b) => (a > b ? a : b));

export function groupSeries(entries) {
  const duplicated = duplicateSpecAddresses(entries);
  if (duplicated.length > 0) {
    throw new Error(`a specification address is held by more than one entry: ${duplicated.join(', ')}`);
  }
  return [...Map.groupBy(entries.filter(isListed), ({ data }) => data.name)]
    .map(([name, group]) => {
      const versions = [...group].sort(newestFirst);
      return {
        name,
        versions,
        current: versions[0],
        published: earliest(versions.map(({ data }) => new Date(data.publishDate).toISOString())),
        updated: latest(versions.map(({ data }) => lastmod(data))),
      };
    })
    .sort(byName);
}

export function duplicateSpecAddresses(entries) {
  const seen = new Map();
  for (const { data } of entries) {
    const address = `${data.name}/${data.version}`;
    seen.set(address, (seen.get(address) ?? 0) + 1);
  }
  return [...seen]
    .filter(([, count]) => count > 1)
    .map(([address]) => address)
    .sort();
}

export const CITE_TOKEN = '{spec}';

export const CITATION_HEADING = 'Cite this version';

export const CITATION_FORMS = [
  { key: 'prose', label: 'In prose' },
  { key: 'markdown', label: 'Paste-ready' },
  { key: 'file', label: 'In a file' },
];

export const seriesLabel = (name) => `${name} specification`;

export const specLabel = ({ name, version }) => `${seriesLabel(name)} ${version}`;

export const seriesDescription = (name) =>
  `Every published version of the ${name} specification, and the address to cite for each.`;

export const seriesSearchRecord = (base, { name, versions }) => ({
  href: `/${base}/${name}`,
  title: seriesLabel(name),
  description: seriesDescription(name),
  body: versions.map(({ data }) => specLabel({ name, version: data.version })).join(' '),
});

export function specCitation({ name, version, site, citeAs, citeKey }) {
  const label = specLabel({ name, version });
  const address = `${site}/spec/${name}/${version}`;
  return {
    prose: `${label}, ${address}`,
    markdown: citeAs.replaceAll(CITE_TOKEN, `[${label}](${address})`),
    file: `"${citeKey}": "${version}"`,
  };
}

export function citationMarkdown(citation) {
  const forms = CITATION_FORMS.map(({ key, label }) => `${label}:\n\n\`\`\`text\n${citation[key]}\n\`\`\``);
  return `## ${CITATION_HEADING}\n\n${forms.join('\n\n')}\n`;
}

const dayOf = (stamp) => new Date(stamp).toISOString().slice(0, 10);

export function seriesSidecarBody({ site, series }) {
  const lines = series.versions.map(({ data }) => {
    const label = specLabel({ name: series.name, version: data.version });
    const line = `- [${label}](${site}/spec/${series.name}/${data.version}), published ${dayOf(data.publishDate)}`;
    return data.version === series.current.data.version ? `${line}, current` : line;
  });
  return `${lines.join('\n')}\n`;
}
