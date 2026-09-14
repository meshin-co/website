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

const isProseValue = (value) =>
  typeof value === 'string' &&
  !DATE_OR_URL.test(value.trim()) &&
  value.trim().split(/\s+/).length > 1 &&
  /[A-Za-z]/.test(value);

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
]);

const looksLikeProse = (value) =>
  typeof value === 'string' && /[A-Za-z]/.test(value) && value.trim().split(/\s+/).length > 0;

const clean = (value) => value.replace(/\s+/g, ' ').trim();

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
  return files.flatMap(({ file, source }) => {
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
      .filter((value) => value !== '' && /[A-Za-z]/.test(value) && !/^[a-z-]+:/.test(value))
      .map((value) => row(file, 'text', value));
    return [...attributes, ...texts];
  });
}

const QUOTED = [/(\w+):\s*'((?:[^'\\]|\\.)*)'/g, /(\w+):\s*"((?:[^"\\]|\\.)*)"/g, /(\w+):\s*`((?:[^`\\]|\\.)*)`/g];

export function constantRows(files) {
  return files.flatMap(({ file, source }) =>
    QUOTED.flatMap((pattern) =>
      [...source.matchAll(pattern)]
        .filter(([, , value]) => looksLikeProse(value) && /\s/.test(value.trim()))
        .map(([, key, value]) => row(file, `constant.${key}`, value))
    )
  );
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

const builtText = (pages) => pages.map(({ route, html }) => ({ route, text: normalise(stripMarkup(html)) }));

const stripMarkup = (html) => html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ');

export function deadCopy(rows, pages) {
  const shipped = builtText(pages);
  return rows.filter((entry) => {
    const needle = normalise(entry.text).slice(0, 80);
    return needle !== '' && !shipped.some((page) => page.text.includes(needle));
  });
}

const SENTENCE_WORD = /^[A-Za-z][A-Za-z'’]*$/;

const BARE_HOST = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

const isComposedMetadata = (text) => {
  if (BARE_HOST.test(text.trim())) return true;
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
          !isComposedMetadata(text) &&
          !sources.some((source) => {
            const shipped = normalise(text);
            return (
              source.includes(shipped.slice(0, 80)) || (source.split(/\s+/).length >= 4 && shipped.includes(source))
            );
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
