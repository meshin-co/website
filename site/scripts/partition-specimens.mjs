import { join } from 'node:path';

import { brandFromDisk } from '../src/utils/brand.mjs';

const PARTITION_GATE = 'gate:partition';
const EXPORT_GATE = 'gate:export';
const STRAY_FILE = '../mystery.bin';
const SEEDED_TAGS = '../seed/site/src/data/tags.mjs.seed';
const NAMING_SKILL = '.agents/skills/names-the-site.md';
const STYLEGUIDE_PAGE = 'src/pages/styleguide.astro';
const MISSING_IMPORT = "import '~/data/author/nobody-here.md';";

export const partitionSpecimens = ({ editFile, removeFile, addFile }) => ({
  partitionFileFitsNoRule: {
    gate: PARTITION_GATE,
    token: 'PARTITION unclassified mystery.bin: fits no rule',
    plant: (copySite) => addFile(join(copySite, STRAY_FILE), 'a file no rule describes'),
  },
  partitionAnchorUnserved: {
    gate: PARTITION_GATE,
    token: 'PARTITION anchor-unserved site/src/data/tags.mjs',
    plant: (copySite) => removeFile(join(copySite, SEEDED_TAGS)),
  },
  partitionSiteBound: {
    gate: PARTITION_GATE,
    token: 'PARTITION site-bound site/.agents/skills/names-the-site.md',
    plant: (copySite) =>
      addFile(join(copySite, NAMING_SKILL), `# Skill\n\nAsk the owner of ${brandFromDisk().name}.\n`),
  },
  exportBuildBroken: {
    gate: EXPORT_GATE,
    token: 'EXPORT step-failed astro build: exit 1',
    plant: (copySite) =>
      editFile(join(copySite, STYLEGUIDE_PAGE), (text) => text.replace('---\n', `---\n${MISSING_IMPORT}\n`)),
  },
});
