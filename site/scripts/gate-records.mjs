const SEMANTIC_CORE = 'docs/SEMANTIC-CORE.md';
const DUPLICATE_ROUTE_JOINER = ' + ';
const TREE_WIDE_RULES = new Set(['no-pages', 'nothing-measured']);

const isRoute = (route) => typeof route === 'string' && route.startsWith('/');

const record = (finding, subjects, excerpt = finding.excerpt) => ({
  rule: finding.rule,
  subjects,
  detail: finding.detail ?? '',
  excerpt: excerpt ?? '',
});

function contentSubjects({ rule, route }) {
  if (rule === 'doc-drift' || rule === 'doc-drift-structure') return [SEMANTIC_CORE];
  if (rule === 'duplicate-sentence')
    return typeof route === 'string' ? route.split(DUPLICATE_ROUTE_JOINER).filter(isRoute) : [];
  return isRoute(route) ? [route] : [];
}

const contentExcerpt = ({ rule, route, excerpt }) => (rule === 'doc-drift' ? route : excerpt);

export const contentRecords = (findings) =>
  findings.map((finding) => record(finding, contentSubjects(finding), contentExcerpt(finding)));

export const humanRecords = (findings) =>
  findings.map((finding) => record(finding, TREE_WIDE_RULES.has(finding.rule) ? [] : [finding.route]));

export const registerRecords = (findings) => findings.map((finding) => record(finding, [SEMANTIC_CORE]));
