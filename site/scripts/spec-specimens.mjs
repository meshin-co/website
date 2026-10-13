import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
export const SPEC_TREE_RANGE = `${EMPTY_TREE}..HEAD:openspec`;
export const WHOLE_TREE_RANGE = `${EMPTY_TREE}..HEAD`;

const CAPABILITY = 'governance/doc-honesty';
const specTreeIn = (copySite) => join(copySite, '..', 'openspec');
const capabilitySpec = (tree) => join(tree, 'specs', CAPABILITY, 'spec.md');

async function copySpecTreeAside(copySite) {
  const tree = specTreeIn(copySite);
  const aside = `${tree}.specimen-aside`;
  await cp(tree, aside, { recursive: true });
  return async () => {
    await rm(tree, { recursive: true, force: true });
    await rename(aside, tree);
  };
}

const inSpecTree = (change) => async (copySite) => {
  const restore = await copySpecTreeAside(copySite);
  try {
    await change(specTreeIn(copySite), copySite);
  } catch (error) {
    await restore();
    throw error;
  }
  return restore;
};

async function rewrite(file, change) {
  const pristine = await readFile(file, 'utf8');
  const edited = change(pristine);
  if (edited === pristine) throw new Error(`specimen edit changed nothing in ${file}`);
  await writeFile(file, edited);
}

const regenerate = (copySite, ...artefacts) => {
  for (const artefact of artefacts)
    execFileSync('node', [`scripts/generate-spec-${artefact}.mjs`, '..'], { cwd: copySite });
};

const PROPOSAL =
  '## Why\nThe mutation smoke plants this change in a disposable copy to prove that one gate:spec rule can fail.\n\n## What Changes\n- Adds one requirement to a specimen capability.\n';
const DELTA =
  '## ADDED Requirements\n### Requirement: The specimen change is planted\nThe specimen change SHALL exist only in a disposable copy.\n\n#### Scenario: The smoke plants the change\n- **WHEN** the smoke plants the change\n- **THEN** the change exists in the copy\n';
const CALIBRATED_TASKS = '## 1. Calibration Gate\n\n- [ ] 1.1 Run the Calibration Gate and commit its report\n';
const UNCALIBRATED_TASKS = '## 1. Specimen\n\n- [ ] 1.1 Plant the specimen\n';

async function addChange(tree, name, { metadata = '', tasks = CALIBRATED_TASKS, delta = DELTA, blocked = null } = {}) {
  const dir = join(tree, 'changes', name);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, '.openspec.yaml'), `schema: spec-driven\n${metadata}`);
  await writeFile(join(dir, 'proposal.md'), PROPOSAL);
  if (blocked) await writeFile(join(dir, 'blocked.md'), blocked);
  if (tasks) await writeFile(join(dir, 'tasks.md'), tasks);
  if (delta) {
    await mkdir(join(dir, 'specs', 'zz-specimen'), { recursive: true });
    await writeFile(join(dir, 'specs', 'zz-specimen', 'spec.md'), delta);
  }
}

const DOT_DIRECTORY_SPEC =
  '# zz-specimen Specification\n\n## Purpose\nA capability in a dot-directory, which the validator skips and the tree walk counts.\n\n## Requirements\n### Requirement: The specimen is planted\nThe specimen SHALL sit where only the tree walk finds it.\n\n#### Scenario: The smoke plants it\n- **WHEN** the smoke plants the specimen\n- **THEN** the tree walk counts it and the validator does not\n';
const HAND_TYPED_INDEX_ROW = '- [zz-specimen](specs/zz-specimen/spec.md) \u2014 A row typed by hand.\n';

const specimen = (token, change, range = SPEC_TREE_RANGE) => ({
  gate: 'gate:spec',
  env: { SPEC_GATE_RANGE: range },
  token,
  plant: inSpecTree(change),
});

export const SPEC_SPECIMENS = {
  specScenarioMissing: specimen(`validate spec ${CAPABILITY}: Requirement must have at least one scenario`, (tree) =>
    rewrite(capabilitySpec(tree), (text) => text.replace(/\n#### Scenario:[\s\S]*?(?=\n### Requirement: )/, '\n'))
  ),
  specValidatorSawNothing: specimen('spec-vacuous: the validator reported zero specs', async (tree, copySite) => {
    await rm(join(tree, 'specs'), { recursive: true });
    await mkdir(join(tree, 'specs'));
    regenerate(copySite, 'census', 'index');
  }),
  specHiddenFromValidator: specimen('spec-count-disagreement: the validator sees', async (tree, copySite) => {
    await mkdir(join(tree, 'specs', '.zz-specimen'));
    await writeFile(join(tree, 'specs', '.zz-specimen', 'spec.md'), DOT_DIRECTORY_SPEC);
    regenerate(copySite, 'census', 'index');
  }),
  specRequirementRenamed: specimen(
    `census-drift ${CAPABILITY}: requirement names differ from the committed census`,
    (tree) =>
      rewrite(capabilitySpec(tree), (text) => text.replace('### Requirement: ', '### Requirement: zz-specimen '))
  ),
  specCapabilityDeleted: specimen(
    `census-missing ${CAPABILITY}: committed but absent from the tree`,
    async (tree, copySite) => {
      await rm(join(tree, 'specs', CAPABILITY), { recursive: true });
      regenerate(copySite, 'index');
    }
  ),
  specIndexHandEdited: specimen('index-drift: openspec/INDEX.md differs from a regeneration', (tree) =>
    rewrite(join(tree, 'INDEX.md'), (text) => `${text}${HAND_TYPED_INDEX_ROW}`)
  ),
  specLockedRowMissing: specimen(
    `locked-row-missing ${CAPABILITY}: L999 is not a row in the locked decisions`,
    (tree) =>
      rewrite(capabilitySpec(tree), (text) =>
        text.replace(/^- \*\*THEN\*\* .*$/m, '$&, as locked decision L999 requires')
      )
  ),
  changeWithoutNumber: specimen('change-name zz-specimen: an active change is named NN-slug', (tree) =>
    addChange(tree, 'zz-specimen')
  ),
  changeBelowTen: specimen('change-prefix 09-zz-specimen: prefixes below 10 collide', (tree) =>
    addChange(tree, '09-zz-specimen')
  ),
  changeNumberTaken: specimen('prefix 10 already belongs to 10-zz-', async (tree) => {
    await addChange(tree, '10-zz-specimen');
    await addChange(tree, '10-zz-twin');
  }),
  changeWithoutTasks: specimen('change-without-tasks 10-zz-specimen', (tree) =>
    addChange(tree, '10-zz-specimen', { tasks: null })
  ),
  changeSkippingSpecs: specimen('skip-specs-with-deltas 10-zz-specimen', (tree) =>
    addChange(tree, '10-zz-specimen', { metadata: 'skip_specs: true\n' })
  ),
  changesInFlight: specimen('two-active-changes:', async (tree) => {
    await addChange(tree, '10-zz-specimen');
    await addChange(tree, '11-zz-specimen');
  }),
  changeParkedWithoutAGapRow: specimen('two-active-changes:', async (tree) => {
    await addChange(tree, '10-zz-specimen');
    await addChange(tree, '11-zz-specimen', { blocked: 'waiting for a quiet week' });
  }),
  changeParkedOnAGapRowThatDoesNotExist: specimen('two-active-changes:', async (tree) => {
    await addChange(tree, '10-zz-specimen');
    await addChange(tree, '11-zz-specimen', { blocked: 'G999 keeps this parked' });
  }),
  changeOwingCalibration: specimen(
    'change-without-calibration 10-zz-specimen',
    (tree) => addChange(tree, '10-zz-specimen', { tasks: UNCALIBRATED_TASKS }),
    WHOLE_TREE_RANGE
  ),
};
