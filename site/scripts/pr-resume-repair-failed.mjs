import { ESCALATION_KIND } from './repair-outcome.mjs';

export const REPAIR_FAILURE_RESUMES = 1;

const REPAIR_FAILED = /^The repair of pull request #\d+ ended as failed: /m;

export const isRepairFailure = ({ kind, detail }) => kind === ESCALATION_KIND.failed && REPAIR_FAILED.test(detail);

const escalationBefore = ({ escalations }, at) =>
  escalations.findLast(({ raisedAt }) => Date.parse(raisedAt) <= Date.parse(at));

const resumedAfterRepairFailure = (ledger) =>
  (ledger.resumes ?? []).filter(({ at }) => {
    const escalation = escalationBefore(ledger, at);
    return escalation !== undefined && isRepairFailure(escalation);
  }).length;

export const repairFailureResumeSpent = (ledger) => resumedAfterRepairFailure(ledger) >= REPAIR_FAILURE_RESUMES;
