const MARKDOWN_REQUESTED = /(^|,)\s*text\/markdown\s*(;|$|,)/i;
const HAS_EXTENSION = /\.[^/]+$/;

export function wantsMarkdown(accept) {
  return MARKDOWN_REQUESTED.test(accept ?? '');
}

export function markdownSidecar(pathname) {
  if (HAS_EXTENSION.test(pathname)) return undefined;
  const route = pathname.replace(/\/+$/, '');
  return `${route === '' ? '/index' : route}.md`;
}

async function markdownResponse(request, env) {
  const sidecar = markdownSidecar(new URL(request.url).pathname);
  if (sidecar === undefined) return undefined;
  const response = await env.ASSETS.fetch(new Request(new URL(sidecar, request.url), request));
  if (!response.ok) return undefined;
  const headers = new Headers(response.headers);
  headers.set('content-type', 'text/markdown; charset=utf-8');
  headers.set('content-location', sidecar);
  headers.append('vary', 'Accept');
  return new Response(response.body, { status: response.status, headers });
}

export default {
  async fetch(request, env) {
    try {
      if (request.method === 'GET' && wantsMarkdown(request.headers.get('accept'))) {
        const markdown = await markdownResponse(request, env);
        if (markdown !== undefined) return markdown;
      }
    } catch {
      return env.ASSETS.fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
};
