import { readFile } from 'node:fs/promises';
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
const PARTITION_LIST = '--list';
const DOCUMENTS_ROOT = 'docs';
const SKILLS_ROOT = '.agents/skills';
const PROCEDURE = 'zz-specimen-procedure';
const RECORD = 'zz-specimen-record';
const SITE_MARKER = '.site';
const DOCUMENT_TEXT = '# A document\n\nOne step, then the next.\n';
const ENGINE_CONFIG = 'engine.config.json';
const OWNER_WORD = 'Index';
const VOCABULARY_DOCUMENT = 'zz-specimen-vocabulary';
const VOCABULARY_TEXT = `# A document\n\nThe ${OWNER_WORD.toLowerCase()} lists each step.\n`;

const documentPath = (name) => `${DOCUMENTS_ROOT}/${name}.md`;
const skillPath = (name, marker = '') => `${SKILLS_ROOT}/${name}${marker}.md`;
const withoutMentions = (name) => (text) => text.replaceAll(name, '');

async function plantTogether(plantFirst, plantSecond) {
  const restoreFirst = await plantFirst();
  try {
    const restoreSecond = await plantSecond();
    return async () => {
      await restoreSecond();
      await restoreFirst();
    };
  } catch (error) {
    await restoreFirst();
    throw error;
  }
}

const documentNamedBy =
  (addFile, { skill, document, text = DOCUMENT_TEXT }) =>
  (copySite) =>
    plantTogether(
      () => addFile(join(copySite, '..', document), text),
      () => addFile(join(copySite, skill), `Follow ${document}.\n`)
    );

async function authorEntryOf(copySite) {
  const { content } = JSON.parse(await readFile(join(copySite, ENGINE_CONFIG), 'utf8'));
  return join(copySite, '..', content.dataDirectory, 'author', `${content.formats.article.author}.md`);
}

const ownerWithTheWord = (text) => text.replace(/^name:.*$/m, (line) => `${line} ${OWNER_WORD}`);

const documentUsingOwnerWord =
  ({ addFile, editFile }) =>
  (copySite) =>
    plantTogether(
      async () => editFile(await authorEntryOf(copySite), ownerWithTheWord),
      () =>
        documentNamedBy(addFile, {
          skill: skillPath(VOCABULARY_DOCUMENT),
          document: documentPath(VOCABULARY_DOCUMENT),
          text: VOCABULARY_TEXT,
        })(copySite)
    );

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
    token: 'EXPORT step-failed build: exit 1',
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
  partitionSkillNamedDocumentTravels: {
    gate: PARTITION_GATE,
    args: [PARTITION_LIST],
    warns: true,
    token: `engine engine-document ${documentPath(PROCEDURE)}`,
    plant: documentNamedBy(addFile, { skill: skillPath(PROCEDURE), document: documentPath(PROCEDURE) }),
  },
  partitionMarkedSkillNamedDocumentStays: {
    gate: PARTITION_GATE,
    args: [PARTITION_LIST],
    warns: true,
    token: `site unread-prose ${documentPath(RECORD)}`,
    plant: documentNamedBy(addFile, { skill: skillPath(RECORD, SITE_MARKER), document: documentPath(RECORD) }),
  },
  partitionOwnerWordIsVocabulary: {
    gate: PARTITION_GATE,
    args: [PARTITION_LIST],
    warns: true,
    token: `engine engine-document ${documentPath(VOCABULARY_DOCUMENT)}`,
    plant: documentUsingOwnerWord({ addFile, editFile }),
  },
});
