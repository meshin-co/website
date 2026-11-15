const NEGOTIABLE_METHODS = new Set(['GET', 'HEAD']);
const HAS_EXTENSION = /\.[^/]+$/;
const VERSION_SEGMENT = /\/\d+\.\d+$/;
const TOKEN = /^[!#$%&'*+.^_`|~\w-]+$/;
const QUOTED = /^"(?:[^"\\]|\\.)*"$/;
const QUALITY = /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/;
const ANYTHING = [{ type: '*', subtype: '*', quality: 1 }];
const PAGE = { type: 'text', subtype: 'html' };
const MARKDOWN = { type: 'text', subtype: 'markdown' };

function splitOutsideQuotes(text, separator) {
  const parts = [''];
  let quoted = false;
  let escaped = false;
  for (const char of text) {
    if (char === separator && !quoted) {
      parts.push('');
      continue;
    }
    parts[parts.length - 1] += char;
    if (escaped) escaped = false;
    else if (quoted && char === '\\') escaped = true;
    else if (char === '"') quoted = !quoted;
  }
  return parts;
}

function parseRange(text) {
  const [mediaType, ...parameters] = splitOutsideQuotes(text, ';').map((part) => part.trim());
  const [type, subtype = '', ...extra] = mediaType.toLowerCase().split('/');
  const wellFormed = TOKEN.test(type) && TOKEN.test(subtype) && extra.length === 0 && (type !== '*' || subtype === '*');
  if (!wellFormed) return undefined;
  for (const parameter of parameters) {
    if (parameter === '') continue;
    const at = parameter.indexOf('=');
    const name = parameter.slice(0, at).toLowerCase();
    const value = parameter.slice(at + 1);
    if (at < 1 || !TOKEN.test(name)) return undefined;
    if (name === 'q') return QUALITY.test(value) ? { type, subtype, quality: Number(value) } : undefined;
    if (!TOKEN.test(value) && !QUOTED.test(value)) return undefined;
  }
  return { type, subtype, quality: 1 };
}

function acceptRanges(accept) {
  if (accept === null || accept === undefined) return ANYTHING;
  return splitOutsideQuotes(accept, ',')
    .map((part) => part.trim())
    .filter((part) => part !== '')
    .map((part) => parseRange(part))
    .filter((range) => range !== undefined);
}

function specificity(range, representation) {
  if (range.type !== '*' && range.type !== representation.type) return -1;
  if (range.subtype !== '*' && range.subtype !== representation.subtype) return -1;
  return (range.type === '*' ? 0 : 1) + (range.subtype === '*' ? 0 : 1);
}

function weightOf(ranges, representation) {
  let best = { specificity: -1, quality: 0 };
  for (const range of ranges) {
    const found = specificity(range, representation);
    const outranks =
      found > best.specificity || (found === best.specificity && found >= 0 && range.quality < best.quality);
    if (outranks) best = { specificity: found, quality: range.quality };
  }
  return best.quality;
}

export function wantsMarkdown(accept) {
  const ranges = acceptRanges(accept);
  return weightOf(ranges, MARKDOWN) > weightOf(ranges, PAGE);
}

export function markdownSidecar(pathname) {
  const route = pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '');
  if (HAS_EXTENSION.test(route) && !VERSION_SEGMENT.test(route)) return undefined;
  return `${route === '' ? '/index' : route}.md`;
}

const answers = (response) => response.ok || response.status === 304;

function varyOnAccept(response) {
  const varied = new Response(response.body, response);
  varied.headers.append('vary', 'Accept');
  return varied;
}

const pageWithVary = (request, page) =>
  markdownSidecar(new URL(request.url).pathname) === undefined ? page : varyOnAccept(page);

async function markdownFor(request, env, page) {
  const sidecar = markdownSidecar(new URL(request.url).pathname);
  if (sidecar === undefined || !answers(page) || !wantsMarkdown(request.headers.get('accept'))) return undefined;
  const target = new URL(request.url);
  target.pathname = sidecar;
  target.search = '';
  const response = await env.ASSETS.fetch(new Request(target, request));
  if (!answers(response)) return undefined;
  const headers = new Headers(response.headers);
  headers.set('content-type', 'text/markdown; charset=utf-8');
  headers.set('content-location', sidecar);
  headers.append('vary', 'Accept');
  return new Response(request.method === 'HEAD' ? null : response.body, { status: response.status, headers });
}

async function negotiate(request, env) {
  const page = await env.ASSETS.fetch(request);
  const markdown = await markdownFor(request, env, page);
  if (markdown === undefined) return pageWithVary(request, page);
  await page.body?.cancel();
  return markdown;
}

export default {
  async fetch(request, env) {
    if (!NEGOTIABLE_METHODS.has(request.method)) return env.ASSETS.fetch(request);
    try {
      return await negotiate(request, env);
    } catch {
      return pageWithVary(request, await env.ASSETS.fetch(request));
    }
  },
};
