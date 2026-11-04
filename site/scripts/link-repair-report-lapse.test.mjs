import assert from 'node:assert/strict';
import test from 'node:test';

import { LAPSED_HOSTS_LISTED, MAX_BODY_LENGTH, pullRequestBody } from './link-repair-report.mjs';
import { lapseEvidence } from './link-rot-watch.mjs';

const SNAPSHOT = 'https://web.archive.org/web/20230302214609/https://lapsed.example/a';

const lapse = (changes = {}) => ({
  host: 'lapsed.example',
  runs: 3,
  firstSeen: '2026-11-01',
  lastSeen: '2026-11-03',
  addresses: ['https://lapsed.example/a', 'https://lapsed.example/b'],
  ...changes,
});

const repaired = (original) => ({
  original,
  entry: 'site/src/data/glossary/ai-rmf.md',
  outcome: 'archive',
  replacement: SNAPSHOT,
  citedOn: '2023-03-01',
  firstSeenDead: '2026-11-01',
  why: 'the capture carries the title',
});

const resultOf = ({ lapsed = [lapse()], gone = 1, rows = [repaired('https://lapsed.example/a')] } = {}) => {
  const onLapsedHosts = lapsed.flatMap(({ addresses }) => addresses).length;
  return {
    checked: 120,
    dead: [],
    rows,
    waitingForCap: [],
    waitingForArchive: [],
    lapsed,
    counts: { dead: gone + onLapsedHosts, archive: rows.length, search: 0, unplaced: 0, waiting: 0, watching: 0 },
  };
};

const bodyOf = (result) => pullRequestBody({ today: '2026-11-03', result });

test('a host that did not resolve is named with its runs and its first and last day, and the count of addresses on it that went through the repair', () => {
  const body = bodyOf(resultOf());

  assert.match(body, /## Hosts that no longer resolve/);
  assert.ok(body.includes('- ' + lapseEvidence(lapse()) + ', so 2 addresses on it counted as dead.'), body);
});

test('the section says why a name that did not resolve counts as dead, and that any other answer starts the count again', () => {
  const body = bodyOf(resultOf());

  assert.match(body, /on 3 different days/);
  assert.match(body, /lapsed or withdrawn domain and not a resolver having a bad moment/);
  assert.match(body, /Any other answer for the host starts the count again/);
  assert.match(body, /only counts on a run in which at least one other host answered/);
});

test('the dead addresses are counted by how they were found: the 404s are not credited with the names that did not resolve', () => {
  const body = bodyOf(resultOf({ gone: 1 }));

  assert.match(
    body,
    /The probe asked 120 outbound addresses in the build\. 1 answered "gone" \(404 or 410\) twice and never answered successfully\./
  );
  assert.match(body, /2 more are on a host whose name did not resolve on 3 consecutive scheduled runs\./);
});

test('the sentence about the addresses on a host that did not resolve agrees with how many addresses and how many hosts there are', () => {
  const one = bodyOf(resultOf({ lapsed: [lapse({ addresses: ['https://lapsed.example/a'] })] }));
  const two = bodyOf(
    resultOf({
      lapsed: [
        lapse({ addresses: ['https://lapsed.example/a', 'https://lapsed.example/b'] }),
        lapse({ host: 'other.example', addresses: ['https://other.example/a'] }),
      ],
    })
  );

  assert.match(one, / 1 more is on a host whose name did not resolve on 3 consecutive scheduled runs\./);
  assert.match(two, / 3 more are on 2 hosts whose names did not resolve on 3 consecutive scheduled runs\./);
});

test('a run with no host that did not resolve prints no section and the sentence it always did', () => {
  const body = bodyOf(resultOf({ lapsed: [], gone: 1 }));

  assert.ok(!body.includes('Hosts that no longer resolve'));
  assert.ok(!body.includes('did not resolve'));
  assert.match(body, /1 answered "gone" \(404 or 410\) twice and never answered successfully\.\n/);
});

test('one address on a host is one address, and one host is one line', () => {
  const body = bodyOf(resultOf({ lapsed: [lapse({ addresses: ['https://lapsed.example/a'] })] }));

  assert.ok(body.includes(', so 1 address on it counted as dead.'), body);
  assert.ok(!body.includes('1 addresses'));
});

test('hosts beyond the cap are counted and not listed, so a thousand hosts cannot push the body past what GitHub accepts', () => {
  const lapsed = Array.from({ length: 1000 }, (_, index) =>
    lapse({ host: 'host-' + String(index).padStart(4, '0') + '.example', addresses: ['https://x.example/' + index] })
  );

  const body = bodyOf(resultOf({ lapsed }));

  assert.equal(LAPSED_HOSTS_LISTED, 20);
  assert.ok(body.includes('host-0019.example'));
  assert.ok(!body.includes('host-0020.example'));
  assert.match(body, /- and 980 more hosts did not resolve either\./);
  assert.ok(body.length <= MAX_BODY_LENGTH, String(body.length));
});
