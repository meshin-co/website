import { GitHubError } from './pr-github.mjs';

const SHORT_SHA = 7;
const ESCALATION_ISSUE_TITLE = /^Autowriter pull request #(\d+): /;
const ESCALATION_ISSUE_AUTHOR = 'github-actions[bot]';

export const shortSha = (sha) => sha.slice(0, SHORT_SHA);

export const escalationIssueOf = ({ escalations }) =>
  escalations.at(-1)?.receipts.find(({ channel, delivered }) => channel === 'issue' && delivered)?.issue ?? null;

const isNotFound = (error) => error instanceof GitHubError && error.status === 404;
const isEscalationIssue = ({ user, title }) =>
  user.login === ESCALATION_ISSUE_AUTHOR && ESCALATION_ISSUE_TITLE.test(title);

export function createIssueSettler({ io, reader, settled }) {
  async function settleIssue(issue) {
    const number = Number(ESCALATION_ISSUE_TITLE.exec(issue.title)[1]);
    let pull;
    try {
      pull = await io.readPullRequest(reader, number);
    } catch (error) {
      if (!isNotFound(error)) throw error;
      return { kind: 'issue-left', issue: issue.number, pullRequest: number, reason: 'pull-request-not-found' };
    }
    if (pull.state === 'open') return null;
    const merged = pull.merged === true;
    const body = merged ? `merged as ${shortSha(pull.merge_commit_sha)}` : 'closed without merging';
    await io.commentOnIssue(reader, { number: issue.number, body });
    await io.closeIssue(reader, { number: issue.number, reason: merged ? 'completed' : 'not_planned' });
    return { kind: 'issue-closed', issue: issue.number, pullRequest: number, merged };
  }

  return async function closeStaleIssues() {
    const items = [];
    for (const issue of (await io.listOpenIssues(reader)).filter(isEscalationIssue)) {
      const item = await settled(`#${issue.number}`, () => settleIssue(issue), { issue: issue.number });
      if (item !== null) items.push(item);
    }
    return items;
  };
}
