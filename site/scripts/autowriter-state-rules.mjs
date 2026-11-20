import { existsSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { LEGACY_FILES, STATE_BRANCH, STATE_DIRECTORY, hasState, isLegacyRecord } from './record-layout.mjs';

const LEGACY_ROOT = 'audits/autowriter';

export const NOT_CHECKED_OUT = `check the branch ${STATE_BRANCH} out at ${STATE_DIRECTORY}/ (git fetch origin ${STATE_BRANCH} && git worktree add ${STATE_DIRECTORY} ${STATE_BRANCH})`;

const finding = (rule, path, detail) => ({ rule, path, detail });

export function stateFindings(root) {
  if (hasState(root)) return [];
  return [
    finding(
      'state-missing',
      STATE_DIRECTORY,
      `the folder is absent, so the ledger, escalation, claim, attempt-cap and spend report rules would judge no file, and a gate that judges nothing reads as a pass; ${NOT_CHECKED_OUT}`
    ),
  ];
}

function filesBelow(root, directory) {
  if (!existsSync(join(root, directory))) return [];
  return readdirSync(join(root, directory), { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(root, join(entry.parentPath, entry.name)).split(sep).join('/'));
}

export function legacyLayoutFindings(root) {
  const present = [...filesBelow(root, LEGACY_ROOT), ...LEGACY_FILES.filter((path) => existsSync(join(root, path)))];
  return present
    .filter(isLegacyRecord)
    .sort()
    .map((path) =>
      finding(
        'legacy-layout-present',
        path,
        `is filed in the layout that predates the branch ${STATE_BRANCH}; the ledgers, the claims, the spend report and the two demand reports live on that branch at ${STATE_DIRECTORY}/, so a tree that holds this file puts a shared record back in main`
      )
    );
}
