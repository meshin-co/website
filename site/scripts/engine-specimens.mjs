import { join } from 'node:path';

const GATE = 'gate:engine';
const CONFIG_PATH = 'engine.config.json';
const ANCHOR_PATH = '../docs/CONTENT-GATE.md';
const WORKFLOW_PATH = '../.github/workflows/ci.yml';
const CLASSIFIER_CALL = /run: node scripts\/run-classify-diff\.mjs.*/;
const SHELL_CASE =
  'run: case "$(git diff --name-only "$BEFORE" "$AFTER")" in *.md) echo code=false ;; *) echo code=true ;; esac >> "$GITHUB_OUTPUT"';

const withoutAttemptCap = (text) => {
  const config = JSON.parse(text);
  delete config.loop.attemptCap;
  return `${JSON.stringify(config, null, 2)}\n`;
};

export const engineSpecimens = ({ editFile, removeFile }) => ({
  engineConfigValueRemoved: {
    gate: GATE,
    token: 'ENGINE config-invalid loop.attemptCap: is required in site/engine.config.json',
    plant: (copySite) => editFile(join(copySite, CONFIG_PATH), withoutAttemptCap),
  },
  engineAnchorFileRemoved: {
    gate: GATE,
    token: 'ENGINE anchor-missing docs/CONTENT-GATE.md: the file is absent',
    plant: (copySite) => removeFile(join(copySite, ANCHOR_PATH)),
  },
  engineClassifierReexpressed: {
    gate: GATE,
    token: 'ENGINE classifier-not-called .github/workflows/ci.yml',
    plant: (copySite) => editFile(join(copySite, WORKFLOW_PATH), (text) => text.replace(CLASSIFIER_CALL, SHELL_CASE)),
  },
});
