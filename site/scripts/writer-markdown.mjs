const ESCAPED = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const FENCE = /^\s{0,3}(`{3,}|~{3,})/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/;
const RULE = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
const QUOTE = /^\s{0,3}>\s?/;
const ITEM = /^\s*([-*+]|\d+[.)])\s+(.*)$/;
const TABLE_LINE = /^\s*\|/;
const TABLE_SEPARATOR = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/;
const CODE_SPAN = /`([^`]+)`/g;
const WORD = String.raw`\p{L}\p{N}_`;
const TOKEN = new RegExp(`${String.fromCharCode(0)}(\\d+)${String.fromCharCode(0)}`, 'g');

export const escapeHtml = (text) => text.replace(/[&<>"]/g, (character) => ESCAPED[character]);

function inline(text) {
  const tokens = [];
  const keep = (html) => `\u0000${tokens.push(html) - 1}\u0000`;
  const emphasised = text
    .replace(CODE_SPAN, (_, code) => keep(`<code>${escapeHtml(code)}</code>`))
    .replace(/<(https?:\/\/[^>\s]+)>/g, (_, url) => keep(`<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>`))
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, src) =>
      keep(`<img alt="${escapeHtml(alt)}" src="${escapeHtml(src)}">`)
    )
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) =>
      keep(`<a href="${escapeHtml(href)}">${inline(label)}</a>`)
    );
  const marked = escapeHtml(emphasised)
    .replace(/\*\*(?=\S)(.+?)(?<=\S)\*\*/g, '<strong>$1</strong>')
    .replace(new RegExp(`(?<![${WORD}])__(?=\\S)(.+?)(?<=\\S)__(?![${WORD}])`, 'gu'), '<strong>$1</strong>')
    .replace(/\*(?=\S)([^*]+?)(?<=\S)\*/g, '<em>$1</em>')
    .replace(new RegExp(`(?<![${WORD}])_(?=\\S)([^_]+?)(?<=\\S)_(?![${WORD}])`, 'gu'), '<em>$1</em>');
  return marked.replace(TOKEN, (_, index) => tokens[Number(index)]);
}

const cellsOf = (line) =>
  line
    .trim()
    .replace(/^\||\|$/g, '')
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim());

const startsBlock = (line, next) =>
  HEADING.test(line) ||
  FENCE.test(line) ||
  RULE.test(line) ||
  QUOTE.test(line) ||
  (TABLE_LINE.test(line) && TABLE_SEPARATOR.test(next ?? '')) ||
  (ITEM.test(line) && /^([-*+]|1[.)])$/.test(ITEM.exec(line)[1]));

function fenced(lines, at) {
  const marker = FENCE.exec(lines[at])[1];
  const code = [];
  let end = at + 1;
  while (end < lines.length && !lines[end].trimStart().startsWith(marker)) code.push(lines[end++]);
  return { html: `<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`, next: end + 1 };
}

function table(lines, at) {
  const row = (cells, tag) => `<tr>${cells.map((cell) => `<${tag}>${inline(cell)}</${tag}>`).join('')}</tr>`;
  const body = [];
  let end = at + 2;
  while (end < lines.length && TABLE_LINE.test(lines[end])) body.push(row(cellsOf(lines[end++]), 'td'));
  const head = `<thead>${row(cellsOf(lines[at]), 'th')}</thead>`;
  return { html: `<table>${head}<tbody>${body.join('')}</tbody></table>`, next: end };
}

function quote(lines, at) {
  const text = [];
  let end = at;
  while (end < lines.length && QUOTE.test(lines[end])) text.push(lines[end++].replace(QUOTE, '').trim());
  return { html: `<blockquote><p>${inline(text.join(' '))}</p></blockquote>`, next: end };
}

const isOrdered = (item) => /\d/.test(item[1]);

const nextItem = (lines, from) => ITEM.exec(lines.slice(from).find((line) => line.trim() !== '') ?? '');

function list(lines, at) {
  const ordered = isOrdered(ITEM.exec(lines[at]));
  const tag = ordered ? 'ol' : 'ul';
  const items = [];
  let end = at;
  while (end < lines.length) {
    const item = ITEM.exec(lines[end]);
    const following = lines[end].trim() === '' ? nextItem(lines, end + 1) : null;
    if (item && isOrdered(item) === ordered) items.push([item[2].trim()]);
    else if (item) break;
    else if (lines[end].trim() !== '' && items.length > 0 && /^\s+\S/.test(lines[end]))
      items.at(-1).push(lines[end].trim());
    else if (following && isOrdered(following) === ordered) {
      end += 1;
      continue;
    } else break;
    end += 1;
  }
  const html = items.map((parts) => `<li>${inline(parts.join(' '))}</li>`).join('');
  return { html: `<${tag}>${html}</${tag}>`, next: end };
}

function paragraph(lines, at) {
  const text = [lines[at].trim()];
  let end = at + 1;
  while (end < lines.length && lines[end].trim() !== '' && !startsBlock(lines[end], lines[end + 1]))
    text.push(lines[end++].trim());
  return { html: `<p>${inline(text.join(' '))}</p>`, next: end };
}

function block(lines, at) {
  const line = lines[at];
  const heading = HEADING.exec(line);
  if (FENCE.test(line)) return fenced(lines, at);
  if (heading) return { html: `<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`, next: at + 1 };
  if (RULE.test(line)) return { html: '<hr>', next: at + 1 };
  if (TABLE_LINE.test(line) && TABLE_SEPARATOR.test(lines[at + 1] ?? '')) return table(lines, at);
  if (QUOTE.test(line)) return quote(lines, at);
  if (ITEM.test(line)) return list(lines, at);
  return paragraph(lines, at);
}

export function renderMarkdown(markdown) {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const html = [];
  for (let at = 0; at < lines.length;) {
    if (lines[at].trim() === '') {
      at += 1;
      continue;
    }
    const rendered = block(lines, at);
    html.push(rendered.html);
    at = rendered.next;
  }
  return html.join('\n');
}
