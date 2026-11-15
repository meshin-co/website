import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function workspace() {
  const root = mkdtempSync(join(tmpdir(), 'smoke-prod-'));
  const site = join(root, 'site');
  const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'ignore' });
  git('init', '-q');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'x');
  mkdirSync(join(site, 'src'), { recursive: true });
  writeFileSync(join(site, 'src', 'config.yaml'), 'site:\n  name: example.test\n');
  return { root, site };
}
