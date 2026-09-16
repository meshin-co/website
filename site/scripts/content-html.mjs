const OPENING_WORDS = 100;

const ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  '#39': "'",
  '#160': ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  rsquo: '’',
  lsquo: '‘',
  ldquo: '“',
  rdquo: '”',
};

const decode = (text) =>
  text.replace(/&(#?\w+);/g, (match, name) => {
    if (ENTITIES[name]) return ENTITIES[name];
    if (/^#x[0-9a-f]+$/i.test(name)) return String.fromCodePoint(Number.parseInt(name.slice(2), 16));
    if (/^#\d+$/.test(name)) return String.fromCodePoint(Number(name.slice(1)));
    return match;
  });

const stripTags = (html) =>
  decode(html.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .replace(/ ([,.;:!?)\]}])/g, '$1')
    .replace(/([([{]) /g, '$1')
    .trim();

const cutBalanced = (html, opener) => {
  let out = '';
  let cursor = 0;

  for (const match of html.matchAll(opener)) {
    const tag = match[1];
    const scanner = new RegExp(`<${tag}\\b[^>]*>|</${tag}>`, 'gi');
    scanner.lastIndex = match.index + match[0].length;

    let depth = 1;
    let found;
    while (depth > 0 && (found = scanner.exec(html))) depth += found[0].startsWith('</') ? -1 : 1;

    const end = depth === 0 ? scanner.lastIndex : html.length;
    if (match.index < cursor) continue;

    out += `${html.slice(cursor, match.index)} `;
    cursor = end;
  }

  return out + html.slice(cursor);
};

const matchAll = (html, pattern, group = 1) => [...html.matchAll(pattern)].map((match) => match[group]);

const MAIN = /<main\b[^>]*>([\s\S]*?)<\/main>/i;
const CHROME = /<(header|footer|nav)\b[^>]*>/gi;
const IGNORED = /<(\w+)\b[^>]*\bdata-gate-ignore\b[^>]*>/gi;
const LEAD = /<p\b[^>]*\bdata-gate-lead\b[^>]*>([\s\S]*?)<\/p>/i;
const LEADS = /<p\b[^>]*\bdata-gate-lead\b[^>]*>([\s\S]*?)<\/p>/gi;

function newestDate(html) {
  const days = matchAll(html, /<time\b[^>]*\bdatetime="([^"]+)"/gi).map((value) => value.slice(0, 10));
  return days.length > 0 ? days.sort().at(-1) : null;
}

export function extractPage(route, html) {
  const chromeFree = cutBalanced(html, CHROME);
  const main = MAIN.exec(chromeFree)?.[1] ?? chromeFree;
  const body = cutBalanced(main, IGNORED);

  const lead = LEAD.exec(body) ? stripTags(LEAD.exec(body)[1]) : null;
  const markedAnswers = new Set(matchAll(body, LEADS).map(stripTags));
  const paragraphs = matchAll(body, /<p\b[^>]*>([\s\S]*?)<\/p>/gi)
    .map(stripTags)
    .filter((paragraph) => paragraph && !markedAnswers.has(paragraph));
  const h1 = matchAll(body, /<h1\b[^>]*>([\s\S]*?)<\/h1>/gi).map(stripTags);
  const sub = matchAll(body, /<h([2-4])\b[^>]*>([\s\S]*?)<\/h\1>/gi, 2).map(stripTags);
  const hrefs = matchAll(body, /<a\b[^>]*\bhref="([^"]+)"/gi);
  const chromeHrefs = matchAll(cutBalanced(html, IGNORED), /<a\b[^>]*\bhref="([^"]+)"/gi);

  const internal = [...new Set(chromeHrefs.filter((href) => href.startsWith('/')))];
  const external = [...new Set(hrefs.filter((href) => /^https?:\/\//.test(href)))];

  const takeawayBlock = /<(\w+)\b[^>]*\bdata-takeaways\b[^>]*>([\s\S]*?)<\/\1>/i.exec(body);

  return {
    route,
    text: stripTags(body),
    lead,
    opening: [...markedAnswers, ...paragraphs].filter(Boolean).join(' ').split(/\s+/).slice(0, OPENING_WORDS).join(' '),
    paragraphs,
    headings: { h1, sub },
    links: { internal, external },
    tables: matchAll(body, /<table\b/gi, 0).length,
    figures: matchAll(body, /<(figure|svg)\b/gi, 0).length,
    takeaways: takeawayBlock ? matchAll(takeawayBlock[2], /<li\b/gi, 0).length : 0,
    updated: newestDate(main),
  };
}
