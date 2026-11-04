import { escalationMessage } from './escalation-slack.mjs';
import { issueUrl, pullRequestLink, runLink, runUrl } from './github-links.mjs';
import { autowriterAgent } from './site-brand.mjs';

const MAX_EXCERPT_LENGTH = 200;
const REQUEST_TIMEOUT_MS = 20_000;
const DEFAULT_API_URL = 'https://api.github.com';

const NOT_SET = {
  GITHUB_TOKEN: 'GITHUB_TOKEN is not set; pass a token with Issues: write in the workflow env',
  GITHUB_REPOSITORY: 'GITHUB_REPOSITORY is not set; pass owner/name in the workflow env',
  SLACK_WEBHOOK_URL: 'SLACK_WEBHOOK_URL is not set; create the repository secret of that name',
};

export const variable = (env, name) => (typeof env[name] === 'string' ? env[name].trim() : '');
const absentVariables = (env, names) => names.filter((name) => variable(env, name) === '');
const jsonOf = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

async function send({ fetch, url, headers, body }) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    return { status: response.status, text: await response.text() };
  } catch (error) {
    return { failure: error?.message ?? String(error) };
  }
}

function issueBody({ env, ledger, ledgerPath, escalation }) {
  const run = runUrl(env);
  const context = [
    `Kind: ${escalation.kind}`,
    `Ledger: ${ledgerPath}`,
    `Slug: ${ledger.slug}`,
    ...(ledger.pullRequest === null ? [] : [`Pull request: #${ledger.pullRequest}`]),
    ...(run === null ? [] : [`Actions run: ${run}`]),
  ];
  return `${escalation.detail}\n\n---\n${context.join('\n')}`;
}

async function openIssue(context) {
  const { env, fetch, escalation, clean } = context;
  const absent = absentVariables(env, ['GITHUB_TOKEN', 'GITHUB_REPOSITORY']);
  if (absent.length > 0) return { error: absent.map((name) => NOT_SET[name]).join('; ') };
  const apiUrl = variable(env, 'GITHUB_API_URL') || DEFAULT_API_URL;
  const result = await send({
    fetch,
    url: `${apiUrl}/repos/${variable(env, 'GITHUB_REPOSITORY')}/issues`,
    headers: {
      Authorization: `Bearer ${variable(env, 'GITHUB_TOKEN')}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': autowriterAgent(),
    },
    body: { title: escalation.title, body: issueBody(context) },
  });
  if (result.failure !== undefined) return { error: `request failed: ${result.failure}` };
  const { status, text } = result;
  const created = jsonOf(text);
  if (status !== 201) {
    const reason = typeof created?.message === 'string' && created.message !== '' ? created.message : text;
    return { status, error: `GitHub answered HTTP ${status}: ${clean(reason).slice(0, MAX_EXCERPT_LENGTH)}` };
  }
  if (!Number.isInteger(created?.number) || created.number < 1)
    return { status, error: 'GitHub answered HTTP 201 without an issue number' };
  const url = typeof created.html_url === 'string' ? created.html_url : null;
  return { status, issue: { number: created.number, url } };
}

function issueReference({ issue, env }) {
  if (issue === null) return null;
  return { label: `#${issue.number}`, url: issue.url ?? issueUrl(env, issue.number) };
}

function slackMessage(context) {
  const { escalation, ledger, ledgerPath, env, pullRequest } = context;
  return escalationMessage({
    escalation,
    ledgerPath,
    links: {
      pullRequest: pullRequestLink(env, pullRequest ?? ledger.pullRequest),
      run: runLink(env),
      issue: issueReference(context),
    },
  });
}

const failed = (result) => result.failure !== undefined;
const accepted = (result) => !failed(result) && result.status >= 200 && result.status <= 299;
const refusedWithClientError = (result) => !failed(result) && result.status >= 400 && result.status <= 499;
const hasPlainText = ({ blocks, text }) => Array.isArray(blocks) && typeof text === 'string' && text.trim() !== '';

const excerptOf = (result, clean) => clean(result.text).slice(0, MAX_EXCERPT_LENGTH);
const refusalOf = (result, clean) => `Slack answered HTTP ${result.status}: ${excerptOf(result, clean)}`;
const errorOf = (result, clean) => (failed(result) ? `request failed: ${result.failure}` : refusalOf(result, clean));
const retryErrorOf = (result, clean) =>
  failed(result)
    ? `the plain text request failed: ${result.failure}`
    : `HTTP ${result.status}: ${excerptOf(result, clean)} to the plain text sent after it`;
const withStatus = (result, outcome) => (failed(result) ? outcome : { status: result.status, ...outcome });

const plainTextOf = (text, status) =>
  `${text}\n\nSent as plain text: Slack rejected the formatted version of this message (HTTP ${status}). The reason is in the warning on the workflow run.`;

export async function postSlackMessage({ env, fetch, clean, message }) {
  if (absentVariables(env, ['SLACK_WEBHOOK_URL']).length > 0) return { error: NOT_SET.SLACK_WEBHOOK_URL };
  const request = { fetch, url: variable(env, 'SLACK_WEBHOOK_URL'), headers: { 'Content-Type': 'application/json' } };
  const first = await send({ ...request, body: message });
  if (accepted(first)) return { status: first.status };
  if (!refusedWithClientError(first) || !hasPlainText(message))
    return withStatus(first, { error: errorOf(first, clean) });
  const refusal = refusalOf(first, clean);
  const plain = await send({ ...request, body: { text: plainTextOf(message.text, first.status) } });
  if (accepted(plain)) return { status: plain.status, rejected: refusal };
  return withStatus(plain, { error: `${refusal}, then ${retryErrorOf(plain, clean)}` });
}

const postToSlack = (context) => postSlackMessage({ ...context, message: slackMessage(context) });

export const SENDERS = { issue: openIssue, slack: postToSlack };
