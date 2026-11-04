import { CLEAR_COMMAND } from './measurement-debt.mjs';

export const REQUIRED_ENV = ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_PAGES_PROJECT'];

export function credentialFindings(env) {
  return REQUIRED_ENV.filter((name) => !String(env[name] ?? '').trim()).map(
    (name) => `${name} is not set; site/.env.example names it and the token scope it needs`
  );
}

export function branchLabel(branch) {
  return branch
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 28);
}

export function previewBranch(argv) {
  const label = argv[argv.indexOf('--preview') + 1] ?? 'preview';
  if (branchLabel(label) === 'main') {
    throw new Error('a preview branch may not be labelled main; that is the production branch');
  }
  return label;
}

export function deploymentUrl(output) {
  const alias = output.match(/alias URL:\s*(https:\/\/[a-z0-9.-]+\.pages\.dev)/i);
  if (alias) return alias[1];
  const any = output.match(/https:\/\/[a-z0-9.-]+\.pages\.dev/i);
  return any ? any[0] : null;
}

export function deployArgs({ project, dist, branch }) {
  return [
    'pages',
    'deploy',
    dist,
    '--project-name',
    project,
    '--branch',
    branchLabel(branch),
    '--commit-dirty',
    'true',
  ];
}

export function ledgerFindings(ledger, built) {
  const added = built.filter((route) => !ledger.includes(route));
  const removed = ledger.filter((route) => !built.includes(route));
  if (added.length === 0 && removed.length === 0) return [];
  const parts = [];
  if (added.length > 0) parts.push(`adds ${added.join(', ')}`);
  if (removed.length > 0) parts.push(`drops ${removed.join(', ')}`);
  return [
    `the build ${parts.join(' and ')} against audits/routes.json; the unattended writer commits the ledger with every route it adds, so this change came from somewhere else: run the gates, then npm run assets:routes, and commit audits/routes.json with the change that made it`,
  ];
}

const shortCommit = (commit) => commit.slice(0, 7);
const shortTree = (fingerprint) => fingerprint.slice(0, 12);

const owesMeasurement = ({ measurementDebt: debt }, record) =>
  debt !== undefined &&
  (record === undefined ||
    (debt.fingerprint !== record.fingerprint && Date.parse(debt.recordedAt) > Date.parse(record.recordedAt)));

export function unmeasuredTree({ record, current, ledgers }) {
  if (record?.fingerprint === current) return null;
  const owed = ledgers.filter((ledger) => owesMeasurement(ledger, record));
  const commands = [...new Set(owed.map(({ measurementDebt }) => measurementDebt.clear))];
  return {
    tree: shortTree(current),
    last: record
      ? `the last recorded run (${record.recordedAt}) measured ${shortTree(record.fingerprint)}`
      : 'no Lighthouse run is recorded for this repository',
    owed: owed.map(({ slug, measurementDebt }) => ({
      slug,
      mergedCommit: shortCommit(measurementDebt.mergedCommit),
      recordedAt: measurementDebt.recordedAt,
    })),
    clear: (commands.length > 0 ? commands : [CLEAR_COMMAND]).join(' or '),
  };
}

export function measurementWarnings(measurement) {
  const debt = unmeasuredTree(measurement);
  if (debt === null) return [];
  const entries = debt.owed.map(
    ({ slug, mergedCommit, recordedAt }) =>
      `${slug} owes the measurement (merged as ${mergedCommit}, debt recorded ${recordedAt}). `
  );
  return [
    `the tree being published, ${debt.tree}, was never measured by Lighthouse: ${debt.last}. ${entries.join('')}It is published anyway, because a measurement only a person can take does not hold the line. The debt stays open: on a quiet machine run ${debt.clear}, then commit audits/lighthouse-green.json; nothing but a recorded measurement of this tree clears it`,
  ];
}
