import { assemble, bold, context, cut, divider, escapeText, fields, header, link, sections } from './slack-blocks.mjs';

const LABEL_LIMIT = 40;
const ADDRESS = /https?:\/\/[^\s<>|]+/g;
const TRAILING_PUNCTUATION = /[.,;:!?)\]]+$/;
const NAMED_ADDRESSES = [
  [/\/(?:pull|issues)\/(\d+)$/, (number) => `#${number}`],
  [/\/actions\/runs\/(\d+)$/, (id) => `run ${id}`],
];

function labelOf(url) {
  for (const [pattern, name] of NAMED_ADDRESSES) {
    const found = pattern.exec(url);
    if (found) return name(found[1]);
  }
  return cut(url.replace(/^https?:\/\//, '').replace(/\/$/, ''), LABEL_LIMIT);
}

function linkified(text) {
  let shown = '';
  let from = 0;
  for (const found of text.matchAll(ADDRESS)) {
    const url = found[0].replace(TRAILING_PUNCTUATION, '');
    shown += escapeText(text.slice(from, found.index)) + link(url, labelOf(url));
    from = found.index + url.length;
  }
  return shown + escapeText(text.slice(from));
}

const reference = (ref) => link(ref.url, ref.label);

function requireText(what, text) {
  if (typeof text !== 'string' || text.trim() === '') throw new Error(`an escalation message needs its ${what}`);
}

export function escalationMessage({ escalation, ledgerPath, links }) {
  const { id, kind, title, detail, raisedAt } = escalation;
  requireText('title', title);
  requireText('ledger path', ledgerPath);
  const references = [
    ['Pull request', links.pullRequest],
    ['Workflow run', links.run],
    ['Issue', links.issue],
  ].filter(([, ref]) => ref !== null && ref !== undefined && (ref.url === null || !detail.includes(ref.url)));
  const columns =
    references.length === 0
      ? []
      : [divider(), fields(references.map(([name, ref]) => `${bold(name)}\n${reference(ref)}`))];
  return assemble(
    {
      blocks: [
        header(`Autowriter escalation: ${kind}`),
        ...sections(bold(escapeText(title))),
        ...sections(linkified(detail)),
        ...columns,
      ],
      text: [
        `Autowriter escalation (${kind}): ${escapeText(title)}`,
        linkified(detail),
        ...references.map(([name, ref]) => `${name}: ${reference(ref)}`),
        `Ledger: ${escapeText(ledgerPath)}`,
      ].join('\n'),
    },
    {
      blocks: [
        context(`Escalation ${escapeText(id)} (${kind}), raised ${raisedAt}`, `Ledger \`${escapeText(ledgerPath)}\``),
      ],
      text: '',
    }
  );
}
