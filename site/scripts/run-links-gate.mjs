import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';

import { linkArgs, linkFindings, malformedFindings, siteOrigin } from './links-gate.mjs';
import { readRegister, registerSummary } from './link-rot-register.mjs';
import { readOutbound } from './outbound-links.mjs';

const binary = join('node_modules', '.bin', 'linkinator');
const origin = siteOrigin(join('src', 'config.yaml'));
const result = spawnSync(binary, linkArgs({ origin, json: true }), { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

if (result.error) throw result.error;

const { links = [] } = JSON.parse(result.stdout);
if (links.length === 0) {
  console.error('LINKS parsed no results from linkinator, so this run checked nothing');
  process.exit(1);
}

const insideBuild = linkFindings(links);
for (const finding of insideBuild) console.error(`LINKS dead ${finding}`);

const outbound = readOutbound('dist', origin, { includeSkipped: true });
const malformed = malformedFindings(outbound);
for (const finding of malformed) console.error(`LINKS malformed ${finding}`);

const noun = outbound.size === 1 ? 'address' : 'addresses';
console.log(
  `links: ${links.length} checked in the build; ${outbound.size} outbound ${noun} read, not fetched (a gone one is the sweep's to repair, never this gate's to block)`
);

const { register, problems } = readRegister(resolve('..'));
for (const problem of problems) console.error(`LINKS register ${problem}`);
if (problems.length === 0) console.log(registerSummary(register));

if (insideBuild.length + malformed.length + problems.length > 0) process.exitCode = 1;
