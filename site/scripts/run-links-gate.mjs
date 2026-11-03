import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

import { probeAll } from './link-probe.mjs';
import { externalFindings, linkArgs, linkFindings, siteOrigin } from './links-gate.mjs';
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

const hermetic = process.env.LINKS_SKIP_EXTERNAL === '1';
const backoffMs = process.env.LINKS_PROBE_BACKOFF_MS?.split(',').map(Number);
const outbound = hermetic ? new Map() : readOutbound('dist', origin);
const probed = await probeAll([...outbound.keys()], { backoffMs });
const outside = externalFindings(probed, outbound);

for (const finding of outside.dead) console.error(`LINKS dead ${finding}`);
for (const finding of outside.unverified) console.error(`LINKS unverified, not dead: ${finding}`);

if (hermetic) console.log('links: hermetic run, outbound addresses were not probed');
console.log(
  `links: ${links.length} checked in the build; ${probed.size} outbound addresses probed with GET: ${outside.answered} answered, ${outside.dead.length} dead, ${outside.unverified.length} unverified`
);

if (insideBuild.length + outside.dead.length > 0) process.exitCode = 1;
