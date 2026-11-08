import { join } from 'node:path';

import { brandFromDisk } from '../src/utils/brand.mjs';
import { INTERVIEW_PATH } from './interview-coverage.mjs';

const PARTITION_GATE = 'gate:partition';
const EXPORT_GATE = 'gate:export';
const ENGINE_GATE = 'gate:engine';
const STRAY_FILE = '../mystery.bin';
const SEEDED_TAGS = '../seed/site/src/data/tags.mjs.seed';
const NAMING_SKILL = '.agents/skills/names-the-site.md';
const STYLEGUIDE_PAGE = 'src/pages/styleguide.astro';
const MISSING_IMPORT = "import '~/data/author/nobody-here.md';";
const INTERVIEW_COPY = `../${INTERVIEW_PATH}`;
const DROPPED_CONFIG_PATH = 'loop.claimLifetimeDays';
const DROPPED_SECRET = 'AUTOWRITER_PAT';
const REUSED_ID = 'S1';

const withoutMentions = (name) => (text) => text.replaceAll(name, '');

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
  interviewConfigValueDropped: {
    gate: ENGINE_GATE,
    token: `ENGINE interview-gap ${DROPPED_CONFIG_PATH}: config value;`,
    plant: (copySite) => editFile(join(copySite, INTERVIEW_COPY), withoutMentions(DROPPED_CONFIG_PATH)),
  },
  interviewWorkflowSecretDropped: {
    gate: ENGINE_GATE,
    token: `ENGINE interview-gap ${DROPPED_SECRET}: workflow secret;`,
    plant: (copySite) => editFile(join(copySite, INTERVIEW_COPY), withoutMentions(DROPPED_SECRET)),
  },
  interviewReusesAQuestionId: {
    gate: ENGINE_GATE,
    token: `ENGINE interview-duplicate-id ${REUSED_ID}: 2 questions in`,
    plant: (copySite) =>
      editFile(join(copySite, INTERVIEW_COPY), (text) => `${text}\n#### ${REUSED_ID}. A question that steals an id\n`),
  },
});
