const REQUIRED_HEADERS = [
  'content-security-policy',
  'strict-transport-security',
  'x-content-type-options',
  'referrer-policy',
  'permissions-policy',
  'cross-origin-opener-policy',
];

const finding = (check, status, detail) => ({ check, status, detail });

export function checkHeaders(headers) {
  const missing = REQUIRED_HEADERS.filter((header) => !headers[header]);
  if (missing.length > 0) {
    return finding('headers', 'fail', `missing ${missing.join(', ')}`);
  }
  const csp = headers['content-security-policy'];
  if (csp.includes('unsafe-inline') || csp.includes('unsafe-eval')) {
    const directive = csp.includes('unsafe-inline') ? 'unsafe-inline' : 'unsafe-eval';
    return finding('headers', 'fail', `the CSP allows ${directive}`);
  }
  return finding('headers', 'pass', `all ${REQUIRED_HEADERS.length} present, CSP has no unsafe directive`);
}

export function checkNoindex(html) {
  return /content="[^"]*noindex/i.test(html)
    ? finding('noindex removed', 'fail', 'the page still carries a noindex robots meta')
    : finding('noindex removed', 'pass', 'no noindex robots meta ships');
}

export function verdictFor({ route, status }) {
  return status === 200
    ? finding(`route ${route}`, 'pass', '200')
    : finding(`route ${route}`, 'fail', `answered ${status}, expected 200`);
}

export function renderSmoke(origin, rows) {
  const failures = rows.filter((row) => row.status === 'fail');
  return [
    '# Production smoke',
    '',
    `Measured against \`${origin}\` by \`npm run smoke:prod\`. Every row is one request; nothing`,
    'here is read from a config file.',
    '',
    `failures: ${failures.length}`,
    '',
    '| Check | Status | Detail |',
    '|---|---|---|',
    ...rows.map((row) => `| ${row.check} | ${row.status} | ${row.detail} |`),
    '',
  ].join('\n');
}
