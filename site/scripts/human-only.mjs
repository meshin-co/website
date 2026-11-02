export const UNATTENDED_VARIABLE = 'AUTOWRITER_UNATTENDED';

const MARKED = new Set(['1', 'true']);

export class UnattendedRefusal extends Error {
  name = 'UnattendedRefusal';
}

export const isUnattended = (env = process.env) => MARKED.has(env[UNATTENDED_VARIABLE]);

export function refuseWhenUnattended(action, env = process.env) {
  if (isUnattended(env))
    throw new UnattendedRefusal(
      `refusing to ${action} in an unattended run: a person at a terminal does this; ${UNATTENDED_VARIABLE} is set`
    );
}

export function exitWhenUnattended(action, env = process.env) {
  try {
    refuseWhenUnattended(action, env);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

export function markUnattended(env = process.env) {
  env[UNATTENDED_VARIABLE] = '1';
}
