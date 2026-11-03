export const LIMITS = { header: 150, text: 3000, field: 2000, fallback: 4000, blocks: 50, fields: 10, elements: 10 };

const ELLIPSIS = '…';
const HIGH_SURROGATE_AT_END = /[\uD800-\uDBFF]$/;
const SAFE_ADDRESS = /^https?:\/\/[^\s|<>]+$/;
const FENCE_RUN = /`{3,}/g;
const ZERO_WIDTH_SPACE = '\u200b';

export const escapeText = (text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

export function cut(text, limit) {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1).replace(HIGH_SURROGATE_AT_END, '')}${ELLIPSIS}`;
}

export function link(url, label) {
  const shown = escapeText(label);
  return typeof url === 'string' && SAFE_ADDRESS.test(url) ? `<${url.replaceAll('&', '&amp;')}|${shown}>` : shown;
}

function requireText(what, text) {
  if (typeof text !== 'string' || text.trim() === '') throw new Error(`${what} must not be empty`);
  return text;
}

const markup = (text) => ({ type: 'mrkdwn', text });

export function header(text) {
  return { type: 'header', text: { type: 'plain_text', text: cut(requireText('a header', text), LIMITS.header) } };
}

export function section(text) {
  requireText('a section', text);
  if (text.length > LIMITS.text)
    throw new Error(`a section is too long: ${text.length} characters, over ${LIMITS.text}`);
  return { type: 'section', text: markup(text) };
}

export const divider = () => ({ type: 'divider' });

function lineChunks(line) {
  const chunks = [];
  let rest = line;
  while (rest.length > LIMITS.text) {
    const chunk = rest.slice(0, LIMITS.text).replace(HIGH_SURROGATE_AT_END, '');
    chunks.push(chunk);
    rest = rest.slice(chunk.length);
  }
  return [...chunks, rest];
}

export function sections(text) {
  const chunks = [];
  let open = null;
  for (const piece of text.split('\n').flatMap(lineChunks)) {
    if (open !== null && open.length + 1 + piece.length <= LIMITS.text) open += `\n${piece}`;
    else {
      if (open !== null) chunks.push(open);
      open = piece;
    }
  }
  if (open !== null) chunks.push(open);
  return chunks.filter((chunk) => chunk.trim() !== '').map(section);
}

function requireCount(what, list, max) {
  if (!Array.isArray(list) || list.length < 1 || list.length > max)
    throw new Error(`${what} must hold between 1 and ${max}, not ${list?.length}`);
}

export function fields(texts) {
  requireCount('fields', texts, LIMITS.fields);
  for (const text of texts) {
    requireText('a field', text);
    if (text.length > LIMITS.field)
      throw new Error(`a field is too long: ${text.length} characters, over ${LIMITS.field}`);
  }
  return { type: 'section', fields: texts.map(markup) };
}

export function context(...texts) {
  requireCount('a context line', texts, LIMITS.elements);
  for (const text of texts) requireText('a context element', text);
  return { type: 'context', elements: texts.map(markup) };
}

const withoutFence = (line) => line.replace(FENCE_RUN, (run) => [...run].join(ZERO_WIDTH_SPACE));

export const preformatted = (lines) =>
  `\`\`\`\n${lines.map((line) => withoutFence(escapeText(line))).join('\n')}\n\`\`\``;

export const bold = (text) => `*${text}*`;

export function message({ text, blocks }) {
  requireCount('a message', blocks, LIMITS.blocks);
  if (typeof text !== 'string' || text.trim() === '')
    throw new Error('a message needs fallback text for notifications');
  return { text: cut(text, LIMITS.fallback), blocks };
}

export const assemble = (...parts) =>
  message({
    text: parts
      .map(({ text }) => text)
      .filter((text) => text !== '')
      .join('\n\n'),
    blocks: parts.flatMap(({ blocks }) => blocks),
  });
