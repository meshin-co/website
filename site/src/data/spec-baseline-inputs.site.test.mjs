import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { validateJsonSchema } from '../../scripts/json-schema.mjs';

const folder = new URL('./spec/evals-baseline-1.0/', import.meta.url);
const schema = JSON.parse(readFileSync(new URL('baseline.schema.json', folder), 'utf8'));
const suite = JSON.parse(readFileSync(new URL('vectors.json', folder), 'utf8'));

const problemsOf = (document) => validateJsonSchema(schema, document);

const refusedByAReader = (path) =>
  suite.vectors.some((vector) => vector.baseline === path && vector.covers.includes('bad-baseline'));

function repeatsAKey(text) {
  const keysOfOpenContainers = [];
  let lastString = '';
  for (let at = 0; at < text.length; at++) {
    const character = text[at];
    if (character === '"') {
      let end = at + 1;
      while (text[end] !== '"') end += text[end] === '\\' ? 2 : 1;
      lastString = JSON.parse(text.slice(at, end + 1));
      at = end;
    } else if (character === '{') {
      keysOfOpenContainers.push(new Set());
    } else if (character === '[') {
      keysOfOpenContainers.push(null);
    } else if (character === '}' || character === ']') {
      keysOfOpenContainers.pop();
    } else if (character === ':') {
      const keys = keysOfOpenContainers.at(-1);
      if (keys.has(lastString)) return true;
      keys.add(lastString);
    }
  }
  return false;
}

test('a key that appears twice in one object is found, and the same key in two objects is not', () => {
  assert.equal(repeatsAKey('{"a":1,"a":2}'), true);
  assert.equal(repeatsAKey('{"a":{"b":1},"c":{"b":2}}'), false);
  assert.equal(repeatsAKey('{"a":[{"b":1},{"b":2}]}'), false);
  assert.equal(repeatsAKey('{"ab":1,"a\\u0062":2}'), true);
  assert.equal(repeatsAKey('{"a":"x:y","b":"a"}'), false);
});

test('every baseline the vectors embed as an input is valid exactly when a reader accepts it, except a repeated key', () => {
  assert.ok(suite.files !== undefined, 'the vectors file embeds no input file, so no input baseline was checked');
  const paths = [...new Set(suite.vectors.map((vector) => vector.baseline).filter(Boolean))].filter((path) =>
    Object.hasOwn(suite.files, path)
  );
  let acceptedBySchema = 0;
  let refusedBySchema = 0;
  for (const path of paths) {
    const text = suite.files[path];
    let document;
    try {
      document = JSON.parse(text);
    } catch {
      assert.ok(refusedByAReader(path), `${path} is not JSON and no vector refuses it`);
      continue;
    }
    if (repeatsAKey(text)) {
      assert.ok(refusedByAReader(path), `${path} repeats a key and no vector refuses it`);
      continue;
    }
    const valid = problemsOf(document).length === 0;
    assert.equal(valid, !refusedByAReader(path), `${path}: the schema and the vectors disagree`);
    if (valid) acceptedBySchema += 1;
    else refusedBySchema += 1;
  }
  assert.ok(acceptedBySchema > 0, 'no accepted baseline is embedded, so the schema was never shown to accept one');
  assert.ok(refusedBySchema > 0, 'no refused baseline is embedded, so the schema was never shown to refuse one');
});
