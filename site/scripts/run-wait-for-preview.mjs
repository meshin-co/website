import { parseArgs } from 'node:util';

import { builtProbes, routesTheBuildLacks, waitForPreview } from './preview-wait.mjs';
import { CANONICAL, MACHINE } from './smoke-prod.mjs';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    dist: { type: 'string', default: 'dist' },
    'deadline-ms': { type: 'string', default: '120000' },
    'interval-ms': { type: 'string', default: '1000' },
  },
});

const fail = (message) => {
  console.error(`DEPLOY ${message}`);
  process.exit(1);
};

const origin = (positionals[0] ?? '').replace(/\/$/, '');
if (!URL.canParse(origin)) fail('the wait needs the preview address as its first argument');

const probes = builtProbes(values.dist);
const lacking = routesTheBuildLacks(probes, [...CANONICAL, ...MACHINE]);
if (lacking.length > 0) {
  fail(
    `the smoke checks ${lacking.join(', ')}, which the build does not hold; no amount of waiting makes a missing file appear`
  );
}

console.log(`preview: probing all ${probes.length} files the build holds at ${origin}`);
const result = await waitForPreview({
  origin,
  probes,
  deadlineMs: Number(values['deadline-ms']),
  intervalMs: Number(values['interval-ms']),
});

const seconds = (result.elapsedMs / 1000).toFixed(1);
if (result.ok) {
  console.log(`preview: every file served after ${result.sweeps} sweeps, ${seconds} s`);
  process.exit(0);
}

if (result.unserved.length === 0) {
  fail(`${origin} never answered every file in two sweeps running; ${result.sweeps} sweeps, ${seconds} s`);
}
const named = result.unserved.slice(0, 10).map(({ path, accept }) => (accept ? `${path} (Accept: ${accept})` : path));
const more = result.unserved.length > named.length ? `, and ${result.unserved.length - named.length} more` : '';
fail(
  `${origin} is still not serving ${result.unserved.length} of ${probes.length} files after ${seconds} s: ${named.join(', ')}${more}`
);
