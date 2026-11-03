import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { WORKFLOW_PATH, classifierWiringFindings } from './classify-wiring.mjs';
import { FIXED_ANCHORS, anchorsFor } from './engine-anchors.mjs';
import { ENGINE_SCHEMA, inspectEngineConfig } from './engine-config.mjs';
import { INTERVIEW_PATH, interviewFindings, readInterviewInputs } from './interview-coverage.mjs';
import { invokedDirectly } from './invoked-directly.mjs';

export const REPOSITORY_ROOT = resolve(import.meta.dirname, '..', '..');

const CONFIG_PATH = 'site/engine.config.json';
const USAGE = 'usage: node scripts/check-engine.mjs [--root <repository root>]';

const finding = (rule, where, detail) => ({ rule, where, detail });

const resolveRef = (schema, node) =>
  node.$ref === undefined
    ? node
    : resolveRef(
        schema,
        node.$ref
          .replace(/^#\//, '')
          .split('/')
          .reduce((at, key) => at[key], schema)
      );

function collect(schema, node, path, found) {
  const resolved = resolveRef(schema, node);
  if (resolved.type === 'object' && resolved.properties) {
    for (const [key, child] of Object.entries(resolved.properties)) {
      collect(schema, { description: child.description, ...child }, path === '' ? key : `${path}.${key}`, found);
    }
    return found;
  }
  const description = node.description ?? resolved.description ?? '';
  found.push({ path, type: resolved.type ?? (resolved.const === undefined ? 'value' : 'constant'), description });
  return found;
}

export const requiredValues = (schema = ENGINE_SCHEMA) =>
  Object.entries(schema.properties).flatMap(([key, child]) => collect(schema, child, key, []));

const descriptionOf = (values, path) => {
  const key = path.replace(/^\$\.?/, '').replace(/\[\d+\]/g, '');
  return values.find((value) => value.path === key)?.description ?? '';
};

const fieldOf = (path) => (path === '$' ? '$' : path.replace(/^\$\./, ''));

function configFindings(root) {
  const values = requiredValues();
  const file = join(root, CONFIG_PATH);
  if (!existsSync(file)) {
    return {
      config: null,
      findings: [
        finding(
          'config-missing',
          CONFIG_PATH,
          'the file does not exist; copy site/engine.config.json and set every value listed below'
        ),
        ...values.map(({ path, type, description }) => finding('config-value-unset', path, `${type}: ${description}`)),
      ],
    };
  }
  const { config, problems } = inspectEngineConfig(readFileSync(file, 'utf8'));
  return {
    config,
    findings: problems.map(({ path, problem }) =>
      finding(
        'config-invalid',
        fieldOf(path),
        `${problem} in ${CONFIG_PATH}; ${descriptionOf(values, path)}`.replace(/; $/, '')
      )
    ),
  };
}

const isKind = (path, kind) => {
  try {
    return statSync(path).isDirectory() === (kind === 'directory');
  } catch {
    return false;
  }
};

const anchorFindings = (root, anchors) =>
  anchors
    .filter(({ path, kind }) => !isKind(join(root, path), kind))
    .map(({ path, kind, role }) => finding('anchor-missing', path, `the ${kind} is absent; it is ${role}`));

const layoutFindings = (root, config) =>
  config === null
    ? []
    : config.diff.shippedDirectories
        .filter((directory) => !isKind(join(root, directory), 'directory'))
        .map((directory) =>
          finding(
            'shipped-directory-missing',
            directory,
            'the directory is absent, so the diff rules do not describe this checkout and every gate would run'
          )
        );

function workflowFindings(root) {
  const file = join(root, WORKFLOW_PATH);
  if (!existsSync(file)) return [];
  return classifierWiringFindings(readFileSync(file, 'utf8')).map(({ rule, detail }) =>
    finding(rule, WORKFLOW_PATH, detail)
  );
}

const interviewGapFindings = (root) =>
  interviewFindings({ configPaths: requiredValues().map(({ path }) => path), ...readInterviewInputs(root) });

export function engineFindings(root = REPOSITORY_ROOT) {
  const { config, findings: configProblems } = configFindings(root);
  const anchors = config === null ? FIXED_ANCHORS : anchorsFor(config);
  return {
    findings: [
      ...configProblems,
      ...anchorFindings(root, anchors),
      ...layoutFindings(root, config),
      ...workflowFindings(root),
      ...interviewGapFindings(root),
    ],
    values: requiredValues().length,
    anchors: anchors.length,
  };
}

function readRoot(argv) {
  try {
    const { values } = parseArgs({
      args: argv,
      options: { root: { type: 'string' } },
      strict: true,
      allowPositionals: false,
    });
    const root = values.root === undefined ? REPOSITORY_ROOT : resolve(values.root);
    return statSync(root).isDirectory() ? { root } : { error: `${root} is not a directory` };
  } catch (error) {
    return {
      error:
        error.code === 'ENOENT' ? `${resolve(argv[argv.indexOf('--root') + 1] ?? '')} does not exist` : error.message,
    };
  }
}

export function main(argv) {
  const { root, error } = readRoot(argv);
  if (error !== undefined) {
    console.error(`engine: ${error}\n${USAGE}`);
    process.exitCode = 2;
    return;
  }
  const { findings, values, anchors } = engineFindings(root);
  for (const { rule, where, detail } of findings) console.log(`ENGINE ${rule} ${where}: ${detail}`);
  const noun = findings.length === 1 ? 'finding' : 'findings';
  console.log(
    `engine: ${findings.length} ${noun} (${CONFIG_PATH} defines ${values} values, ${anchors} anchor files expected, the changes job of ${WORKFLOW_PATH} must call the classifier, and the interview must name every value, secret and variable)`
  );
  if (findings.length > 0) {
    console.log(`engine: the questions that set these values and create these files are in ${INTERVIEW_PATH}`);
  }
  process.exitCode = findings.length === 0 ? 0 : 1;
}

if (invokedDirectly(import.meta.filename, process.argv[1])) main(process.argv.slice(2));
