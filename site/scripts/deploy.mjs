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
    `the build ${parts.join(' and ')} against audits/routes.json; run the gates and npm run assets:routes before publishing`,
  ];
}
