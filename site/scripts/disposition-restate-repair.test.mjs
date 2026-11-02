import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ATTEMPT_CAP } from './autowriter-ledger.mjs';
import { DISPOSITION_DIRECTORY, refusalOf } from './autowriter-refusals.mjs';
import { repairedReason, restateFile, restatedReason } from './disposition-restate.mjs';
import { WriterError } from './writer-error.mjs';

const SLUG = 'how-to-write-an-ai-incident-runbook';
const ROUTE = `/blog/${SLUG}`;
const PATH = `${DISPOSITION_DIRECTORY}/routes.json`;
const HUMAN = 'The page was re-read by the owner.';
const MOVED = { digest: 'bbbbbbbbbbbb' };

const reasonOf = (number = 1, of = ATTEMPT_CAP) =>
  repairedReason({ route: ROUTE, slug: SLUG, attempt: { number, of } });
const entry = (extra = {}) => ({ target: ROUTE, status: 'verified', reason: HUMAN, digest: 'aaaaaaaaaaaa', ...extra });
const layout = (entries) => `${JSON.stringify(entries, null, 2)}\n`;
const digestMoved = (reason) =>
  refusalOf({
    path: PATH,
    before: layout([entry({ reason })]),
    after: layout([entry({ reason, ...MOVED })]),
  });

test('the repair reason opens exactly as the restate reason does, up to the first route it names', () => {
  const restated = restatedReason({ routes: [ROUTE], slugs: [SLUG] });
  const opening = restated.slice(0, restated.indexOf(ROUTE));

  assert.match(opening, /^The text of this target changed in the run in which the unattended writer added $/);
  assert.ok(reasonOf().startsWith(opening));
});

test('a digest that moves under the repair reason is not a seal, and under a hand-written reason the same change is', () => {
  assert.equal(digestMoved(reasonOf()), null);
  assert.equal(digestMoved(HUMAN)?.id, 'disposition-seal');
  assert.equal(digestMoved(`Note: ${reasonOf()}`)?.id, 'disposition-seal');
});

test('restating under the repair reason is never read as a seal, attempt after attempt and the same attempt twice', () => {
  let text = layout([entry()]);
  for (const [number, digest] of [
    [1, 'bbbbbbbbbbbb'],
    [2, 'cccccccccccc'],
    [2, 'dddddddddddd'],
    [3, 'eeeeeeeeeeee'],
  ]) {
    const stale = [{ index: 0, target: ROUTE, digest }];
    const next = restateFile({ file: 'routes.json', text, stale, reason: reasonOf(number) });

    assert.equal(refusalOf({ path: PATH, before: text, after: next }), null, `attempt ${number}, digest ${digest}`);
    assert.equal(JSON.parse(next)[0].digest, digest);
    text = next;
  }
});

test('the same restate under a hand-written reason is a seal, so the check above can fail', () => {
  const once = restateFile({
    file: 'routes.json',
    text: layout([entry()]),
    stale: [{ index: 0, target: ROUTE, digest: 'bbbbbbbbbbbb' }],
    reason: HUMAN,
  });
  const twice = restateFile({
    file: 'routes.json',
    text: once,
    stale: [{ index: 0, target: ROUTE, digest: 'cccccccccccc' }],
    reason: HUMAN,
  });

  assert.equal(refusalOf({ path: PATH, before: once, after: twice })?.id, 'disposition-seal');
});

test('the reason names the route, the generation record and the attempt, and says a model wrote the text and no human read it', () => {
  const reason = reasonOf(2);

  assert.ok(reason.includes(`a repair of ${ROUTE} (generation record audits/autowriter/generations/${SLUG}.json)`));
  assert.ok(reason.includes(`attempt 2 of ${ATTEMPT_CAP}.`));
  assert.match(reason, /written by a model, and no human has read it/);
  assert.match(reason, /previous reason of this entry.*git history of this file\.$/);
  assert.doesNotMatch(reason, /seal|\n/i);
});

test('every attempt writes its own reason, so a restate in one attempt differs from the one before', () => {
  const reasons = Array.from({ length: ATTEMPT_CAP }, (_, at) => reasonOf(at + 1));

  assert.equal(new Set(reasons).size, ATTEMPT_CAP);
});

const MALFORMED = {
  'no attempt': undefined,
  'a null attempt': null,
  'an attempt without numbers': {},
  'an attempt without its cap': { number: 1 },
  'an attempt without its number': { of: ATTEMPT_CAP },
  'attempt zero': { number: 0, of: ATTEMPT_CAP },
  'an attempt past the cap': { number: ATTEMPT_CAP + 1, of: ATTEMPT_CAP },
  'a fractional attempt': { number: 1.5, of: ATTEMPT_CAP },
  'an attempt written as text': { number: '1', of: ATTEMPT_CAP },
};

for (const [name, attempt] of Object.entries(MALFORMED))
  test(`${name} is refused before a reason is written`, () => {
    assert.throws(
      () => repairedReason({ route: ROUTE, slug: SLUG, attempt }),
      (error) => error instanceof WriterError && error.kind === 'build' && /attempt/.test(error.message)
    );
  });
