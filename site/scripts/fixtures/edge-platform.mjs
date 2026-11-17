const HTML = 'text/html; charset=utf-8';
const MARKDOWN = 'text/markdown; charset=utf-8';

export const ORIGIN = 'https://example.com';

export const SITE = {
  '/': '<html>home</html>',
  '/index.md': '# Home',
  '/about': '<html>about</html>',
  '/about.md': '# About',
  '/services/sprint': '<html>sprint</html>',
  '/services/sprint.md': '# Sprint',
  '/spec/evals-baseline/1.0': '<html>spec</html>',
  '/spec/evals-baseline/1.0.md': '# Spec',
  '/styleguide': '<html>styleguide</html>',
  '/_astro/app.css': 'body{}',
};

export const etagFor = (path) => `"etag-${path}"`;

const typeFor = (path) => (path.endsWith('.md') ? MARKDOWN : path.endsWith('.css') ? 'text/css' : HTML);

const redirectTarget = (path) => {
  const slashless = path !== '/' && path.endsWith('/') ? path.slice(0, -1) : path;
  if (slashless === '/index' || slashless === '/index.html') return '/';
  return slashless.endsWith('.html') ? slashless.slice(0, -'.html'.length) : slashless;
};

export function pagesPlatform(files = SITE) {
  const asked = [];
  return {
    asked,
    fetch: async (request) => {
      const url = new URL(request.url);
      asked.push(url.href);
      const path = url.pathname.replace(/\/{2,}/g, '/');
      const target = redirectTarget(path);
      const redirects = target !== path;
      if (files[target] === undefined || (redirects && typeFor(target) !== HTML)) {
        return new Response('<html>not found</html>', { status: 404, headers: { 'content-type': HTML } });
      }
      if (redirects) {
        return new Response(null, { status: 308, headers: { location: `${target}${url.search}` } });
      }
      const headers = { 'content-type': typeFor(path), etag: etagFor(path), 'cache-control': 'public, max-age=0' };
      if (request.headers.get('if-none-match') === etagFor(path)) return new Response(null, { status: 304, headers });
      return new Response(request.method === 'HEAD' ? null : files[path], { status: 200, headers });
    },
  };
}

export const request = (path, accept, init = {}) =>
  new Request(`${ORIGIN}${path}`, {
    ...init,
    headers: { ...(accept === undefined ? {} : { accept }), ...init.headers },
  });
