import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { mainWriteFindings } from './main-write-scan.mjs';

const scan = (text) => mainWriteFindings([{ path: 'x.yml', text }]);

const FLAGGED = {
  'a push of HEAD': 'git push origin HEAD',
  'a push of @': 'git push origin @',
  'a forced push of HEAD': 'git push --force origin HEAD',
  'a push of HEAD with the upstream flag': 'git push -u origin HEAD',
  'a push of a quoted HEAD': 'git push origin "HEAD"',
  'a push of HEAD in a script array': "spawn('git', ['push', 'origin', 'HEAD'])",
  'a push of @ in a script array': "run(['git', 'push', 'origin', '@'])",
};

for (const [name, text] of Object.entries(FLAGGED)) {
  test(`${name} names no branch, so it is flagged: the branch is whatever is checked out`, () => {
    const found = scan(text);

    assert.equal(found.length, 1);
    assert.equal(found[0].rule, 'push-source-without-destination');
  });
}

for (const text of [
  'git push origin HEAD:refs/heads/autowriter-state',
  'git push origin HEAD:autowriter/x',
  "spawn('git', ['push', 'origin', 'HEAD:refs/heads/autowriter-state'])",
  'git push origin autowriter/x',
  'echo the HEAD commit',
  'git log HEAD',
]) {
  test(`${text} is not flagged`, () => {
    assert.deepEqual(scan(text), []);
  });
}
