import { WriterError } from './writer-error.mjs';

const FENCE = '```';
const HEADING = /^(#{1,6}) /;
const NUMBERED_PROMPT = /^\*\*\d+\. /;
const RULE_TAIL = /\n+-{3,}\s*$/;
const DECLARATION_CLOSER = '});';
const CONTINUATION = '  ';

const linesOf = (text) => text.split('\n');
const headingLevel = (line) => HEADING.exec(line)?.[1].length ?? 0;

function lineIndex(lines, matches, path, anchor, from = 0) {
  const index = lines.findIndex((line, at) => at >= from && matches(line));
  if (index === -1) throw new WriterError('config', `${path}: the anchor "${anchor}" is gone`);
  return index;
}

export function bulletAt(text, path, opening) {
  const lines = linesOf(text);
  const anchor = `- ${opening}`;
  const start = lineIndex(lines, (line) => line.startsWith(anchor), path, anchor);
  let end = start + 1;
  while (end < lines.length && lines[end].startsWith(CONTINUATION)) end += 1;
  return lines.slice(start, end).join('\n').trimEnd();
}

export function sectionAt(text, path, heading) {
  const lines = linesOf(text);
  const level = headingLevel(heading);
  const start = lineIndex(lines, (line) => line === heading || line.startsWith(`${heading} `), path, heading);
  let fenced = false;
  let end = start + 1;
  for (; end < lines.length; end += 1) {
    if (lines[end].startsWith(FENCE)) fenced = !fenced;
    else if (!fenced && headingLevel(lines[end]) > 0 && headingLevel(lines[end]) <= level) break;
  }
  return lines.slice(start, end).join('\n').replace(RULE_TAIL, '').trimEnd();
}

export function declarationAt(text, path, opener) {
  const lines = linesOf(text);
  const start = lineIndex(lines, (line) => line.startsWith(opener), path, opener);
  const end = lineIndex(lines, (line) => line === DECLARATION_CLOSER, path, DECLARATION_CLOSER, start + 1);
  return lines.slice(start, end + 1).join('\n');
}

export function blockBetween(text, path, from, until) {
  const lines = linesOf(text);
  const start = lineIndex(lines, (line) => line.startsWith(from), path, from);
  const end = lineIndex(lines, (line) => line.startsWith(until), path, until, start + 1);
  return lines.slice(start, end).join('\n').trimEnd();
}

export function promptBlockAt(text, path, number) {
  const lines = linesOf(text);
  const opener = `**${number}. `;
  const start = lineIndex(lines, (line) => line.startsWith(opener), path, opener);
  let end = start + 1;
  while (end < lines.length && !NUMBERED_PROMPT.test(lines[end]) && !HEADING.test(lines[end])) end += 1;
  return lines.slice(start, end).join('\n').trimEnd();
}
