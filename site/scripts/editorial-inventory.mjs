const NON_PROSE_FIELDS = new Set([
  'slug',
  'id',
  'category',
  'tags',
  'relatedTerms',
  'sources',
  'draft',
  'order',
  'icon',
  'image',
  'author',
  'canonical',
  'noindex',
]);

const DATE_OR_URL = /^(\d{4}-\d{2}-\d{2}|https?:\/\/|\/)/;

const DESIGN_TOKEN =
  /^(IBM Plex|Fraunces|SFMono|ui-(sans|serif|monospace)|system-ui)\b|(^|,\s)(sans-serif|serif|monospace)$/;

const CODE_FRAGMENT =
  /(&&|\|\||!==|===|=>|\?\?|\?\.|\$\{|\breturn\b|\bnew [A-Z]\w*\(|Array<|\.\w+\(|\)\s*,?\s*\]|---\s*$|\/\^|^\s*[;.!]|\);|\w:\s*\w+\s*$)/;

const digitHeavy = (value) => value.replace(/[^0-9]/g, '').length / value.length > 0.2;

const UTILITY_TOKEN = /^[a-z]+[-:][a-z0-9[\]/.-]+$|^[a-z]+:[a-z-]+$/;

const isUtilityClassList = (value) => {
  const tokens = value.trim().split(/\s+/);
  return tokens.filter((token) => UTILITY_TOKEN.test(token)).length / tokens.length >= 0.5;
};

const isProseValue = (value) =>
  typeof value === 'string' &&
  !DATE_OR_URL.test(value.trim()) &&
  value.trim().split(/\s+/).length > 1 &&
  /[A-Za-z]/.test(value) &&
  !CODE_FRAGMENT.test(value) &&
  !digitHeavy(value) &&
  !isUtilityClassList(value) &&
  !DESIGN_TOKEN.test(value.trim()) &&
  /[a-z]{3}/.test(value);

const STRUCTURAL_ATTRIBUTES = new Set([
  'class',
  'className',
  'href',
  'src',
  'srcset',
  'id',
  'style',
  'rel',
  'type',
  'name',
  'datetime',
  'width',
  'height',
  'loading',
  'slot',
  'sizes',
  'content',
  'property',
  'charset',
  'lang',
  'role',
  'target',
  'method',
  'action',
  'crossorigin',
  'decoding',
  'fetchpriority',
  'media',
  'sizes',
  'integrity',
  'referrerpolicy',
]);

const clean = (value) => value.replace(/\s+/g, ' ').trim();

const withoutComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

const row = (file, location, text) => ({ file, location, text: clean(text), status: 'unreviewed' });

function proseFields(value, path = []) {
  if (Array.isArray(value)) return value.flatMap((item, index) => proseFields(item, [...path, String(index)]));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, nested]) =>
      NON_PROSE_FIELDS.has(key) ? [] : proseFields(nested, [...path, key])
    );
  }
  return isProseValue(value) ? [[path.join('.'), value]] : [];
}

export function collectionRows(entries) {
  return entries.flatMap(({ file, frontmatter = {}, body = '' }) => {
    const fields = proseFields(frontmatter).map(([path, value]) => row(file, `frontmatter.${path}`, value));
    const prose = clean(body) === '' ? [] : [row(file, 'body', body)];
    return [...fields, ...prose];
  });
}

export function componentRows(files) {
  return files.flatMap(({ file, source: raw }) => {
    const source = withoutComments(raw).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ');
    const attributes = [...source.matchAll(/([a-zA-Z:-]+)="([^"{}]*)"/g)]
      .filter(
        ([, attribute, value]) =>
          !STRUCTURAL_ATTRIBUTES.has(attribute) &&
          !attribute.startsWith('data-') &&
          !attribute.startsWith('set:') &&
          isProseValue(value)
      )
      .map(([, attribute, value]) => row(file, `attribute.${attribute}`, value));
    const texts = [...source.matchAll(/>([^<>{}]+)</g)]
      .map((match) => clean(match[1]))
      .filter(
        (value) => value !== '' && /[A-Za-z]/.test(value) && !/^[a-z-]+:/.test(value) && !CODE_FRAGMENT.test(value)
      )
      .map((value) => row(file, 'text', value));
    return [...attributes, ...texts];
  });
}

function templateLiteralRows(file, source) {
  return [...source.matchAll(/(\w+)\s*[:=]\s*`((?:[^`\\]|\\.)*)`/g)].flatMap(([, key, body]) =>
    body
      .split(/\$\{[^}]*\}/)
      .map((part) => clean(part))
      .filter((part) => /^[A-Za-z]/.test(part) && isProseValue(part))
      .map((part) => row(file, `constant.${key}`, part))
  );
}

const QUOTED = [/(\w+)\s*[:=]\s*'((?:[^'\\]|\\.)*)'/g, /(\w+)\s*[:=]\s*"((?:[^"\\]|\\.)*)"/g];

const ARRAY_LITERAL = /(\w+)\s*[:=]\s*\[([\s\S]*?)\]/g;
const QUOTED_ITEM = /(['"`])((?:[^'"`\\]|\\.)*)\1/g;

function arrayRows(file, source) {
  return [...source.matchAll(ARRAY_LITERAL)]
    .filter(([, key]) => !STRUCTURAL_ATTRIBUTES.has(key))
    .flatMap(([, key, body]) =>
      [...body.matchAll(QUOTED_ITEM)]
        .map(([, , value]) => value)
        .filter((value) => isProseValue(value))
        .map((value) => row(file, `constant.${key}`, value))
    );
}

export function constantRows(files) {
  return files.flatMap(({ file, source: raw }) => {
    const source = withoutComments(raw);
    const keyed = QUOTED.flatMap((pattern) =>
      [...source.matchAll(pattern)]
        .filter(([, key, value]) => !STRUCTURAL_ATTRIBUTES.has(key) && isProseValue(value))
        .map(([, key, value]) => row(file, `constant.${key}`, value))
    );
    return [...keyed, ...arrayRows(file, source), ...templateLiteralRows(file, source)];
  });
}

export function renderedRows(pages) {
  return pages.flatMap(({ route, html }) => {
    const title = /<title>([^<]*)<\/title>/.exec(html)?.[1];
    const description = /<meta[^>]*name="description"[^>]*content="([^"]*)"/.exec(html)?.[1];
    const main = /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(html)?.[1] ?? html;
    const headings = [...main.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((match) =>
      row(route, 'body.h1', match[1].replace(/<[^>]+>/g, ''))
    );
    const paragraphs = [...main.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((match) =>
      row(route, 'body.p', match[1].replace(/<[^>]+>/g, ''))
    );
    return [
      ...(title ? [row(route, 'head.title', title)] : []),
      ...(description ? [row(route, 'head.description', description)] : []),
      ...headings,
      ...paragraphs,
    ];
  });
}

export function mergeRows(rows) {
  const byText = new Map();
  for (const entry of rows) {
    const existing = byText.get(entry.text);
    if (existing) {
      if (!existing.usedIn.includes(entry.file)) existing.usedIn.push(entry.file);
      continue;
    }
    const { file, ...rest } = entry;
    byText.set(entry.text, { ...rest, usedIn: [file] });
  }
  return [...byText.values()];
}

const decodeEntities = (value) =>
  value
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&(?:apos|#39);/g, "'")
    .replace(/&hellip;/g, '...')
    .replace(/&mdash;/g, '—');

const stripSyntax = (value) =>
  value
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}[-*+]\s+/gm, '')
    .replace(/[*_`>|]/g, '');

const normalise = (value) =>
  clean(stripSyntax(decodeEntities(value)))
    .toLowerCase()
    .replace(/[\u2018\u2019\u201c\u201d'"]/g, '')
    .replace(/\s+([,.;:!?)])/g, '$1')
    .replace(/([([])\s+/g, '$1');

const SHIPPED_ATTRIBUTES = /\b(?:content|title|alt|aria-label|placeholder)="([^"]*)"/gi;

const builtText = (pages) =>
  pages.map(({ route, html }) => ({
    route,
    text: normalise([stripMarkup(html), ...[...html.matchAll(SHIPPED_ATTRIBUTES)].map((match) => match[1])].join(' ')),
  }));

const stripMarkup = (html) =>
  html
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script\b(?![^>]*application\/ld\+json)[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');

export function deadCopy(rows, pages) {
  const shipped = builtText(pages);
  return rows.filter((entry) => {
    const needle = normalise(entry.text).slice(0, 80);
    return needle !== '' && !shipped.some((page) => page.text.includes(needle));
  });
}

const SENTENCE_WORD = /^[A-Za-z][A-Za-z'’]*$/;

const BARE_HOST = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i;
const RETRIEVED_SUFFIX = /·\s*retrieved\s+\d{4}-\d{2}-\d{2}\s*$/i;

const isComposedMetadata = (text) => {
  const trimmed = text.trim();
  if (BARE_HOST.test(trimmed)) return true;
  if (RETRIEVED_SUFFIX.test(trimmed)) return true;
  const tokens = text.split(/\s+/).filter((token) => token !== '·' && token !== '|');
  if (tokens.length === 0) return true;
  const words = tokens.filter((token) => SENTENCE_WORD.test(token));
  if (text.includes('·') && words.length / tokens.length < 0.75) return true;
  return tokens.every((token) => /^[a-z0-9-]+$/.test(token) && token.includes('-'));
};

export function untraceableText(pages, rows) {
  const sources = rows.map((entry) => normalise(entry.text));
  return pages.flatMap(({ route, html }) => {
    const main = /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(html)?.[1] ?? html;
    return [...main.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((match) => clean(match[1].replace(/<[^>]+>/g, ' ')))
      .filter(
        (text) =>
          text !== '' &&
          text.split(/\s+/).length >= 4 &&
          !isComposedMetadata(text) &&
          !sources.some((source) => {
            const shipped = normalise(text).replace(/[.,;:]$/, '');
            if (source.includes(shipped.slice(0, 80))) return true;
            if (source.split(/\s+/).length >= 3 && shipped.includes(source)) return true;
            const shippedWords = shipped.split(/\s+/).filter((word) => word.length > 2);
            if (shippedWords.length < 4) return false;
            const sourceWords = new Set(source.split(/\s+/));
            const shared = shippedWords.filter((word) => sourceWords.has(word)).length;
            return shared / shippedWords.length >= 0.7;
          })
      )
      .map((text) => ({ route, text }));
  });
}

export function unrowedStrings(pages, rows) {
  const known = new Set(rows.map((entry) => entry.text));
  return pages.flatMap(({ route, html }) =>
    renderedRows([{ route, html }])
      .filter((entry) => !known.has(entry.text))
      .map((entry) => ({ route, text: entry.text }))
  );
}

export function reviewGaps(rows) {
  return rows.filter(
    (entry) =>
      entry.status === 'unreviewed' ||
      (entry.status === 'owner-blocked' && !entry.reason) ||
      !['rewritten', 'verified', 'owner-blocked'].includes(entry.status)
  );
}
