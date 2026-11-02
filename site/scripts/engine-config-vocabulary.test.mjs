import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { PROFILES } from './content-rows.mjs';
import { ENGINE_SCHEMA } from './engine-config.mjs';
import { FAMILY_GRAMMAR } from './semantic-core.mjs';

const defs = ENGINE_SCHEMA.$defs;

test('the families the schema allows are the families the title grammar knows', () => {
  const grammar = Object.keys(FAMILY_GRAMMAR).sort();
  assert.deepEqual([...defs.routeRule.properties.family.enum].sort(), grammar);
  assert.deepEqual([...defs.routeClass.properties.family.enum].sort(), grammar);
});

test('the profiles the schema allows are the profiles the content gate knows', () => {
  const profiles = Object.keys(PROFILES).sort();
  assert.deepEqual([...defs.routeRule.properties.profile.enum].sort(), profiles);
  assert.deepEqual([...defs.routeClass.properties.profile.enum].sort(), profiles);
});
