import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { OPENAI_LIST } from './fixtures/writer-model-lists.mjs';
import { WriterError } from './writer-error.mjs';
import * as models from './writer-models.mjs';

const { checkModel, normalizeOpenAiModels, shutdownNote } = models;
const list = () => normalizeOpenAiModels(OPENAI_LIST);
const VARIABLE = 'OPENAI_WRITING_MODEL';

const refusal = (call) => {
  try {
    call();
  } catch (error) {
    return error;
  }
  return assert.fail('the call did not throw');
};

test('the module exports the OpenAI normaliser, checkModel and shutdownNote only', () => {
  assert.deepEqual(Object.keys(models).sort(), ['checkModel', 'normalizeOpenAiModels', 'shutdownNote']);
});

test('the fixture is the documented shape with one announced shutdown', () => {
  assert.deepEqual(Object.keys(OPENAI_LIST), ['object', 'data']);
  assert.equal(OPENAI_LIST.object, 'list');
  assert.equal(OPENAI_LIST.data.filter((entry) => entry.shutdown_date).length, 1);
  for (const entry of OPENAI_LIST.data) {
    assert.deepEqual(
      Object.keys(entry)
        .filter((key) => key !== 'shutdown_date')
        .sort(),
      ['created', 'id', 'object', 'owned_by']
    );
  }
});

test('normalise: ids with the shutdown date, absent or null is null', () => {
  assert.deepEqual(list(), [
    { id: 'gpt-6.1-terra', shutdownDate: null },
    { id: 'gpt-6.1-sol', shutdownDate: null },
    { id: 'gpt-5.4', shutdownDate: '2027-01-15' },
    { id: 'gpt-4o', shutdownDate: null },
  ]);
});

test('normalise: only a real YYYY-MM-DD counts as a date', () => {
  for (const value of ['2027-13-45', '2027-1-5', 1798761600, '', 'soon', {}]) {
    const [entry] = normalizeOpenAiModels({ data: [{ id: 'm', shutdown_date: value }] });
    assert.equal(entry.shutdownDate, null, String(value));
  }
});

test('a payload without a data array is a vendor error', () => {
  for (const payload of [null, {}, { data: 'x' }, []]) {
    const error = refusal(() => normalizeOpenAiModels(payload));
    assert.ok(error instanceof WriterError);
    assert.equal(error.kind, 'vendor');
  }
});

test('entries without a string id are skipped', () => {
  assert.deepEqual(normalizeOpenAiModels({ data: [{ id: 7 }, null, { id: 'ok' }] }), [
    { id: 'ok', shutdownDate: null },
  ]);
});

test('checkModel: a present id without a date has no note', () => {
  assert.deepEqual(checkModel({ model: 'gpt-6.1-terra', modelVariable: VARIABLE, models: list() }), {
    id: 'gpt-6.1-terra',
    shutdownDate: null,
    note: null,
  });
});

test('checkModel: an id with a shutdown date carries the digest sentence', () => {
  const found = checkModel({ model: 'gpt-5.4', modelVariable: VARIABLE, models: list() });
  assert.equal(found.id, 'gpt-5.4');
  assert.equal(found.shutdownDate, '2027-01-15');
  assert.equal(found.note, shutdownNote({ model: 'gpt-5.4', modelVariable: VARIABLE, shutdownDate: '2027-01-15' }));
  for (const part of [VARIABLE, 'gpt-5.4', '2027-01-15']) assert.ok(found.note.includes(part), part);
  assert.equal(found.note.includes('\n'), false);
});

test('checkModel: an absent id fails naming variable and value', () => {
  const error = refusal(() => checkModel({ model: 'gpt-nope', modelVariable: VARIABLE, models: list() }));
  assert.ok(error instanceof WriterError);
  assert.equal(error.kind, 'model');
  assert.deepEqual(error.variables, [VARIABLE]);
  assert.equal(error.message, `${VARIABLE} is "gpt-nope", which is not in the vendor's model list`);
});

test('checkModel: the unknown-id message lists nothing from the vendor', () => {
  const error = refusal(() => checkModel({ model: 'x', modelVariable: VARIABLE, models: list() }));
  for (const { id } of list()) assert.equal(error.message.includes(id), false);
});

test('checkModel: an id that is only a prefix of a listed id does not match', () => {
  for (const model of ['gpt-6', 'gpt-6.1', 'gpt-6.1-ter', 'gpt-5', 'gpt-4']) {
    assert.equal(refusal(() => checkModel({ model, modelVariable: VARIABLE, models: list() })).kind, 'model', model);
  }
});
