import { gateFindings } from './content-gate.mjs';
import { extractPage } from './content-html.mjs';
import { humanFindings, pageFromHtml } from './human-gate.mjs';
import { selfContainmentIssues } from './prose-rules.mjs';
import { targetQueryFor } from './route-derive.mjs';
import { entryPage } from './writer-page.mjs';

const OWNED_BY_SITE_CHROME = new Set(['inbound-links']);
const OWNED_BY_WHOLE_PAGE = new Set(['sentence-variance', 'paragraph-variance', 'list-variety', 'heading-variety']);
const LEAD_FIELDS = {
  article: ['description', 'shortAnswer', 'fullAnswer'],
  term: ['description', 'shortDefinition', 'definition'],
};

const withExcerpt = ({ rule, detail, excerpt }) => ({ rule, detail: [detail, excerpt].filter(Boolean).join(' | ') });

const leadProblems = (draft, format) =>
  LEAD_FIELDS[format].flatMap((field) =>
    selfContainmentIssues(draft.fields[field]).map((marker) => ({
      rule: 'self-containment',
      detail: `${field} leans on the page around it with "${marker}"`,
    }))
  );

export function pageProblems({ draft, claim, context, runDate }) {
  const { route, profile, html } = entryPage({ claim, draft, runDate });
  const page = { ...extractPage(route, html), profile };
  const facts = { numbers: context.facts.numbers, targetQuery: { [route]: targetQueryFor({ claim }) } };
  const content = gateFindings([page], facts, context.bannedPhrases).filter(
    ({ rule }) => !OWNED_BY_SITE_CHROME.has(rule)
  );
  const human = humanFindings(pageFromHtml(route, html), context.controlledWords).filter(
    ({ rule }) => !OWNED_BY_WHOLE_PAGE.has(rule)
  );
  const passage = page.text.includes(draft.passage)
    ? []
    : [{ rule: 'passage-missing', detail: 'the passage does not occur in the text of the page' }];
  return [...content, ...human].map(withExcerpt).concat(passage, leadProblems(draft, profile));
}
