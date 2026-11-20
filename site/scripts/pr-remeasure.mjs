import { ledgerText, ledgerWithRemeasure, ledgerWithRemeasureResult } from './autowriter-ledger.mjs';
import { BOT_IDENTITY, slugOfBranch } from './pr-classify.mjs';
import { escalationIssueOf, shortSha } from './pr-resume-issues.mjs';
import { attempted } from './pr-resume-steps.mjs';
import { WORKFLOW } from './pr-watch.mjs';

export const REMEASURE_WORKFLOW = 'remeasure-pr.yml';
export const REMEASURE_RESULTS = ['clear', 'reproduced'];

const requestedComment = ({ gate, mainSha }) =>
  `re-measuring ${gate} on the branch caught up on main ${shortSha(mainSha)}: the repair stopped when main was older`;
const settledComment = ({ gate, mainSha }, result) =>
  result === 'clear'
    ? `re-measured: ${gate} passes on the branch caught up on main ${shortSha(mainSha)}, so the verdict was stale and the watcher is started`
    : `re-measured: ${gate} still fails on the branch caught up on main ${shortSha(mainSha)}, so the verdict stands and a person is needed`;

export function createRemeasurer({ io, reader, writer, ref, now }) {
  const putLedger = (pull, { path, blobSha }, ledger, message) =>
    io.putLedger(writer, {
      path,
      text: ledgerText(path, ledger),
      blobSha,
      branch: pull.head.ref,
      message,
      identity: BOT_IDENTITY,
    });

  const tell = (ledger, body) => {
    const issue = escalationIssueOf(ledger);
    if (issue === null) return null;
    return attempted(`the escalation issue #${issue} was not told`, () =>
      io.commentOnIssue(reader, { number: issue, body })
    );
  };

  const dispatch = (workflow, inputs, remedy) =>
    attempted(`${workflow} was not dispatched`, () => io.dispatchSuccessor(writer, { workflow, ref, inputs }), remedy);

  async function request({ pull, record, slug, stale }) {
    const entry = { at: now().toISOString(), ...stale, result: 'requested' };
    await putLedger(
      pull,
      record,
      ledgerWithRemeasure(record.value, entry),
      `chore(autowriter): re-measure ${stale.gate} for ${slug}`
    );
    const inputs = { pr: String(pull.number), head: pull.head.sha, gate: stale.gate };
    const problems = [
      await tell(record.value, requestedComment(stale)),
      await dispatch(
        REMEASURE_WORKFLOW,
        inputs,
        `; start it with: gh workflow run ${REMEASURE_WORKFLOW} -f pr=${pull.number}`
      ),
    ].filter((problem) => problem !== null);
    return { kind: 'remeasuring', pullRequest: pull.number, gate: stale.gate, mainSha: stale.mainSha, problems };
  }

  async function settle({ number, result }) {
    if (!REMEASURE_RESULTS.includes(result)) throw new Error(`${result} is not a re-measure result`);
    const pull = await io.readPullRequest(reader, number);
    const slug = slugOfBranch(pull.head.ref);
    const record = await io.readLedgerAt(reader, { slug, ref: pull.head.sha });
    const ledger = ledgerWithRemeasureResult(record.value, result);
    await putLedger(pull, record, ledger, `chore(autowriter): record the re-measure of ${slug} (${result})`);
    const waiting = ledger.remeasures.findLast((entry) => entry.result === result);
    const problems = [
      await tell(record.value, settledComment(waiting, result)),
      result === 'clear'
        ? await dispatch(
            WORKFLOW,
            { pr: String(number) },
            `; start it with: gh workflow run ${WORKFLOW} -f pr=${number}`
          )
        : null,
    ].filter((problem) => problem !== null);
    return { kind: 'remeasured', pullRequest: number, result, problems };
  }

  return { request, settle };
}
