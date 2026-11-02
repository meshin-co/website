import { judgeChecks } from '../pr-checks.mjs';
import { asInput, scenario, withAggregate } from './pr-watch.mjs';

export const ATTEMPT_CAP = 3;

export const judge = (bundle, extra = {}) => {
  const input = asInput(bundle, extra);
  return judgeChecks({
    head: bundle.pullRequest.head.sha,
    checkRuns: input.checkRuns,
    runs: input.runs,
    jobs: input.jobs,
    previous: input.previous,
    attemptsUsed: extra.attemptsUsed ?? 0,
    attemptCap: ATTEMPT_CAP,
  });
};

export const failingOf = ({ evidence }) => evidence.failing.map(({ job, gate }) => [job, gate]);

export const green = () => withAggregate(scenario('green'));

export const CANCELLED_SIBLINGS = {
  build: 'cancelled',
  'types-and-units': 'cancelled',
  'guard-mutations': 'cancelled',
  'visual-and-axe (1)': 'cancelled',
  'visual-and-axe (2)': 'cancelled',
  'visual-and-axe (3)': 'cancelled',
  'deploy-preview': 'skipped',
};
