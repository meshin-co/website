import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PROVENANCE = /^Generated-from: (.+)$/m;
const REVISION = /^[0-9a-f]{7,40}$/;
const ARTEFACT = /^audits\/.+\.md$/;

const UNRECORDED_REVISION =
  'a Calibration Gate report written before any generator stamped a revision: it names only "a revision before 6a0c9c2", and its raw Lighthouse runs are gitignored, so it cannot be regenerated';

export const LEGACY_PROSE_PROVENANCE = Object.freeze({
  'audits/phase-1/REPORT.md': UNRECORDED_REVISION,
  'audits/phase-2/REPORT.md': UNRECORDED_REVISION,
  'audits/phase-3/REPORT.md': UNRECORDED_REVISION,
  'audits/phase-4/REPORT.md': UNRECORDED_REVISION,
  'audits/phase-4.5/REPORT.md': UNRECORDED_REVISION,
  'audits/phase-4.6/REPORT.md': UNRECORDED_REVISION,
  'audits/phase-4.7/REPORT.md': UNRECORDED_REVISION,
  'audits/phase-5/REPORT.md': UNRECORDED_REVISION,
});

const notACommit = (token, type) =>
  type === undefined
    ? `"${token}" names no object in this repository, so it is not the commit this file was generated from`
    : `"${token}" names a ${type}, not a commit: name the commit this file was generated from`;

function revisionFinding(path, provenance, objectType) {
  const [token] = provenance.split(/\s+/);
  if (!REVISION.test(token)) {
    if (Object.hasOwn(LEGACY_PROSE_PROVENANCE, path)) return [];
    return [
      {
        path,
        rule: 'provenance-not-a-hash',
        detail: `"Generated-from:" must start with a commit hash of 7 to 40 lowercase hex digits, not "${token}"`,
      },
    ];
  }
  const type = objectType(token);
  return type === 'commit' ? [] : [{ path, rule: 'provenance-not-a-commit', detail: notACommit(token, type) }];
}

export function provenanceFindings(artefacts, objectType) {
  return artefacts.flatMap(({ path, text }) => {
    if (!ARTEFACT.test(path)) return [];
    const provenance = PROVENANCE.exec(text)?.[1]?.trim();
    if (!provenance)
      return [
        {
          path,
          rule: 'no-provenance',
          detail:
            'needs a "Generated-from:" line naming the commit it was generated from: every markdown file under audits/ does',
        },
      ];
    return revisionFinding(path, provenance, objectType);
  });
}

export function withProvenance(markdown, revision) {
  const [title, ...rest] = markdown.split('\n');
  return [title, '', `Generated-from: ${revision}`, ...rest].join('\n');
}

export function gitObjectType(repo) {
  return (token) => {
    try {
      return execFileSync('git', ['cat-file', '-t', token], {
        cwd: repo,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
    } catch (error) {
      if (error.code === 'ENOENT') throw error;
      return undefined;
    }
  };
}

export function readArtefacts(repo, paths) {
  return paths.map((path) => ({ path, text: readFileSync(join(repo, path), 'utf8') }));
}
