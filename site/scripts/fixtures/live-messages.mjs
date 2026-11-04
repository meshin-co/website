import { liveMessage, unreachableMessage } from '../live-slack.mjs';
export const STATUS = { month: '2026-11', spentMicro: 62_000, ceilingUsd: 25 };
export const REACHED = { month: '2026-11', spentMicro: 25_010_000, ceilingUsd: 25 };
export const RUN = { label: 'run 777', url: 'https://github.test/o/r/actions/runs/777' };
export const WITH_RUN = { run: RUN };
export const NO_LINKS = { run: null };
export const FIRST = '2026-11-03T09:00:12.345Z';
export const LATER = '2026-11-03T09:02:21.000Z';

export const answered = (attempts = 1, checkedAt = FIRST) => ({
  reachable: true,
  status: 200,
  attempts,
  checkedAt,
  failure: null,
});
export const unanswered = (failure = 'HTTP 404', attempts = 8, checkedAt = LATER) => ({
  reachable: false,
  status: failure.startsWith('HTTP ') ? Number(failure.slice(5)) : null,
  attempts,
  checkedAt,
  failure,
});
export const surface = (kind, label, path, probe = answered()) => ({
  kind,
  label,
  url: `https://site.test${path}`,
  probe,
});

export const A_POST = {
  slug: 'a-post',
  format: 'article',
  title: 'What an AI system register holds',
  prompt: { number: 3, text: 'How do I keep an AI system register?' },
  input: 25_000,
  output: 5_000,
  micro: 50_000,
  page: surface('page', 'the page', '/blog/a-post'),
  surfaces: [
    surface('sidecar', 'a markdown sidecar', '/blog/a-post.md'),
    surface('og-image', 'a social card', '/og/post/a-post.png'),
  ],
};
export const A_TERM = {
  slug: 'a-term',
  format: 'term',
  title: 'What is an AI register?',
  prompt: { number: 12, text: 'AI register definition' },
  input: 6_000,
  output: 1_200,
  micro: 12_000,
  page: surface('page', 'the page', '/glossary/a-term', answered(2, '2026-11-03T09:00:17.000Z')),
  surfaces: [surface('sidecar', 'a markdown sidecar', '/glossary/a-term.md')],
};
export const withPage = (entry, probe) => ({ ...entry, page: { ...entry.page, probe } });

export const prose = (text) => ({ type: 'section', text: { type: 'mrkdwn', text } });
export const columns = (...texts) => ({ type: 'section', fields: texts.map((text) => ({ type: 'mrkdwn', text })) });
export const small = (...texts) => ({ type: 'context', elements: texts.map((text) => ({ type: 'mrkdwn', text })) });
export const fenced = (lines) => ['```', ...lines, '```'].join('\n');
export const DIVIDER = { type: 'divider' };
export const HEADER = {
  type: 'header',
  text: { type: 'plain_text', text: '2026-11 spend against the monthly ceiling' },
};
export const MONTH_TABLE = ['            USD', 'Spent     0.062', 'Ceiling  25.00', 'Left     24.938'];
export const POST_FIGURES = [
  'Tokens    input  output',
  'article  25,000   5,000',
  '',
  'Cost      USD',
  'article  0.05',
];
export const TERM_FIGURES = ['Tokens  input  output', 'term    6,000   1,200', '', 'Cost    USD', 'term  0.012'];

export const DOWN = withPage(A_POST, unanswered());
export const REFUSED = withPage(A_TERM, unanswered('request failed: ECONNREFUSED', 8, '2026-11-03T09:03:00.000Z'));

export const live = (entries = [A_POST], { status = STATUS, links = WITH_RUN, unmeasured = null } = {}) =>
  liveMessage({ status, entries, links, unmeasured });
export const unreachable = (entries, { status = STATUS, links = WITH_RUN } = {}) =>
  unreachableMessage({ status, entries, links });
export const fieldsOf = (message) => message.blocks.filter((block) => block.fields !== undefined);
export const sectionsText = (message) => message.blocks.map((block) => block.text?.text ?? '').join('\n');
