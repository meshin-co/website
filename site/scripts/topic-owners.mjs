import { readEngineConfig } from './engine-config.mjs';
import { tablesIn } from './markdown-table.mjs';
import { unticked } from './report-reading.mjs';
import { familyFor } from './semantic-core.mjs';

const { formats } = readEngineConfig().content;

export const ROUTE_PREFIX = { term: formats.term.routePrefix, article: formats.article.routePrefix };

export const routeOf = (format, slug) => `${ROUTE_PREFIX[format]}${slug}`;

export function readConceptRegister(coreDoc) {
  const table = tablesIn(typeof coreDoc === 'string' ? coreDoc : '').find(
    ({ header }) => header.includes('Concept') && header.includes('Defined by')
  );
  if (!table) return [];
  const [conceptAt, routeAt] = ['Concept', 'Defined by'].map((name) => table.header.indexOf(name));
  return table.rows
    .map((cells) => ({ concept: (cells[conceptAt] ?? '').trim(), route: unticked(cells[routeAt] ?? '') }))
    .filter(({ concept, route }) => concept !== '' && route.startsWith('/'));
}

const fold = (word) => (word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word);

const phrase = (text) =>
  ` ${text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .map(fold)
    .join(' ')} `;

const namesOf = ({ concept, route }) =>
  [...new Set([phrase(concept), phrase(route.split('/').pop())])].filter((name) => name.trim() !== '');

export function registerOwner(concepts, text) {
  const haystack = phrase(text ?? '');
  const hits = concepts.flatMap((entry) =>
    namesOf(entry)
      .filter((name) => haystack.includes(name))
      .map((name) => ({ entry, length: name.length }))
  );
  hits.sort((first, second) => second.length - first.length);
  return hits[0]?.entry ?? null;
}

export const servedBy = (format, routes) =>
  routes.find((route) => typeof route === 'string' && familyFor(route) === format) ?? null;

const registerRefusal = ({ query }, concepts) => {
  const owner = registerOwner(concepts, query);
  if (!owner) return null;
  return {
    reason: 'register-owner',
    against: owner.route,
    route: owner.route,
    detail: `the query "${query}" names the concept "${owner.concept}", which the concept register of docs/SEMANTIC-CORE.md assigns to ${owner.route}`,
  };
};

const servedRefusal = ({ format }, promptRoutes) => {
  const route = servedBy(format, promptRoutes);
  if (!route) return null;
  return {
    reason: 'family-served',
    against: route,
    route,
    detail: `the prompt already lists ${route} among its routes and that route is in the ${format} family, so another ${format} would answer the same prompt twice`,
  };
};

const routeRefusal = ({ format, slug }, generated) => {
  const route = routeOf(format, slug);
  if (!generated.some((row) => row.route === route)) return null;
  return {
    reason: 'route-exists',
    against: route,
    route,
    detail: `the slug "${slug}" would publish at ${route}, which the generated layer of docs/SEMANTIC-CORE.md already lists`,
  };
};

export const ownerRefusal = ({ topic, concepts, promptRoutes, generated }) =>
  registerRefusal(topic, concepts) ?? servedRefusal(topic, promptRoutes) ?? routeRefusal(topic, generated);
