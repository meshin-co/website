const TERM_ARM_VARIABLE = 'WRITING_TERM_ARM';
const TERM_CAP_VARIABLE = 'WRITING_TERM_CAP';

const DEFAULT_TERM_ARM = true;
const DEFAULT_TERM_CAP = 1;
const WHOLE_NUMBER = /^\d+$/;

export class SettingsError extends Error {
  constructor(problems) {
    super(problems.map(({ text }) => text).join('; '));
    this.name = 'SettingsError';
    this.variables = problems.map(({ variable }) => variable);
  }
}

const valueOf = (env, name) => (typeof env[name] === 'string' ? env[name].trim() : '');

const refusal = (variable, value, expected) => ({
  variable,
  text: `${variable} is ${JSON.stringify(value)} (expected ${expected})`,
});

function readTermArm(env) {
  const value = valueOf(env, TERM_ARM_VARIABLE);
  if (value === '') return { setting: DEFAULT_TERM_ARM };
  const choice = value.toLowerCase();
  if (choice === 'on' || choice === 'off') return { setting: choice === 'on' };
  return { problem: refusal(TERM_ARM_VARIABLE, value, 'on or off') };
}

function readTermCap(env) {
  const value = valueOf(env, TERM_CAP_VARIABLE);
  if (value === '') return { setting: DEFAULT_TERM_CAP };
  const number = Number(value);
  if (WHOLE_NUMBER.test(value) && Number.isSafeInteger(number) && number >= 1) return { setting: number };
  return { problem: refusal(TERM_CAP_VARIABLE, value, 'a whole number from 1') };
}

export function readTopicSettings(env) {
  const arm = readTermArm(env);
  const cap = readTermCap(env);
  const problems = [arm.problem, cap.problem].filter(Boolean);
  if (problems.length > 0) throw new SettingsError(problems);
  return { termArm: arm.setting, termCap: cap.setting };
}
