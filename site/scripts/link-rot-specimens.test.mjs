import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { linkRotSpecimens } from './link-rot-specimens.mjs';
import { registerProblems } from './link-rot-register.mjs';
import { addUntrackedFile } from './mutation-specimens.mjs';

test('the planted register is one the writer could have written but for a reason changed after it was sealed, and the plant removes itself', async () => {
  const base = mkdtempSync(join(tmpdir(), 'link-rot-specimen-'));
  try {
    const { linksRegisterHandEdited } = linkRotSpecimens({ addUntrackedFile });

    const remove = await linksRegisterHandEdited.plant(join(base, 'site'));

    const planted = JSON.parse(readFileSync(join(base, 'audits', 'link-rot.json'), 'utf8'));
    assert.deepEqual(registerProblems(planted), [
      'the digest does not match its rows: the file was edited by hand, and only the link repair job writes it; restore it from git',
    ]);
    await remove();
    assert.throws(() => readFileSync(join(base, 'audits', 'link-rot.json')), /ENOENT/);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});
