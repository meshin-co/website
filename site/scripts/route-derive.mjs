import { claimFile } from './autowriter-claims.mjs';
import { termOf, writtenFormat } from './entry-files.mjs';
import { generationFile } from './generation-record.mjs';
import { parseBuyerPrompts } from './semantic-core.mjs';
import { WriterError } from './writer-error.mjs';

const CORE_DOCUMENT = 'docs/SEMANTIC-CORE.md';
const PROMPTS_HEADING = '### The 30 buyer prompts';
const GAP_REGISTER_HEADING = '### GAP register';
const ENTRY_LABEL = /^(?:Must win|Passage:|Why:|\*\*|#{1,6} )/;
const PROMPT_HEADING = /^\*\*\d+\./;
const QUOTED_PASSAGE = /^Passage:\s*"[^"]+"/;
export const DISPOSITION_DIRECTORY = 'audits/phase-4.7/dispositions';
export const GENERATED_STATUS = 'rewritten';
const TARGET_QUERY_OPENING = '  "targetQuery": {';
const TARGET_QUERY_CLOSING = /^ {2}\},?$/;
const JSON_STRING = '"(?:[^"\\\\]|\\\\.)*"';
const TARGET_QUERY_ROW = new RegExp(`^ {4}(${JSON_STRING}): (${JSON_STRING})(,?)$`);

function fail(message) {
  throw new WriterError('build', message);
}

function unreadable({ promptNumber, passage, route }) {
  if (!Number.isInteger(promptNumber) || promptNumber < 1)
    return `prompt number ${promptNumber} is not a positive integer`;
  if (typeof passage !== 'string' || passage === '' || passage !== passage.trim())
    return 'the passage is empty or starts or ends with a space';
  if (/["\r\n]/.test(passage))
    return 'the passage holds a double quotation mark or a line break, which the prompt parser cannot read back';
  if (!/^\/[^\s`]*$/.test(route)) return `the route "${route}" must start with / and hold no space and no backtick`;
  return null;
}

function promptParagraph(lines, promptNumber) {
  const start = lines.findIndex((line) => line.startsWith(PROMPTS_HEADING));
  if (start === -1) fail(`${CORE_DOCUMENT} has no "${PROMPTS_HEADING}" section`);
  const gap = lines.findIndex((line, index) => index > start && line.startsWith(GAP_REGISTER_HEADING));
  const end = gap === -1 ? lines.length : gap;
  const heading = new RegExp(`^\\*\\*${promptNumber}\\.`);
  const headingAt = lines.findIndex((line, index) => index > start && index < end && heading.test(line));
  if (headingAt === -1) fail(`${CORE_DOCUMENT} has no buyer prompt numbered ${promptNumber}`);

  let first = headingAt;
  while (first - 1 > start && lines[first - 1] !== '') first -= 1;
  let last = headingAt;
  while (last + 1 < end && lines[last + 1] !== '') last += 1;
  return { first, headingAt, last };
}

function entryEnd(lines, from, last) {
  let end = from + 1;
  while (end <= last && !ENTRY_LABEL.test(lines[end])) end += 1;
  return end;
}

function insertionIndex(lines, { first, headingAt, last }) {
  const inside = (index) => index >= first && index <= last;
  const lastPassage = lines.findLastIndex((line, index) => inside(index) && line.startsWith('Passage:'));
  if (lastPassage !== -1) return entryEnd(lines, lastPassage, last);
  const mustWin = lines.findIndex((line, index) => inside(index) && line.startsWith('Must win'));
  if (mustWin !== -1) return entryEnd(lines, mustWin, last);
  let after = headingAt + 1;
  while (after <= last && PROMPT_HEADING.test(lines[after])) after += 1;
  return after;
}

const withLine = (lines, paragraph, line) => {
  const at = insertionIndex(lines, paragraph);
  return [...lines.slice(0, at), line, ...lines.slice(at)];
};

const withRouteOnQuotedPassage = (lines, { first, last }, route) => {
  const at = lines.findIndex((line, index) => index >= first && index <= last && QUOTED_PASSAGE.test(line));
  return lines.map((line, index) =>
    index === at ? line.replace(QUOTED_PASSAGE, (quoted) => `${quoted} (\`${route}\`)`) : line
  );
};

function passagesOf(text, promptNumber) {
  const prompt = parseBuyerPrompts(text).find(({ number }) => number === promptNumber);
  if (!prompt) fail(`${CORE_DOCUMENT}: the prompt parser does not read prompt ${promptNumber}`);
  return prompt.passages;
}

export const passageOf = (coreText, { promptNumber, route }) =>
  passagesOf(coreText, promptNumber).find((passage) => passage.route === route)?.text ?? null;

const isSame = (wanted) => (passage) => passage.text === wanted.text && passage.route === wanted.route;

export function insertPassage(coreText, { promptNumber, passage, route }) {
  const problem = unreadable({ promptNumber, passage, route });
  if (problem) fail(`insertPassage: ${problem}`);

  const lines = coreText.split('\n');
  const paragraph = promptParagraph(lines, promptNumber);
  const wanted = { text: passage, route };
  const before = passagesOf(coreText, promptNumber);
  if (before.some(isSame(wanted))) return coreText;

  const line = `Passage: "${passage}" (\`${route}\`)`;
  const plain = withLine(lines, paragraph, line);
  const lost = before.filter((had) => !passagesOf(plain.join('\n'), promptNumber).some(isSame(had)));
  const written =
    lost.length === 0 ? plain : withLine(withRouteOnQuotedPassage(lines, paragraph, lost[0].route), paragraph, line);

  const text = written.join('\n');
  const stopped = [wanted, ...before].find((expected) => !passagesOf(text, promptNumber).some(isSame(expected)));
  if (stopped) fail(`insertPassage: prompt ${promptNumber} would stop reading "${stopped.text.slice(0, 60)}"`);
  return text;
}

function parseRow(line) {
  const match = TARGET_QUERY_ROW.exec(line);
  if (!match) fail(`content-facts.json: "${line.trim().slice(0, 60)}" is not one "route": "query" row`);
  return { route: JSON.parse(match[1]), query: JSON.parse(match[2]) };
}

const familyOf = (route) => route.slice(0, route.lastIndexOf('/') + 1);

function rowToInsertBefore(rows, route) {
  const siblings = rows
    .map((row, index) => ({ ...row, index }))
    .filter((row) => familyOf(row.route) === familyOf(route));
  if (siblings.length === 0) return rows.length;
  const sorted = siblings.every((row, at) => at === 0 || siblings[at - 1].route < row.route);
  const firstLater = siblings.find((row) => row.route > route);
  return sorted && firstLater ? firstLater.index : siblings.at(-1).index + 1;
}

function refuseKnown(rows, route, query) {
  const sameRoute = rows.find((row) => row.route === route);
  if (sameRoute) fail(`content-facts.json already holds a target query for ${route}: "${sameRoute.query}"`);
  const sameQuery = rows.find((row) => row.query === query);
  if (sameQuery) fail(`content-facts.json already has "${query}" as the target query of ${sameQuery.route}`);
}

export function addTargetQuery(factsText, route, query) {
  const lines = factsText.split('\n');
  const opening = lines.indexOf(TARGET_QUERY_OPENING);
  const closing =
    opening === -1 ? -1 : lines.findIndex((line, index) => index > opening && TARGET_QUERY_CLOSING.test(line));
  if (closing === -1) fail('content-facts.json has no targetQuery object laid out one row per line');
  const rows = lines.slice(opening + 1, closing).map(parseRow);
  if (rows.length === 0) fail('content-facts.json holds a targetQuery object with no rows');
  refuseKnown(rows, route, query);

  const row = `    ${JSON.stringify(route)}: ${JSON.stringify(query)}`;
  const at = rowToInsertBefore(rows, route);
  if (at < rows.length) lines.splice(opening + 1 + at, 0, `${row},`);
  else lines.splice(closing, 0, row);
  if (at === rows.length) lines[closing - 1] += ',';
  return lines.join('\n');
}

const QUERY_OF = { term: ({ title }) => termOf(title), article: ({ query }) => query };

export const targetQueryFor = ({ claim }) => QUERY_OF[writtenFormat(claim.format)](claim).toLowerCase();

export const dispositionFile = (slug) => `${DISPOSITION_DIRECTORY}/generated-${slug}.json`;

export const dispositionFor = ({ slug, target, digest, runDate }) => ({
  target,
  status: GENERATED_STATUS,
  reason: `Written by the unattended writer from the claim in ${claimFile(slug)} on ${runDate}. No human has read this text. Every hard fact in it is bound to a source in ${generationFile(slug)}.`,
  digest,
});
