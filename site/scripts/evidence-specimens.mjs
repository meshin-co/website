import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const headTree = (copySite) =>
  execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: copySite, encoding: 'utf8' }).trim();

export const evidenceSpecimens = ({ addUntrackedFile }) => ({
  evidenceRevisionNotACommit: {
    gate: 'gate:evidence',
    token: 'provenance-not-a-commit audits/zz-specimen.md',
    plant: (copySite) =>
      addUntrackedFile(
        join(copySite, '../audits/zz-specimen.md'),
        `# Specimen\n\nGenerated-from: ${headTree(copySite)}\n`
      ),
  },
  evidenceProseOffAllowList: {
    gate: 'gate:evidence',
    token: 'provenance-not-a-hash audits/phase-zz/REPORT.md',
    plant: (copySite) =>
      addUntrackedFile(
        join(copySite, '../audits/phase-zz/REPORT.md'),
        '# Report\n\nGenerated-from: the current main branch\n'
      ),
  },
});
