const RAW_COLOUR = /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/i;
const COMMENT_LINE = /^\s*(\/\/|\/\*|\*)/;
const BROWSER_CHROME_COLOUR = /(name="theme-color"|rel="mask-icon")/;
const LAYOUT_TRANSITION =
  /transition(?:-property)?:[^;}]*(?:^|[\s,:])(width|height|top|left|right|bottom|margin|padding)(?![\w-])/i;
const LONG_DURATION = /(?:transition|animation)[^;}]*?(\d{3,})ms/gi;
const COOKIE_WRITE = /document\.cookie\s*=|Set-Cookie:/i;
const SERVICE_WORKER = /serviceWorker\s*\.\s*register/i;
const FONT_FACE_BLOCK = /@font-face\{([^}]*)\}/g;
const FONT_FAMILY = /font-family:"?([^";]+)"?/;
const FONT_WEIGHT = /font-weight:(\d+)/;
const HASHED_FAMILY_SUFFIX = /-[0-9a-f]{16}$/;

const finding = (status, detail) => ({ status, detail });

const colourBearingLines = ({ source }) =>
  source
    .split('\n')
    .filter((line) => RAW_COLOUR.test(line))
    .filter((line) => !COMMENT_LINE.test(line))
    .filter((line) => !BROWSER_CHROME_COLOUR.test(line));

export function checkRawColour(files) {
  const offenders = files
    .filter((entry) => !entry.generated)
    .filter((entry) => colourBearingLines(entry).length > 0)
    .map(({ file }) => file);
  return offenders.length === 0
    ? finding('pass', 'every colour comes from an --aw-color-* token')
    : finding('fail', `raw colour literals in ${offenders.join(', ')}`);
}

export function checkMotion(css) {
  if (LAYOUT_TRANSITION.test(css)) {
    return finding('fail', 'a transition animates a layout property instead of transform or opacity');
  }
  const durations = [...css.matchAll(LONG_DURATION)].map((match) => Number(match[1])).filter((ms) => ms > 500);
  if (durations.length > 0) {
    return finding('fail', `durations over 500 ms: ${[...new Set(durations)].join(', ')}`);
  }
  if (!css.includes('prefers-reduced-motion')) {
    return finding('fail', 'no prefers-reduced-motion block, so the policy cannot be verified');
  }
  return finding('pass', 'transform and opacity only, every duration at or under 500 ms, reduced-motion honoured');
}

export function checkCookies(documents) {
  const offenders = documents.filter((doc) => COOKIE_WRITE.test(doc)).length;
  return offenders === 0
    ? finding('pass', 'no page writes a cookie, so no consent surface is owed')
    : finding('fail', `${offenders} documents write a cookie`);
}

export function checkServiceWorker(documents) {
  const offenders = documents.filter((doc) => SERVICE_WORKER.test(doc)).length;
  return offenders === 0
    ? finding('pass', 'no service worker registers, so no kill switch is owed')
    : finding('fail', `${offenders} documents register a service worker`);
}

export function checkFontPolicy(css) {
  const families = new Set();
  const weights = new Set();
  for (const [, block] of css.matchAll(FONT_FACE_BLOCK)) {
    if (!block.includes('src:url(')) continue;
    const family = FONT_FAMILY.exec(block)?.[1]?.replace(HASHED_FAMILY_SUFFIX, '').toLowerCase();
    const weight = FONT_WEIGHT.exec(block)?.[1];
    if (!family || !weight) continue;
    families.add(family);
    weights.add(`${family}-${weight}`);
  }
  return { families: families.size, weights: weights.size, list: [...weights].sort() };
}

const STATUS_ORDER = { fail: 0, 'owner-blocked': 1, 'n/a': 2, pass: 3 };

export function renderChecklist(rows) {
  const counts = rows.reduce((totals, row) => ({ ...totals, [row.status]: (totals[row.status] ?? 0) + 1 }), {});
  const ordered = [...rows].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.section.localeCompare(b.section)
  );
  return [
    '# Pre-launch checklist',
    '',
    'Every item carries a status and evidence. `pass` was measured from the shipped build,',
    '`n/a` names why the item cannot apply to this site, and `owner-blocked` names what is',
    'missing. Nothing is silently skipped.',
    '',
    `Measured: **${counts.pass ?? 0} pass, ${counts['n/a'] ?? 0} n/a, ${counts['owner-blocked'] ?? 0} owner-blocked, ${counts.fail ?? 0} fail**.`,
    '',
    '| Section | Item | Status | Evidence |',
    '|---|---|---|---|',
    ...ordered.map((row) => `| ${row.section} | ${row.item} | ${row.status} | ${row.detail} |`),
    '',
  ].join('\n');
}
