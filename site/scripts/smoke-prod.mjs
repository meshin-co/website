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

function mediaTypeVerdict(check, expected, { status, contentType }) {
  if (status !== 200) return finding(check, 'fail', `answered ${status}, expected 200`);
  return contentType.startsWith(expected)
    ? finding(check, 'pass', contentType)
    : finding(check, 'fail', `answered ${contentType}, expected ${expected}`);
}

export function markdownNegotiationVerdict({ status, contentType }) {
  return mediaTypeVerdict('markdown negotiation /', 'text/markdown', { status, contentType });
}

export const ACCEPT_PROBES = [
  { accept: 'text/html, text/markdown;q=0', answers: 'text/html' },
  { accept: 'text/html;q=0.9, text/markdown;q=0.1', answers: 'text/html' },
  { accept: '*/*;q=0, text/markdown', answers: 'text/markdown' },
  { accept: 'text/markdown;q=abc', answers: 'text/html' },
  { accept: 'text/markdown;q=', answers: 'text/html' },
  { accept: 'text/html;note="x, text/markdown, y"', answers: 'text/html' },
];

export function acceptVerdict(probe, observed) {
  return mediaTypeVerdict(`accept ${probe.accept}`, probe.answers, observed);
}

export const PATH_SHAPES = ['/about/', '/index', '//about', '//x/about'];

export function pathAgreementVerdict(path, { html, markdown }) {
  const check = `markdown agrees with html ${path}`;
  if (markdown.contentLocation?.startsWith('//')) {
    return finding(check, 'fail', `content-location ${markdown.contentLocation} names a host`);
  }
  if (markdown.status !== html.status) {
    return finding(check, 'fail', `html answered ${html.status}, markdown answered ${markdown.status}`);
  }
  if (markdown.location !== html.location) {
    return finding(check, 'fail', `html redirected to ${html.location}, markdown to ${markdown.location}`);
  }
  return finding(
    check,
    'pass',
    `both answered ${html.status}${html.location === undefined ? '' : ` to ${html.location}`}`
  );
}

export function varyVerdict(representation, vary) {
  const check = `vary / ${representation}`;
  const names = (vary ?? '').split(',').map((name) => name.trim().toLowerCase());
  if (names.includes('accept')) return finding(check, 'pass', `vary: ${vary}`);
  return finding(check, 'fail', vary ? `vary: ${vary}, which omits Accept` : 'no vary header');
}

export function canonicalHostVerdict({ status, location }, origin, path) {
  const check = `www redirect ${path}`;
  const expected = `${origin}${path}`;
  if (status !== 301) return finding(check, 'fail', `answered ${status}, expected 301`);
  return location === expected
    ? finding(check, 'pass', `301 to ${expected}`)
    : finding(check, 'fail', `301 to ${location}, expected ${expected}`);
}

export function renderSmoke(origin, rows, revision) {
  const failures = rows.filter((row) => row.status === 'fail');
  return [
    '# Production smoke',
    '',
    `Generated-from: ${revision}`,
    '',
    `Measured against \`${origin}\` by \`npm run smoke:prod\`. Every row is read from a live response, and a`,
    'row that compares two answers asks twice; nothing here is read from a config file.',
    '',
    `failures: ${failures.length}`,
    '',
    '| Check | Status | Detail |',
    '|---|---|---|',
    ...rows.map((row) => `| ${row.check} | ${row.status} | ${row.detail} |`),
    '',
  ].join('\n');
}
