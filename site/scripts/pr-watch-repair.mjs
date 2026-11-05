import { appendFileSync } from 'node:fs';

import { variable } from './escalate-channels.mjs';

export const REPAIR_STATEMENTS = {
  unrepairable:
    "the gate's findings cannot be repaired by rewriting the entry, or the rewrite could not be made to pass the repair's own checks",
  'no-convergence': 'the same rule failed on the same path twice, or the attempt cap is spent',
  'spend-ceiling': 'the monthly spend ceiling is reached, so no model was called',
  credential: 'the vendor key is missing or was refused',
  failed: 'the repair job failed before it could finish',
  conflict: 'catching the branch up on main met a conflict in a file that is not derived, which only a person can read',
  unconverged:
    'catching the branch up on main did not reach a fixed point, so regenerating the derived files after it still changed them or dropped a row',
};

export function repairFinding({ result, number }, links) {
  const statement = REPAIR_STATEMENTS[result.reason];
  return {
    kind: result.kind,
    title: `Autowriter pull request #${number}: ${statement}`,
    detail: [
      `The repair of pull request #${number} ended as ${result.reason}: ${statement}.`,
      ...(links.run === null ? [] : [`Repair run: ${links.run}`]),
      `Pull request: ${links.pullRequest}`,
    ].join('\n'),
  };
}

export const repairOutputs = ({ action, result, snapshot }) =>
  action === 'repair'
    ? {
        repair: 'true',
        head: result.evidence.head,
        branch: snapshot.pullRequest.head.ref,
        kind: result.verdict === 'catch-up' ? 'catch-up' : 'entry',
      }
    : { repair: 'false' };

export function writeOutputs(env, values) {
  const target = variable(env, 'GITHUB_OUTPUT');
  if (target === '') return;
  const lines = Object.entries(values).map(([name, value]) => {
    if (/[\r\n]/.test(value))
      throw new Error(`the output ${name} holds a line break, which would write a second output`);
    return `${name}=${value}\n`;
  });
  appendFileSync(target, lines.join(''));
}
