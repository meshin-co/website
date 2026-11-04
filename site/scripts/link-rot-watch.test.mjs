import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAX_GAP_DAYS,
  RUNS_BEFORE_DEAD,
  WATCH_SCHEMA,
  WatchError,
  advanceWatch,
  dropHosts,
  emptyWatch,
  hostnameOf,
  lapseEvidence,
  lapseSummary,
  watchText,
} from './link-rot-watch.mjs';

const HOST = 'lapsed.example';
const day = (number) => `2026-11-${String(number).padStart(2, '0')}`;
const pageOf = (host, index) => `https://${host}/page-${index}`;
const entry = (firstSeen, lastSeen, runs) => ({ firstSeen: day(firstSeen), lastSeen: day(lastSeen), runs });
const stateOf = (hosts) => ({ schema: WATCH_SCHEMA, hosts });
const verdictsOf = (...verdicts) => new Map(verdicts.map((verdict, index) => [pageOf(HOST, index), verdict]));
const hostsOf = (list) => list.map(({ host }) => host);
const WITNESS = pageOf('witness.example', 0);
const advance = ({ verdicts, responders, ...rest }) =>
  responders === undefined
    ? advanceWatch({ ...rest, verdicts: new Map([...verdicts, [WITNESS, 'answered']]), responders: [WITNESS] })
    : advanceWatch({ ...rest, verdicts, responders });

function play(script, start = emptyWatch()) {
  let state = start;
  const trace = [];
  for (const step of script.split(';')) {
    const [today, ...words] = step.trim().split(/\s+/);
    const down = words.includes('down');
    const verdicts = words.filter((word) => word !== 'down').map((word) => (word === 'missing' ? undefined : word));
    const advanced = advance({
      state,
      today: day(Number(today)),
      verdicts: verdictsOf(...verdicts),
      ...(down ? { responders: [] } : {}),
    });
    state = advanced.state;
    trace.push({
      runs: state.hosts[HOST]?.runs ?? 0,
      lapsed: hostsOf(advanced.lapsed),
      watching: hostsOf(advanced.watching),
    });
  }
  return { state, trace };
}

test('three runs on three different days are asked for, and a gap of up to three days is not a break in them', () => {
  assert.equal(RUNS_BEFORE_DEAD, 3);
  assert.equal(MAX_GAP_DAYS, 3);
  assert.equal(WATCH_SCHEMA, 1);
});

const TRANSIENT = [
  [
    'unresolved on three days while no host answered anywhere',
    '1 unresolved down; 2 unresolved down; 3 unresolved down',
    {},
  ],
  [
    'unresolved on three days, but another host answered only on the third',
    '1 unresolved down; 2 unresolved down; 3 unresolved',
    { [HOST]: entry(3, 3, 1) },
  ],
  [
    'two samples, then a day of outage on the day that would have made the third',
    '1 unresolved; 2 unresolved; 3 unresolved down',
    { [HOST]: entry(1, 2, 2) },
  ],
  [
    'a day of outage between two samples neither restarts the count nor adds to it',
    '1 unresolved; 2 unresolved down; 3 unresolved',
    { [HOST]: entry(1, 3, 2) },
  ],
  [
    'outage days leave the last day as it was, so a gap of more than three days after the last sample restarts the count',
    '1 unresolved; 2 unresolved down; 3 unresolved down; 4 unresolved down; 5 unresolved',
    { [HOST]: entry(5, 5, 1) },
  ],
  [
    'an unverified result on a day of outage is no reset, and an answer on a later day is',
    '1 unresolved; 2 unverified down; 3 answered',
    {},
  ],
  ['unresolved, then answered', '1 unresolved; 2 answered', {}],
  ['unresolved, then unverified', '1 unresolved; 2 unverified', {}],
  ['unresolved, then dead by a 404', '1 unresolved; 2 dead', {}],
  ['unresolved, then a verdict that was never recorded', '1 unresolved; 2 missing', {}],
  [
    'two addresses unresolved, then answered, then two unresolved again',
    '1 unresolved unresolved; 2 answered; 3 unresolved unresolved',
    { [HOST]: entry(3, 3, 1) },
  ],
  [
    'unresolved and unverified on alternate days for five days',
    '1 unresolved; 2 unverified; 3 unresolved; 4 unverified; 5 unresolved',
    { [HOST]: entry(5, 5, 1) },
  ],
  ['unresolved twice on the same day', '1 unresolved; 1 unresolved', { [HOST]: entry(1, 1, 1) }],
  [
    'unresolved twice a day on two days',
    '1 unresolved; 1 unresolved; 2 unresolved; 2 unresolved',
    { [HOST]: entry(1, 2, 2) },
  ],
  ['unresolved, then four days of silence', '1 unresolved; 5 unresolved', { [HOST]: entry(5, 5, 1) }],
  [
    'two days in a row, four days of silence, then two more days in a row',
    '1 unresolved; 2 unresolved; 6 unresolved; 7 unresolved',
    { [HOST]: entry(6, 7, 2) },
  ],
  ['one address unresolved and another answered on the same host', '1 unresolved answered', {}],
  [
    'an address that answered, then one unresolved the next day',
    '1 answered; 2 unresolved',
    { [HOST]: entry(2, 2, 1) },
  ],
];

for (const [name, script, hosts] of TRANSIENT) {
  test(`a transient failure never makes a host dead: ${name}`, () => {
    const { state, trace } = play(script);

    assert.deepEqual(state.hosts, hosts);
    assert.deepEqual(
      trace.flatMap(({ lapsed }) => lapsed),
      [],
      JSON.stringify(trace)
    );
  });
}

test('three days in a row make a host dead on the third day and not before, and the runs are counted day by day', () => {
  const { state, trace } = play('1 unresolved; 2 unresolved; 3 unresolved');

  assert.deepEqual(
    trace.map(({ runs, lapsed, watching }) => [runs, lapsed, watching]),
    [
      [1, [], [HOST]],
      [2, [], [HOST]],
      [3, [HOST], []],
    ]
  );
  assert.deepEqual(state.hosts, { [HOST]: entry(1, 3, 3) });
});

test('a lapsed host names every address the run checked on it, once, in the order they were given', () => {
  const verdicts = new Map([
    [pageOf(HOST, 2), 'unresolved'],
    [pageOf(HOST, 1), 'unresolved'],
    [pageOf('alive.example', 1), 'answered'],
  ]);
  const start = stateOf({ [HOST]: entry(1, 2, 2) });

  const { lapsed, watching, state } = advance({ state: start, today: day(3), verdicts });

  assert.deepEqual(lapsed, [
    { host: HOST, runs: 3, firstSeen: day(1), lastSeen: day(3), addresses: [pageOf(HOST, 2), pageOf(HOST, 1)] },
  ]);
  assert.deepEqual(watching, []);
  assert.deepEqual(Object.keys(state.hosts), [HOST]);
});

test('a gap of exactly the longest gap continues the count, and one day more starts it again', () => {
  const gap = MAX_GAP_DAYS;
  const continued = play(`1 unresolved; ${1 + gap} unresolved; ${1 + 2 * gap} unresolved`);
  const restarted = play(`1 unresolved; ${2 + gap} unresolved; ${3 + 2 * gap} unresolved`);

  assert.deepEqual(
    continued.trace.map(({ runs, lapsed }) => [runs, lapsed.length]),
    [
      [1, 0],
      [2, 0],
      [3, 1],
    ]
  );
  assert.deepEqual(
    restarted.trace.map(({ runs, lapsed }) => [runs, lapsed.length]),
    [
      [1, 0],
      [1, 0],
      [1, 0],
    ]
  );
});

test('a host keeps its streak across a skipped day or two, and keeps the day the streak began', () => {
  const { state } = play('1 unresolved; 3 unresolved; 4 unresolved');

  assert.deepEqual(state.hosts, { [HOST]: entry(1, 4, 3) });
});

test('a second run on the same day counts nothing: the entry is exactly what it was, and a manual dispatch is no extra run', () => {
  const start = stateOf({ [HOST]: entry(1, 2, 2) });

  const sameDay = advance({ state: start, today: day(2), verdicts: verdictsOf('unresolved') });

  assert.deepEqual(sameDay.state.hosts, { [HOST]: entry(1, 2, 2) });
  assert.deepEqual(sameDay.lapsed, []);
  assert.deepEqual(
    sameDay.watching.map(({ runs }) => runs),
    [2]
  );
});

test('a run on a day before the last one cannot be ordered with it, so the streak starts again at one on that day', () => {
  const start = stateOf({ [HOST]: entry(1, 5, 3) });

  const earlier = advance({ state: start, today: day(4), verdicts: verdictsOf('unresolved') });

  assert.deepEqual(earlier.state.hosts, { [HOST]: entry(4, 4, 1) });
  assert.deepEqual(earlier.lapsed, []);
});

test('a host that is already dead stays dead on a second run the same day and on every later day while it does not resolve', () => {
  const start = stateOf({ [HOST]: entry(1, 3, 3) });

  const sameDay = advance({ state: start, today: day(3), verdicts: verdictsOf('unresolved') });
  const nextDay = advance({ state: start, today: day(4), verdicts: verdictsOf('unresolved') });

  assert.deepEqual(
    sameDay.lapsed.map(({ runs }) => runs),
    [3]
  );
  assert.deepEqual(
    nextDay.lapsed.map(({ runs }) => runs),
    [4]
  );
});

test('every verdict but unresolved forgets the host: answered, dead, unverified and an unrecorded verdict each delete its entry', () => {
  for (const verdict of ['answered', 'dead', 'unverified', undefined]) {
    const start = stateOf({ [HOST]: entry(1, 2, 2) });

    const { state, lapsed, watching } = advance({ state: start, today: day(3), verdicts: verdictsOf(verdict) });

    assert.deepEqual([state.hosts, lapsed, watching], [{}, [], []], String(verdict));
  }
});

test('a host that no address in the build points to any more is pruned, and one that is still linked is kept', () => {
  const start = stateOf({ 'gone.example': entry(1, 2, 2), [HOST]: entry(1, 2, 2) });

  const { state } = advance({ state: start, today: day(3), verdicts: verdictsOf('unresolved') });

  assert.deepEqual(state.hosts, { [HOST]: entry(1, 3, 3) });
});

test('a run that checked nothing prunes everything, because nothing in the build is linked', () => {
  const start = stateOf({ [HOST]: entry(1, 2, 2) });

  const { state, lapsed, watching } = advance({ state: start, today: day(3), verdicts: new Map() });

  assert.deepEqual([state.hosts, lapsed, watching], [{}, [], []]);
});

test('hosts are judged one by one: another host that answers does not reset this one, and this one does not carry the other', () => {
  const verdicts = new Map([
    [pageOf(HOST, 1), 'unresolved'],
    [pageOf('alive.example', 1), 'answered'],
    [pageOf('flaky.example', 1), 'unverified'],
    [pageOf('other.example', 1), 'unresolved'],
  ]);
  const start = stateOf({ [HOST]: entry(1, 2, 2), 'alive.example': entry(1, 2, 2) });

  const { state, lapsed, watching } = advance({ state: start, today: day(3), verdicts });

  assert.deepEqual(state.hosts, { [HOST]: entry(1, 3, 3), 'other.example': entry(3, 3, 1) });
  assert.deepEqual(hostsOf(lapsed), [HOST]);
  assert.deepEqual(hostsOf(watching), ['other.example']);
});

test('a host is its name without the port, in lower case, so two ports of one name are one host and a bad address is none', () => {
  const verdicts = new Map([
    ['https://Lapsed.Example:8443/a', 'unresolved'],
    ['https://lapsed.example/b', 'unresolved'],
    ['not an address', 'unresolved'],
  ]);

  const { state, watching } = advance({ state: emptyWatch(), today: day(1), verdicts });

  assert.deepEqual(state.hosts, { [HOST]: entry(1, 1, 1) });
  assert.deepEqual(watching[0].addresses, ['https://Lapsed.Example:8443/a', 'https://lapsed.example/b']);
  assert.equal(hostnameOf('https://Lapsed.Example:8443/a'), HOST);
  assert.equal(hostnameOf('not an address'), '');
});

test('a host named like an object property is an ordinary host', () => {
  const verdicts = new Map([
    ['https://constructor/a', 'unresolved'],
    ['https://__proto__/b', 'unresolved'],
  ]);

  const { state } = advance({ state: emptyWatch(), today: day(1), verdicts });

  assert.deepEqual(Object.keys(state.hosts).sort(), ['__proto__', 'constructor']);
  assert.equal(JSON.parse(watchText(state)).hosts.constructor.runs, 1);
});

test('the day a run is on must be a calendar day', () => {
  for (const today of ['soon', '2026-02-30', '2026-11-1', undefined]) {
    assert.throws(
      () => advance({ state: emptyWatch(), today, verdicts: new Map() }),
      (error) => error instanceof WatchError && /today must be a calendar day/.test(error.message),
      String(today)
    );
  }
});

test('advancing a state never changes the state it was given', () => {
  const start = stateOf({ [HOST]: entry(1, 2, 2) });
  const before = structuredClone(start);

  advance({ state: start, today: day(3), verdicts: verdictsOf('unresolved') });

  assert.deepEqual(start, before);
});

test('a host that was repaired is dropped from the state, and the others stay', () => {
  const start = stateOf({ [HOST]: entry(1, 3, 3), 'other.example': entry(2, 3, 2) });

  assert.deepEqual(dropHosts(start, [HOST]).hosts, { 'other.example': entry(2, 3, 2) });
  assert.deepEqual(dropHosts(start, []).hosts, start.hosts);
  assert.deepEqual(start.hosts[HOST], entry(1, 3, 3));
});

test('the evidence names the host, the runs and the first and last day; the brief form has no day that changes from run to run', () => {
  const lapse = { host: HOST, runs: 4, firstSeen: '2026-11-01', lastSeen: '2026-11-04' };

  assert.equal(
    lapseEvidence(lapse),
    'the host name lapsed.example did not resolve on 4 consecutive scheduled runs, from 2026-11-01 to 2026-11-04'
  );
  assert.equal(
    lapseSummary(lapse),
    'the host name lapsed.example did not resolve on at least 3 consecutive scheduled runs'
  );
  assert.equal(lapseSummary({ ...lapse, runs: 3, lastSeen: '2026-11-03' }), lapseSummary(lapse));
});

test('a run in which no host answered anywhere moves no count and resets none: every entry stays byte for byte as it was, and the run says it had no witness', () => {
  const start = stateOf({ [HOST]: entry(1, 2, 2), 'gone.example': entry(1, 2, 2), 'flaky.example': entry(2, 2, 1) });
  const verdicts = new Map([
    [pageOf(HOST, 1), 'unresolved'],
    [pageOf('flaky.example', 1), 'unverified'],
    [pageOf('other.example', 1), 'unresolved'],
  ]);

  const result = advance({ state: start, today: day(3), verdicts, responders: [] });

  assert.equal(watchText(result.state), watchText(start));
  assert.deepEqual([result.witnessed, result.lapsed, result.watching], [false, [], []]);
});

test('the same run with one other host answering 404 moves the streaks: that answer is the witness that the network worked', () => {
  const start = stateOf({ [HOST]: entry(1, 2, 2) });
  const verdicts = new Map([
    [pageOf(HOST, 1), 'unresolved'],
    [pageOf('other.example', 1), 'dead'],
    [pageOf('new.example', 1), 'unresolved'],
  ]);

  const result = advance({ state: start, today: day(3), verdicts, responders: [pageOf('other.example', 1)] });

  assert.equal(result.witnessed, true);
  assert.deepEqual(hostsOf(result.lapsed), [HOST]);
  assert.deepEqual(hostsOf(result.watching), ['new.example']);
  assert.deepEqual(result.state.hosts, { [HOST]: entry(1, 3, 3), 'new.example': entry(3, 3, 1) });
});

test('a host that is the only unresolved one and the only host in the build has no witness, so nothing moves (single-host world)', () => {
  const start = stateOf({ [HOST]: entry(1, 2, 2) });

  const result = advance({
    state: start,
    today: day(3),
    verdicts: verdictsOf('unresolved', 'unresolved'),
    responders: [],
  });

  assert.deepEqual(result.state, start);
  assert.deepEqual([result.witnessed, result.lapsed, result.watching], [false, [], []]);
});

test('a host cannot witness for itself: an address of the same host that is said to have answered neither moves its streak nor resets it', () => {
  const start = stateOf({ [HOST]: entry(1, 2, 2) });

  const result = advance({
    state: start,
    today: day(3),
    verdicts: verdictsOf('unresolved'),
    responders: [pageOf(HOST, 9)],
  });

  assert.deepEqual(result.state, start);
  assert.deepEqual([result.lapsed, result.watching], [[], []]);
});

test('a run with no witness hands back a copy of the state, so changing the copy never changes the state that was given', () => {
  const start = stateOf({ [HOST]: entry(1, 2, 2) });

  const { state } = advance({ state: start, today: day(3), verdicts: verdictsOf('unresolved'), responders: [] });
  state.hosts[HOST].runs = 99;

  assert.equal(start.hosts[HOST].runs, 2);
});
