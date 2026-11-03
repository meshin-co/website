const read = (env, name) => (typeof env[name] === 'string' ? env[name].trim() : '');

const isNumber = (value) => Number.isInteger(value) && value >= 1;

function repositoryUrl(env) {
  const server = read(env, 'GITHUB_SERVER_URL').replace(/\/+$/, '');
  const repository = read(env, 'GITHUB_REPOSITORY');
  return server === '' || repository === '' ? null : `${server}/${repository}`;
}

function under(env, path) {
  const base = repositoryUrl(env);
  return base === null ? null : `${base}/${path}`;
}

export function runUrl(env) {
  const id = read(env, 'GITHUB_RUN_ID');
  return id === '' ? null : under(env, `actions/runs/${id}`);
}

export const pullRequestUrl = (env, number) => (isNumber(number) ? under(env, `pull/${number}`) : null);

export const issueUrl = (env, number) => (isNumber(number) ? under(env, `issues/${number}`) : null);

export function runLink(env) {
  const id = read(env, 'GITHUB_RUN_ID');
  return id === '' ? null : { label: `run ${id}`, url: runUrl(env) };
}

const numbered = (urlOf) => (env, number) =>
  isNumber(number) ? { label: `#${number}`, url: urlOf(env, number) } : null;

export const pullRequestLink = numbered(pullRequestUrl);

export const issueLink = numbered(issueUrl);
