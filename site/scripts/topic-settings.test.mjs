import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { SettingsError, readTopicSettings } from './topic-settings.mjs';

function failureOf(env) {
  try {
    readTopicSettings(env);
  } catch (error) {
    return error;
  }
  return assert.fail('readTopicSettings did not throw for ' + JSON.stringify(env));
}

test('with neither variable set the term arm is on and one term may be added', () => {
  assert.deepEqual(readTopicSettings({}), { termArm: true, termCap: 1 });
});

test('an empty value reads as unset, because a repository variable that was never created arrives empty', () => {
  assert.deepEqual(readTopicSettings({ WRITING_TERM_ARM: '', WRITING_TERM_CAP: '  ' }), { termArm: true, termCap: 1 });
});

test('on and off switch the term arm whatever the case and the spaces around them', () => {
  for (const [text, expected] of [
    ['on', true],
    ['off', false],
    [' OFF ', false],
    ['On', true],
  ]) {
    assert.equal(readTopicSettings({ WRITING_TERM_ARM: text }).termArm, expected, text);
  }
});

test('the cap is a whole number from 1 and spaces around it do not matter', () => {
  for (const [text, expected] of [
    ['1', 1],
    ['3', 3],
    [' 12 ', 12],
  ]) {
    assert.equal(readTopicSettings({ WRITING_TERM_CAP: text }).termCap, expected, text);
  }
});

test('the two variables are read independently of each other', () => {
  assert.deepEqual(readTopicSettings({ WRITING_TERM_ARM: 'off', WRITING_TERM_CAP: '4' }), {
    termArm: false,
    termCap: 4,
  });
});

test('a value the arm cannot read is refused naming the variable and the value it held', () => {
  for (const text of ['yes', 'true', '1', 'enabled', 'of']) {
    const error = failureOf({ WRITING_TERM_ARM: text });
    assert.ok(error instanceof SettingsError, text);
    assert.equal(error.message, 'WRITING_TERM_ARM is ' + JSON.stringify(text) + ' (expected on or off)');
  }
});

test('a cap that is not a whole number from 1 is refused naming the variable and the value it held', () => {
  for (const text of ['0', '-1', '1.5', 'two', '1e3', '0x10', '3 terms', '99999999999999999999']) {
    const error = failureOf({ WRITING_TERM_CAP: text });
    assert.ok(error instanceof SettingsError, text);
    assert.equal(error.message, 'WRITING_TERM_CAP is ' + JSON.stringify(text) + ' (expected a whole number from 1)');
  }
});

test('both variables invalid at once are reported together in one error, in the order the arm and the cap come', () => {
  const error = failureOf({ WRITING_TERM_ARM: 'maybe', WRITING_TERM_CAP: '0' });
  assert.ok(error instanceof SettingsError);
  assert.equal(error.name, 'SettingsError');
  assert.equal(
    error.message,
    'WRITING_TERM_ARM is "maybe" (expected on or off); WRITING_TERM_CAP is "0" (expected a whole number from 1)'
  );
  assert.deepEqual(error.variables, ['WRITING_TERM_ARM', 'WRITING_TERM_CAP']);
});

test('one invalid variable is the only one the error names', () => {
  const error = failureOf({ WRITING_TERM_ARM: 'on', WRITING_TERM_CAP: 'many' });
  assert.deepEqual(error.variables, ['WRITING_TERM_CAP']);
  assert.doesNotMatch(error.message, /WRITING_TERM_ARM/);
});

test('the cap is checked while the arm is off, because a bad value should not wait for the day the arm turns on', () => {
  assert.deepEqual(failureOf({ WRITING_TERM_ARM: 'off', WRITING_TERM_CAP: '0' }).variables, ['WRITING_TERM_CAP']);
});

test('variables that belong to other parts of the writer are not read', () => {
  const env = { WRITING_PROVIDER: 'openai', OPENAI_WRITING_MODEL: 'x', PATH: '/bin' };
  assert.deepEqual(readTopicSettings(env), { termArm: true, termCap: 1 });
  assert.deepEqual(env, { WRITING_PROVIDER: 'openai', OPENAI_WRITING_MODEL: 'x', PATH: '/bin' });
});

test('the committed example carries both variables with values the reader accepts', () => {
  const example = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
  const assigned = Object.fromEntries(
    example
      .split('\n')
      .filter((line) => /^WRITING_TERM_[A-Z]+=/.test(line))
      .map((line) => line.split('='))
  );
  assert.deepEqual(Object.keys(assigned).sort(), ['WRITING_TERM_ARM', 'WRITING_TERM_CAP']);
  assert.doesNotThrow(() => readTopicSettings(assigned));
});
