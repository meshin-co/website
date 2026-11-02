import { spawnSync } from 'node:child_process';

import { GIT_ENVIRONMENT } from './route-repo.mjs';

export function gitRun({ fail = () => false, env = {} } = {}) {
  const calls = [];
  const run = (command, args, { cwd }) => {
    calls.push(args);
    if (fail(args)) return { status: 1, stdout: '', stderr: 'injected failure' };
    const { status, stdout, stderr } = spawnSync(command, args, {
      cwd,
      env: { ...GIT_ENVIRONMENT, ...env },
      encoding: 'utf8',
    });
    return { status, stdout, stderr };
  };
  run.calls = calls;
  return run;
}
