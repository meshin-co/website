import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';

import {
  CREDENTIAL_EXIT_CODE,
  credentialsFrom,
  queryRejection,
  signAssertion,
  tokenRejection,
} from './search-demand.mjs';

const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
const ENV = {
  GSC_SERVICE_ACCOUNT_JSON: JSON.stringify({
    client_email: 'reader@example.iam.gserviceaccount.com',
    private_key: privateKey,
  }),
  GSC_PROPERTY: 'sc-domain:example.com',
};
const WORKFLOW = /Then run the Write daily workflow again\.$/;
const FILE_ONLY = /site\/\.env|npm run audit:demand/;

const thrown = (action) => {
  try {
    action();
  } catch (error) {
    return error;
  }
  return assert.fail('the call did not throw');
};

const secretRefusals = () => ({
  missingKey: thrown(() => credentialsFrom({ ...ENV, GSC_SERVICE_ACCOUNT_JSON: '' }, 'secret')),
  invalidKey: thrown(() =>
    credentialsFrom({ ...ENV, GSC_SERVICE_ACCOUNT_JSON: '{"private_key": "TOPSECRET-MARKER", broken' }, 'secret')
  ),
  shapelessKey: thrown(() =>
    credentialsFrom(
      { ...ENV, GSC_SERVICE_ACCOUNT_JSON: '{"client_email":"a@b.c","private_key":"TOPSECRET-MARKER"}' },
      'secret'
    )
  ),
  missingProperty: thrown(() => credentialsFrom({ ...ENV, GSC_PROPERTY: '' }, 'secret')),
  unsignableKey: thrown(() =>
    signAssertion({ clientEmail: 'a@b.c', privateKey: 'TOPSECRET-MARKER PRIVATE KEY', now: 1, source: 'secret' })
  ),
  tokenRefused: tokenRejection(400, { error: 'invalid_grant', error_description: 'Invalid JWT Signature.' }, 'secret'),
  propertyForbidden: queryRejection(403, { error: { message: 'no permission' } }, 'sc-domain:example.com', 'secret'),
});

test('with the secret source every credential message names the secret and the workflow, never the file', () => {
  for (const [name, error] of Object.entries(secretRefusals())) {
    assert.doesNotMatch(error.message, FILE_ONLY, name);
    assert.match(error.message, WORKFLOW, name);
    assert.match(error.message, /the repository secret GSC_(SERVICE_ACCOUNT_JSON|PROPERTY)/, name);
    assert.doesNotMatch(error.message, /TOPSECRET-MARKER|PRIVATE KEY/, name);
  }
});

test('each secret message names the secret its sentence is about', () => {
  const { missingKey, invalidKey, missingProperty, unsignableKey, tokenRefused, propertyForbidden } = secretRefusals();

  for (const error of [missingKey, invalidKey, unsignableKey, tokenRefused]) {
    assert.match(error.message, /the repository secret GSC_SERVICE_ACCOUNT_JSON/);
  }
  assert.match(missingProperty.message, /in the repository secret GSC_PROPERTY, for example sc-domain:example\.com\./);
  assert.match(propertyForbidden.message, /or correct the repository secret GSC_PROPERTY\./);
  assert.match(propertyForbidden.message, /service account in GSC_SERVICE_ACCOUNT_JSON/);
});

test('the file source stays the default for every message', () => {
  assert.equal(
    thrown(() => credentialsFrom({ ...ENV, GSC_PROPERTY: '' })).message,
    thrown(() => credentialsFrom({ ...ENV, GSC_PROPERTY: '' }, 'file')).message
  );
  assert.equal(tokenRejection(400, {}).message, tokenRejection(400, {}, 'file').message);
  assert.match(tokenRejection(400, {}).message, /Replace that line in site\/\.env with a fresh key/);
  assert.match(queryRejection(403, {}, 'p').message, /correct GSC_PROPERTY in site\/\.env\./);
});

test('errors that mean the credential is unusable carry the credential flag', () => {
  for (const [name, error] of Object.entries(secretRefusals())) assert.equal(error.credential, true, name);
  assert.equal(thrown(() => credentialsFrom({ ...ENV, GSC_SERVICE_ACCOUNT_JSON: '' })).credential, true);
  assert.equal(queryRejection(401, {}, 'p').credential, true);
  assert.equal(CREDENTIAL_EXIT_CODE, 3);
});

test('a server error and a rate limit do not carry the credential flag', () => {
  for (const status of [429, 500, 503]) {
    assert.notEqual(
      queryRejection(status, { error: { message: 'Backend Error' } }, 'p', 'secret').credential,
      true,
      String(status)
    );
  }
});
