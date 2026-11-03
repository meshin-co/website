import assert from 'node:assert/strict';
import test from 'node:test';

import { archiveSnapshot, archiveUrlFor, capturedOn, isSnapshotOf } from './archive-url.mjs';

const DOI = 'https://doi.org/10.6028/NIST.AI.100-1';
const SNAPSHOT = `https://web.archive.org/web/20251025031200/${DOI}`;
const MEDIA = 'https://media.defense.gov/2026/Jun/02/2003943289/-1/-1/0/CSI_MCP_SECURITY.PDF';
const RAW_SNAPSHOT = `https://web.archive.org/web/20260612015047id_/${MEDIA}`;

test('a snapshot address names the capture instant and the address that was captured', () => {
  assert.deepEqual(archiveSnapshot(SNAPSHOT), { timestamp: '20251025031200', original: DOI });
});

test('the raw form with an id_ flag, which one entry already cites, is a snapshot of the same address', () => {
  assert.deepEqual(archiveSnapshot(RAW_SNAPSHOT), { timestamp: '20260612015047', original: MEDIA });
});

test('an address that is not a full Wayback snapshot is not one', () => {
  const refused = [
    DOI,
    `http://web.archive.org/web/20251025031200/${DOI}`,
    `https://web.archive.org/web/2025102503/${DOI}`,
    'https://web.archive.org/web/20251025031200/',
    'https://web.archive.org/web/20251025031200',
    `https://example.com/web/20251025031200/${DOI}`,
    `https://web.archive.org/save/${DOI}`,
    'not a url',
    undefined,
  ];
  for (const address of refused) assert.equal(archiveSnapshot(address), null, String(address));
});

test('a snapshot is of an address when the address it captured is the same one', () => {
  assert.equal(isSnapshotOf(SNAPSHOT, DOI), true);
  assert.equal(isSnapshotOf(RAW_SNAPSHOT, MEDIA), true);
  assert.equal(
    isSnapshotOf('https://web.archive.org/web/20251025031200/https://example.com', 'https://example.com/'),
    true
  );
});

test('a snapshot of another address, or an address that is no snapshot, is not of the original', () => {
  assert.equal(isSnapshotOf(SNAPSHOT, 'https://doi.org/10.6028/NIST.AI.100-2'), false);
  assert.equal(isSnapshotOf(SNAPSHOT, 'https://doi.org/10.6028/nist.ai.100-1'), false);
  assert.equal(isSnapshotOf(DOI, DOI), false);
  assert.equal(isSnapshotOf(SNAPSHOT, 'not a url'), false);
});

test('the capture date is read from the timestamp, and an impossible date reads as nothing', () => {
  assert.equal(capturedOn(SNAPSHOT), '2025-10-25');
  assert.equal(capturedOn(RAW_SNAPSHOT), '2026-06-12');
  assert.equal(capturedOn(`https://web.archive.org/web/20251345000000/${DOI}`), null);
  assert.equal(capturedOn(DOI), null);
});

test('the address of a capture is built from the instant and the original, and reads back the same', () => {
  const built = archiveUrlFor({ timestamp: '20251025031200', original: DOI });

  assert.equal(built, SNAPSHOT);
  assert.deepEqual(archiveSnapshot(built), { timestamp: '20251025031200', original: DOI });
});

test('an address is never built from a timestamp that is not fourteen digits', () => {
  assert.throws(() => archiveUrlFor({ timestamp: '20251025', original: DOI }), /fourteen digits/);
});
