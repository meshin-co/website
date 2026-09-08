const ENTRY_PARENTS = new Set(['blog', 'services', 'resources', 'glossary', 'case-studies', 'blog/category']);

export function templateOf(route) {
  const parts = route.split('/').filter(Boolean);
  if (parts.length === 0) return '/';

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
