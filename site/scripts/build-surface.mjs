const PROSE_DIRS = ['docs/', 'audits/', 'site/.agents/', 'openspec/', 'investigation/'];
const AUTOMATION_DIRS = ['.github/', '.githooks/'];
const SHIPPED_DIRS = ['site/src/', 'site/public/'];
const TEST_SUFFIX = /\.(?:test|spec)\.[cm]?[jt]s$/;
const TEST_DIR = /(?:^|\/)(?:tests|fixtures)\//;

export function affectsBuild(path) {
  if (TEST_SUFFIX.test(path) || AUTOMATION_DIRS.some((dir) => path.startsWith(dir))) return false;
  const shipped = SHIPPED_DIRS.some((dir) => path.startsWith(dir));
  if (!shipped && TEST_DIR.test(path)) return false;
  return shipped || !(path.endsWith('.md') || PROSE_DIRS.some((dir) => path.startsWith(dir)));
}
