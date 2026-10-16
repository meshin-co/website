import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

import { linkArgs, linkFindings, siteOrigin } from './links-gate.mjs';

const binary = join('node_modules', '.bin', 'linkinator');
const hermetic = process.env.LINKS_SKIP_EXTERNAL === '1';
const args = linkArgs({ skipExternal: hermetic, origin: siteOrigin(join('src', 'config.yaml')), json: true });
const result = spawnSync(binary, args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

if (result.error) throw result.error;

const { links = [] } = JSON.parse(result.stdout);
if (links.length === 0) {
  console.error('LINKS parsed no results from linkinator, so this run checked nothing');
  process.exit(1);
}

const { dead, unreachable } = linkFindings(links);

for (const finding of dead) console.error(`LINKS dead ${finding}`);
for (const finding of unreachable) console.error(`LINKS unreachable, not a dead citation: ${finding}`);

if (hermetic) console.log('links: hermetic run, every host outside the build was skipped');
console.log(`links: ${links.length} scanned, ${dead.length} dead, ${unreachable.length} unreachable`);

if (dead.length > 0) process.exitCode = 1;
