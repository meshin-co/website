const PROSE_DIRS = ['docs/', 'audits/', 'site/.agents/', 'openspec/', 'investigation/'];
const TEST_FILE = /\.(?:test|spec)\.[cm]?[jt]s$|(?:^|\/)(?:tests|fixtures)\//;

export const affectsBuild = (path) =>
  !TEST_FILE.test(path) &&
  (path.startsWith('site/src/') || !(path.endsWith('.md') || PROSE_DIRS.some((dir) => path.startsWith(dir))));
