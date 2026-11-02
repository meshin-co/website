const REVIEWED = ['rewritten', 'verified', 'owner-blocked'];
const CONDITIONAL_FILE = 'audits/phase-4.7/conditional-copy.json';

export const isPending = (entry) =>
  !REVIEWED.includes(entry.status) || (entry.status === 'owner-blocked' && !entry.reason);

const isRoute = (value) => value.startsWith('/');

const repoPath = (target) => {
  const path = target.replace(/^\.\//, '');
  return isRoute(path) || path.startsWith('site/') ? path : `site/${path}`;
};

const unique = (values) => [...new Set(values)];

const copySubjects = ({ usedIn = [] }) => {
  const files = usedIn.filter((used) => !isRoute(used)).map(repoPath);
  return unique(files.length > 0 ? files : usedIn);
};

const record = (rule, subjects, detail, excerpt = '') => ({ rule, subjects, detail, excerpt });

export function editorialRecords({
  rows,
  untraceable = [],
  dead = [],
  stale = [],
  conditional = {},
  missingTarget = [],
}) {
  const { stale: staleDeclarations = [], invalid = [] } = conditional;
  return [
    ...rows
      .filter(isPending)
      .map((entry) => record('unreviewed-copy', copySubjects(entry), `${entry.location}: ${entry.status}`, entry.text)),
    ...untraceable.map((entry) =>
      record('untraceable-copy', [entry.route], 'ships but traces to no source row', entry.text)
    ),
    ...dead.map((entry) => record('dead-copy', copySubjects(entry), 'source copy no page ships', entry.text)),
    ...stale.map((entry) => record('stale-disposition', [repoPath(entry.target)], entry.why, entry.location)),
    ...staleDeclarations.map((entry) =>
      record(
        'stale-conditional-declaration',
        [CONDITIONAL_FILE],
        'declared conditional but the build ships it',
        entry.text
      )
    ),
    ...invalid.map((entry) =>
      record(
        'invalid-conditional-declaration',
        [CONDITIONAL_FILE],
        'conditional declaration carries no reason',
        entry.text
      )
    ),
    ...missingTarget.map((entry) =>
      record('disposition-target-missing', [repoPath(entry.target)], 'disposition names a file that does not exist')
    ),
  ];
}
