import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readEngineConfig } from './engine-config.mjs';
import { credentialsFrom } from './search-demand.mjs';

const KEY = JSON.stringify({ client_email: 'reader@example.iam.gserviceaccount.com', private_key: 'PRIVATE KEY here' });

test('the Search Console property comes from the engine configuration, because it is not a secret', () => {
  const configured = readEngineConfig().demand.property;

  assert.equal(typeof configured, 'string');
  assert.ok(configured.length > 0, 'the engine configuration names the property');

  const { property } = credentialsFrom({ GSC_SERVICE_ACCOUNT_JSON: KEY }, 'secret');

  assert.equal(property, configured);
});

test('an environment variable still overrides the configured property, so another property can be read without an edit', () => {
  const { property } = credentialsFrom(
    { GSC_SERVICE_ACCOUNT_JSON: KEY, GSC_PROPERTY: 'sc-domain:elsewhere.test' },
    'secret'
  );

  assert.equal(property, 'sc-domain:elsewhere.test');
});
