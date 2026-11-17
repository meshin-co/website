import { SERIES_BASES } from './route-kinds.mjs';

const ENTRY_PARENTS = new Set(['blog', 'services', 'resources', 'glossary', 'case-studies', 'blog/category']);
const SERIES_SLOTS = [':series', ':entry'];

export function templateOf(route) {
  const parts = route.split('/').filter(Boolean);
  if (parts.length === 0) return '/';

  const [base, ...rest] = parts;
  if (SERIES_BASES.has(base) && rest.length > 0 && rest.length <= SERIES_SLOTS.length) {
    return `/${[base, ...SERIES_SLOTS.slice(0, rest.length)].join('/')}`;
  }

  const parent = parts.slice(0, -1).join('/');
  if (parent && ENTRY_PARENTS.has(parent)) return `/${parent}/:entry`;
  return `/${parts.join('/')}`;
}

export function templateRoutes(routes) {
  const firstOfTemplate = new Map();
  for (const route of [...routes].sort()) {
    const template = templateOf(route);
    if (!firstOfTemplate.has(template)) firstOfTemplate.set(template, route);
  }
  return [...firstOfTemplate.values()].sort();
}
