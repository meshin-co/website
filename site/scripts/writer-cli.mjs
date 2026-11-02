import { spawnSync } from 'node:child_process';

import { VENDORS } from './writer-config.mjs';
import { WriterError } from './writer-error.mjs';
import { redact } from './writer-redact.mjs';

const SETTINGS_FILE = 'site/.env.example';
const CONFIGURATION_KINDS = ['config', 'credential'];
const PROCESS_BUFFER_BYTES = 256 * 1024 * 1024;
const SECRET_LIST = Object.values(VENDORS)
  .map(({ id, keyName }) => `${keyName} for ${id}`)
  .join(', ');

export const runProcess = (command, args, { cwd }) => {
  const { status, stdout, stderr } = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: PROCESS_BUFFER_BYTES,
  });
  return { status, stdout, stderr };
};

export const keysInEnvironment = (env) =>
  Object.values(VENDORS).map(({ keyName }) => ({ name: keyName, value: env[keyName] }));

export function failureOf(error, secrets) {
  const known = error instanceof WriterError;
  return {
    ok: false,
    kind: known ? error.kind : 'unexpected',
    variables: known ? error.variables : [],
    message: redact(error.message, secrets),
    spend: error.spend ?? null,
  };
}

export function explain(command, failure, error) {
  const lines = [`${command} failed (${failure.kind}): ${failure.message}`];
  if (CONFIGURATION_KINDS.includes(failure.kind))
    lines.push(
      `Every vendor in use needs its secret (${SECRET_LIST}); every name the writer reads is described in ${SETTINGS_FILE}.`
    );
  if (failure.kind === 'unexpected') lines.push(error.stack);
  return lines;
}
