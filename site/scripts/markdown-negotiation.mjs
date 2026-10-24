const NEGOTIABLE = new Set(['GET', 'HEAD']);
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
  return new Response(request.method === 'HEAD' ? null : response.body, { status: response.status, headers });
}

async function pageResponse(request, env) {
  const response = await env.ASSETS.fetch(request);
  if (markdownSidecar(new URL(request.url).pathname) === undefined) return response;
  const varied = new Response(response.body, response);
  varied.headers.append('vary', 'Accept');
  return varied;
}

export default {
  async fetch(request, env) {
    if (!NEGOTIABLE.has(request.method)) return env.ASSETS.fetch(request);
    try {
      if (wantsMarkdown(request.headers.get('accept'))) {
        const markdown = await markdownResponse(request, env);
        if (markdown !== undefined) return markdown;
      }
      return await pageResponse(request, env);
    } catch {
      return env.ASSETS.fetch(request);
    }
  },
};
