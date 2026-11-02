import { WriterError } from './writer-error.mjs';

export const PROVIDER_VARIABLE = 'WRITING_PROVIDER';

export const VENDORS = {
  openai: {
    id: 'openai',
    keyName: 'AUTOWRITER_OPENAI_API_KEY',
    modelVariable: 'OPENAI_WRITING_MODEL',
    rateVariables: {
      input: 'OPENAI_WRITING_INPUT_USD_PER_MILLION',
      output: 'OPENAI_WRITING_OUTPUT_USD_PER_MILLION',
    },
  },
};

const SHOWN_VALUE_LIMIT = 60;

const valueOf = (env, name) => (typeof env[name] === 'string' ? env[name].trim() : '');

const shown = (value, env) => {
  if (Object.values(VENDORS).some(({ keyName }) => value === valueOf(env, keyName))) return '[redacted]';
  return JSON.stringify(value.length > SHOWN_VALUE_LIMIT ? `${value.slice(0, SHOWN_VALUE_LIMIT)}...` : value);
};

const unset = (name) => ({ name, text: `${name} is not set` });

const providerProblem = (provider, env) => {
  const supported = `(supported: ${Object.keys(VENDORS).join(', ')})`;
  if (provider === '') return unset(PROVIDER_VARIABLE).text + ` ${supported}`;
  return `${PROVIDER_VARIABLE} is ${shown(provider, env)} ${supported}`;
};

const rateOf = (env, name) => {
  const text = valueOf(env, name);
  if (text === '') return { problem: unset(name) };
  const number = Number(text);
  if (Number.isFinite(number) && number > 0) return { number };
  return { problem: { name, text: `${name} is ${shown(text, env)} (expected a positive number)` } };
};

const vendorEntry = (spec, env, input, output) => {
  const { id, keyName, modelVariable, rateVariables } = spec;
  const rates = {
    inputVariable: rateVariables.input,
    outputVariable: rateVariables.output,
    inputPerMillion: input,
    outputPerMillion: output,
  };
  const entry = { id, keyName, modelVariable, model: valueOf(env, modelVariable), rates };
  return Object.defineProperty(entry, 'apiKey', { value: valueOf(env, keyName), enumerable: false });
};

const failWith = (problems) => {
  const kind = problems.some((problem) => problem.secret) ? 'credential' : 'config';
  const variables = problems.map((problem) => problem.name);
  throw new WriterError(kind, problems.map((problem) => problem.text).join('; '), { variables });
};

export function readWriterConfig(env) {
  const provider = valueOf(env, PROVIDER_VARIABLE);
  if (!Object.hasOwn(VENDORS, provider)) {
    failWith([{ name: PROVIDER_VARIABLE, text: providerProblem(provider, env) }]);
  }
  const spec = VENDORS[provider];
  const input = rateOf(env, spec.rateVariables.input);
  const output = rateOf(env, spec.rateVariables.output);
  const problems = [input.problem, output.problem].filter(Boolean);
  if (valueOf(env, spec.modelVariable) === '') problems.unshift(unset(spec.modelVariable));
  if (valueOf(env, spec.keyName) === '') problems.push({ ...unset(spec.keyName), secret: true });
  if (problems.length > 0) failWith(problems);
  return { provider, vendor: vendorEntry(spec, env, input.number, output.number) };
}
