import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { brandFromDisk } from '../src/utils/brand.mjs';

const GATE = 'gate:jsonld';
const ORIGIN = `https://${brandFromDisk().name}`;
const ABOUT_PAGE = 'dist/about.html';
const NOW_PAGE = 'dist/now.html';
const DIST = 'dist';
const LD_SCRIPT = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/;

const scriptOf = (document) => `<script type="application/ld+json">${JSON.stringify(document)}</script>`;

const rewriteScript = (html, change) => {
  if (!LD_SCRIPT.test(html)) throw new Error('specimen anchor missing: the page carries no ld+json script');
  return html.replace(LD_SCRIPT, (_, body) => change(JSON.parse(body)));
};

const nodeOfType = (document, type) => {
  const node = document['@graph'].find((candidate) => candidate['@type'] === type);
  if (!node) throw new Error(`specimen anchor missing: the graph holds no ${type} node`);
  return node;
};

const editGraph = (editFile, path, change) => editFile(path, (html) => rewriteScript(html, change));

export const jsonldSpecimens = ({ editFile, moveAside }) => ({
  jsonldBreadcrumbsInASecondScript: {
    gate: GATE,
    token: 'JSONLD /about carries 2 ld+json scripts, expected one',
    plant: (copySite) =>
      editGraph(editFile, join(copySite, ABOUT_PAGE), (document) => {
        const breadcrumb = nodeOfType(document, 'BreadcrumbList');
        document['@graph'] = document['@graph'].filter((node) => node !== breadcrumb);
        return `${scriptOf(document)}${scriptOf({ '@context': document['@context'], '@graph': [breadcrumb] })}`;
      }),
  },
  jsonldNodeWithoutId: {
    gate: GATE,
    token: 'JSONLD /about has a BreadcrumbList node with no @id',
    plant: (copySite) =>
      editGraph(editFile, join(copySite, ABOUT_PAGE), (document) => {
        delete nodeOfType(document, 'BreadcrumbList')['@id'];
        return scriptOf(document);
      }),
  },
  jsonldIdDeclaredTwice: {
    gate: GATE,
    token: `JSONLD /about declares ${ORIGIN}/#person twice`,
    plant: (copySite) =>
      editGraph(editFile, join(copySite, ABOUT_PAGE), (document) => {
        document['@graph'].push(structuredClone(nodeOfType(document, 'Person')));
        return scriptOf(document);
      }),
  },
  jsonldReferenceResolvesNowhere: {
    gate: GATE,
    token: `JSONLD /about references undeclared ${ORIGIN}/about#breadcrumbs`,
    plant: (copySite) =>
      editGraph(editFile, join(copySite, ABOUT_PAGE), (document) => {
        const page = nodeOfType(document, 'ProfilePage');
        if (!page.breadcrumb) throw new Error('specimen anchor missing: the ProfilePage node carries no breadcrumb');
        page.breadcrumb = { '@id': `${ORIGIN}/about#breadcrumbs` };
        return scriptOf(document);
      }),
  },
  jsonldRouteWithoutAGraph: {
    gate: GATE,
    token: 'JSONLD /now carries no ld+json graph',
    plant: (copySite) => editFile(join(copySite, NOW_PAGE), (html) => rewriteScript(html, () => '')),
  },
  jsonldGateThatReadNothing: {
    gate: GATE,
    token: 'JSONLD no route carried a graph, so nothing was checked',
    plant: async (copySite) => {
      const dist = join(copySite, DIST);
      const restoreDist = await moveAside(dist);
      await mkdir(dist);
      return async () => {
        await rm(dist, { recursive: true, force: true });
        await restoreDist();
      };
    },
  },
});
