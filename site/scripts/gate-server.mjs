import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { createGzip } from 'node:zlib';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.mjs', '.json', '.txt', '.xml', '.svg']);

export function resolveFile(requestPath) {
  const [pathOnly] = requestPath.split('?');
  let decoded;
  try {
    decoded = decodeURIComponent(pathOnly);
  } catch {
    return null;
  }
  if (decoded.split('/').includes('..')) return null;
  const trimmed = normalize(decoded).replace(/^\/+/, '');
  if (trimmed === '' || trimmed.endsWith('/')) return `${trimmed}index.html`;
  return extname(trimmed) === '' ? `${trimmed}/index.html` : trimmed;
}

export function acceptsGzip(acceptEncoding) {
  return (
    typeof acceptEncoding === 'string' && acceptEncoding.split(',').some((token) => token.trim().startsWith('gzip'))
  );
}

export function contentTypeFor(file) {
  return TYPES[extname(file)] ?? 'application/octet-stream';
}

export function headerRulesFor(headersFile) {
  const rules = [];
  for (const line of headersFile.split('\n')) {
    if (line.trim() === '') continue;
    if (!line.startsWith(' ') && !line.startsWith('\t')) {
      rules.push({ pattern: line.trim(), headers: [] });
      continue;
    }
    const [name, ...rest] = line.trim().split(':');
    if (rules.length > 0) rules[rules.length - 1].headers.push([name.trim(), rest.join(':').trim()]);
  }
  return rules;
}

function matchingHeaders(rules, requestPath) {
  const applied = [];
  for (const rule of rules) {
    const pattern = new RegExp(`^${rule.pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
    if (pattern.test(requestPath)) applied.push(...rule.headers);
  }
  return applied;
}

export function startGateServer({ root, port = 0, headersPath }) {
  const rootDir = resolve(root);
  const rules = headersPath && existsSync(headersPath) ? headerRulesFor(readFileSync(headersPath, 'utf8')) : [];

  const server = createServer((request, response) => {
    const file = resolveFile(request.url ?? '/');
    const target = file === null ? null : join(rootDir, file);
    if (target === null || !target.startsWith(rootDir) || !existsSync(target) || !statSync(target).isFile()) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('not found');
      return;
    }

    const headers = { 'Content-Type': contentTypeFor(file) };
    for (const [name, value] of matchingHeaders(rules, `/${file}`.replace(/index\.html$/, ''))) headers[name] = value;

    const gzip = acceptsGzip(request.headers['accept-encoding']) && COMPRESSIBLE.has(extname(file));
    if (gzip) {
      headers['Content-Encoding'] = 'gzip';
      headers.Vary = 'Accept-Encoding';
      response.writeHead(200, headers);
      createReadStream(target)
        .pipe(createGzip({ level: 9 }))
        .pipe(response);
      return;
    }

    headers['Content-Length'] = String(statSync(target).size);
    response.writeHead(200, headers);
    createReadStream(target).pipe(response);
  });

  return new Promise((resolvePromise) => {
    server.listen(port, '127.0.0.1', () => resolvePromise({ server, port: server.address().port }));
  });
}

if (import.meta.filename === process.argv[1]) {
  const port = Number(process.env.GATE_SERVER_PORT ?? 4330);
  const { port: bound } = await startGateServer({
    root: process.argv[2] ?? 'dist',
    port,
    headersPath: join(process.argv[2] ?? 'dist', '_headers'),
  });
  console.log(`gate server listening on http://127.0.0.1:${bound}`);
}
