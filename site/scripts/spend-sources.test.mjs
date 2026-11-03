import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

import { PLACES } from './fixtures/record-depths.mjs';
import { FILED_AT, createScene, ledgerOf, recordOf } from './fixtures/spend-scene.mjs';
import { runGit } from './commit-to-main.mjs';
import { recordPath } from './record-layout.mjs';
import { SpendDataError, readLedgers } from './spend-sources.mjs';
import { microOf, monthlySpend, spendWarnings } from './spend-sum.mjs';

const AT = '2026-11-02T08:00:00Z';
const withScene = (body) => async () => {
  const scene = createScene();
  try {
    await body(scene);
  } finally {
    scene.cleanup();
  }
};
const summary = (items) => items.map(({ source, ledger }) => [source, ledger.slug, ledger.spend.costUsd]);
const read = (scene, run = runGit) => readLedgers({ repoRoot: scene.root, run });
const ledger = (slug, usd) => ledgerOf({ slug, attempts: [{ at: AT, usd }] });

test(
  'the working tree of the checkout is a source, with the generation record of the same slug',
  withScene((scene) => {
    scene.putLedger(ledgerOf({ slug: 'main-post', generationUsd: 1 }));
    scene.putRecord(recordOf({ slug: 'main-post', generatedAt: AT, usd: 1 }));
    scene.commit();
    const [only, ...rest] = read(scene);
    assert.deepEqual(rest, []);
    assert.equal(only.source, 'working tree');
    assert.equal(only.ledger.slug, 'main-post');
    assert.equal(only.record.generatedAt, AT);
  })
);

test(
  'a ledger that was never committed still counts, because the working tree is read as it is',
  withScene((scene) => {
    scene.putLedger(ledger('loose-post', 2));
    assert.deepEqual(summary(read(scene)), [['working tree', 'loose-post', 2]]);
  })
);

test(
  'a ledger that exists only on a local autowriter branch counts, with the record of that branch',
  withScene((scene) => {
    scene.onBranch('autowriter/branch-post', () => {
      scene.putLedger(ledgerOf({ slug: 'branch-post', generationUsd: 1.5 }));
      scene.putRecord(recordOf({ slug: 'branch-post', generatedAt: AT, usd: 1.5 }));
    });
    const [only, ...rest] = read(scene);
    assert.deepEqual(rest, []);
    assert.equal(only.source, 'refs/heads/autowriter/branch-post');
    assert.equal(only.ledger.spend.costUsd, 1.5);
    assert.equal(only.record.slug, 'branch-post');
  })
);

test(
  'a ledger that exists only on a remote-tracking autowriter branch counts',
  withScene((scene) => {
    scene.asRemote('autowriter/remote-post', () => scene.putLedger(ledger('remote-post', 2)));
    assert.deepEqual(summary(read(scene)), [['refs/remotes/origin/autowriter/remote-post', 'remote-post', 2]]);
  })
);

test(
  'a branch that is not an autowriter branch is not a source',
  withScene((scene) => {
    scene.onBranch('feature/other', () => scene.putLedger(ledger('other-post', 9)));
    scene.asRemote('feature/other', () => scene.putLedger(ledger('other-post', 9)));
    assert.deepEqual(read(scene), []);
  })
);

test(
  'one slug on main and on a branch comes back once, as the version with the larger spend',
  withScene((scene) => {
    scene.putLedger(ledger('shared-post', 1));
    scene.commit();
    scene.onBranch('autowriter/shared-post', () => scene.putLedger(ledger('shared-post', 3)));
    assert.deepEqual(summary(read(scene)), [['refs/heads/autowriter/shared-post', 'shared-post', 3]]);
  })
);

test(
  'a merged slug whose main version is the larger one keeps the main version, not the older branch tip',
  withScene((scene) => {
    scene.onBranch('autowriter/merged-post', () => scene.putLedger(ledger('merged-post', 1)));
    scene.putLedger(ledger('merged-post', 3));
    scene.commit();
    assert.deepEqual(summary(read(scene)), [['working tree', 'merged-post', 3]]);
  })
);

test(
  'a branch tip carries every ledger of main as it was, and those older copies never add to the spend',
  withScene((scene) => {
    scene.putLedger(ledger('old-post', 1));
    scene.commit();
    scene.onBranch('autowriter/new-post', () => scene.putLedger(ledger('new-post', 2)));
    scene.putLedger(ledger('old-post', 4));
    scene.commit();
    assert.deepEqual(summary(read(scene)), [
      ['refs/heads/autowriter/new-post', 'new-post', 2],
      ['working tree', 'old-post', 4],
    ]);
  })
);

test(
  'a generation record whose ledger exists in no source comes back with no ledger, so its cost is still counted',
  withScene((scene) => {
    scene.putRecord(recordOf({ slug: 'record-only', generatedAt: AT, usd: 1 }));
    scene.commit();
    const [only, ...rest] = read(scene);
    assert.deepEqual(rest, []);
    assert.equal(only.ledger, null);
    assert.equal(only.source, 'working tree');
    assert.equal(only.record.slug, 'record-only');
    assert.equal(monthlySpend({ ledgers: [only], month: MONTH }), microOf(1));
    assert.match(spendWarnings({ ledgers: [only] })[0], /record-only: .* which does not exist/);
  })
);

test(
  'a malformed ledger in the working tree is an error that names the file',
  withScene((scene) => {
    scene.put(recordPath('ledger', 'bad-post', AT), '{ not json');
    assert.throws(
      () => read(scene),
      (error) => error instanceof SpendDataError && /audits\/autowriter\/2026\/11\/bad-post\.json/.test(error.message)
    );
  })
);

test(
  'a ledger that breaks the ledger schema is an error that names the file',
  withScene((scene) => {
    const broken = ledger('broken-post', 1);
    broken.spend.costUsd = 5;
    scene.putLedger(broken);
    assert.throws(
      () => read(scene),
      (error) => error instanceof SpendDataError && /broken-post\.json/.test(error.message)
    );
  })
);

test(
  'a ledger whose slug differs from its file name is an error',
  withScene((scene) => {
    scene.put(recordPath('ledger', 'other-name', AT), ledger('real-name', 1));
    assert.throws(
      () => read(scene),
      (error) => error instanceof SpendDataError && /other-name\.json/.test(error.message)
    );
  })
);

test(
  'a malformed ledger on a branch tip is an error that names the ref and the file',
  withScene((scene) => {
    scene.onBranch('autowriter/bad-branch', () => scene.put(recordPath('ledger', 'bad-branch', AT), '[]'));
    assert.throws(
      () => read(scene),
      (error) =>
        error instanceof SpendDataError &&
        /refs\/heads\/autowriter\/bad-branch/.test(error.message) &&
        /bad-branch\.json/.test(error.message)
    );
  })
);

test(
  'a malformed generation record is an error that names the file',
  withScene((scene) => {
    scene.putLedger(ledger('rec-post', 1));
    scene.put(recordPath('generation', 'rec-post', AT), '{"schema":1}');
    assert.throws(
      () => read(scene),
      (error) => error instanceof SpendDataError && /generations\/2026\/11\/rec-post\.json/.test(error.message)
    );
  })
);

test(
  'a folder that is not a git checkout is an error, never an empty list that reads as no spend',
  withScene((scene) => {
    rmSync(join(scene.root, '.git'), { recursive: true, force: true });
    assert.throws(
      () => read(scene),
      (error) => error instanceof SpendDataError && /git/.test(error.message)
    );
  })
);

test(
  'a ledger blob shared by several branch tips is read once, not once per branch',
  withScene((scene) => {
    scene.putLedger(ledger('base-post', 1));
    scene.commit();
    scene.onBranch('autowriter/first', () => scene.putLedger(ledger('first', 2)));
    scene.onBranch('autowriter/second', () => scene.putLedger(ledger('second', 3)));
    const calls = [];
    const run = (args, options) => {
      calls.push(args);
      return runGit(args, options);
    };
    assert.equal(read(scene, run).length, 3);
    assert.equal(calls.filter((args) => args[0] === 'cat-file').length, 3);
  })
);

test('reading never writes to the repository or touches the network', () => {
  const scene = createScene();
  try {
    scene.putLedger(ledger('quiet-post', 1));
    scene.commit();
    const before = scene.git('status', '--porcelain');
    const verbs = new Set();
    read(scene, (args, options) => {
      verbs.add(args[0]);
      return runGit(args, options);
    });
    assert.equal(scene.git('status', '--porcelain'), before);
    assert.deepEqual(
      [...verbs].sort(),
      ['cat-file', 'for-each-ref', 'ls-tree'].filter((verb) => verbs.has(verb))
    );
    assert.ok(!verbs.has('fetch') && !verbs.has('pull') && !verbs.has('push'));
  } finally {
    scene.cleanup();
  }
});

const detachedBeforeLedger = (scene, slug, usd, { remote }) => {
  scene.putLedger(ledger(slug, usd));
  const tip = scene.commit();
  if (remote) scene.git('update-ref', 'refs/remotes/origin/main', tip);
  scene.git('checkout', '-q', '--detach', 'HEAD~1');
  if (remote) scene.git('branch', '-q', '-D', 'main');
};

test(
  'a ledger only on origin/main counts when the working tree is a detached, older commit',
  withScene((scene) => {
    detachedBeforeLedger(scene, 'merged-post', 4, { remote: true });
    assert.deepEqual(summary(read(scene)), [['refs/remotes/origin/main', 'merged-post', 4]]);
  })
);

test(
  'a ledger only on the local main branch counts when the working tree is a detached, older commit',
  withScene((scene) => {
    detachedBeforeLedger(scene, 'local-main-post', 5, { remote: false });
    assert.deepEqual(summary(read(scene)), [['refs/heads/main', 'local-main-post', 5]]);
  })
);

test(
  'main and a branch that carry one slug are one ledger, the larger version, with main as a source',
  withScene((scene) => {
    scene.putLedger(ledger('both-post', 2));
    const tip = scene.commit();
    scene.git('update-ref', 'refs/remotes/origin/main', tip);
    scene.onBranch('autowriter/both-post', () => scene.putLedger(ledger('both-post', 1)));
    scene.git('checkout', '-q', '--detach', 'HEAD~1');
    assert.deepEqual(summary(read(scene)), [['refs/heads/main', 'both-post', 2]]);
  })
);

const MONTH = '2026-11';
const DEPTHS = [FILED_AT.flat, FILED_AT.month, FILED_AT.deeper];
const ENTRIES = [
  ['alpha-post', 1],
  ['beta-post', 2],
  ['gamma-post', 4],
];
const ALL_FOUND = ENTRIES.map(([slug]) => [slug, slug]);
const PAIRINGS = {
  'a ledger and its record at the same depth': (index) => [DEPTHS[index], DEPTHS[index]],
  'a ledger and its record at different depths': (index) => [DEPTHS[index], DEPTHS[(index + 1) % DEPTHS.length]],
};
const REFS = {
  'a local autowriter branch': {
    source: 'refs/heads/autowriter/depth-post',
    put: (scene, work) => scene.onBranch('autowriter/depth-post', work),
  },
  'a remote-tracking autowriter branch': {
    source: 'refs/remotes/origin/autowriter/depth-post',
    put: (scene, work) => scene.asRemote('autowriter/depth-post', work),
  },
};

const putEntries = (scene, depthOf) =>
  ENTRIES.forEach(([slug, usd], index) => {
    const [ledgerAt, recordAt] = depthOf(index);
    scene.put(ledgerAt('ledger', slug), ledgerOf({ slug, generationUsd: usd }));
    scene.put(recordAt('generation', slug), recordOf({ slug, generatedAt: AT, usd }));
  });
const pairs = (items) => items.map(({ ledger: found, record }) => [found.slug, record === null ? null : record.slug]);
const recordsIn = (items) => items.filter(({ record }) => record !== null).length;

for (const [pairing, depthOf] of Object.entries(PAIRINGS)) {
  test(
    `the working tree is read at any depth: ${pairing}, filed flat, in the month and below it, are all found, three of each`,
    withScene((scene) => {
      putEntries(scene, depthOf);
      const items = read(scene);
      assert.equal(items.length, 3);
      assert.equal(recordsIn(items), 3);
      assert.deepEqual(pairs(items), ALL_FOUND);
      assert.ok(items.every(({ source }) => source === 'working tree'));
      assert.equal(monthlySpend({ ledgers: items, month: MONTH }), microOf(7));
    })
  );

  for (const [kind, { source, put }] of Object.entries(REFS)) {
    test(
      `a ref is read at any depth: ${pairing}, filed flat, in the month and below it on ${kind}, are all found, three of each`,
      withScene((scene) => {
        put(scene, () => putEntries(scene, depthOf));
        const listings = [];
        const items = read(scene, (args, options) => {
          if (args[0] === 'ls-tree') listings.push(args);
          return runGit(args, options);
        });
        assert.equal(items.length, 3);
        assert.equal(recordsIn(items), 3);
        assert.deepEqual(pairs(items), ALL_FOUND);
        assert.ok(items.every((item) => item.source === source));
        assert.equal(monthlySpend({ ledgers: items, month: MONTH }), microOf(7));
        assert.ok(listings.length > 0 && listings.every((args) => args.includes('-r')), JSON.stringify(listings));
      })
    );
  }
}

const NAMES_OF_LEDGER = {
  'the month path': (slug) => FILED_AT.month('ledger', slug),
  'the flat path': (slug) => FILED_AT.flat('ledger', slug),
};

function readWhenRecordNames(path, place) {
  const scene = createScene();
  try {
    const record = recordOf({ slug: 'named-post', generatedAt: AT, usd: 3 });
    scene.put(place('ledger', 'named-post'), ledgerOf({ slug: 'named-post', generationUsd: 1 }));
    scene.put(place('generation', 'named-post'), { ...record, ledger: path });
    const items = read(scene);
    return {
      summary: summary(items),
      records: recordsIn(items),
      spentMicro: monthlySpend({ ledgers: items, month: MONTH }),
      warnings: spendWarnings({ ledgers: items }),
    };
  } finally {
    scene.cleanup();
  }
}

test('a generation record that names its ledger at the flat path counts exactly like one that names the month path', () => {
  const expected = readWhenRecordNames(NAMES_OF_LEDGER['the month path']('named-post'), FILED_AT.month);
  assert.deepEqual(expected.summary, [['working tree', 'named-post', 1]]);
  assert.equal(expected.records, 1);
  assert.equal(expected.spentMicro, microOf(3));
  assert.equal(expected.warnings.length, 1);
  for (const place of DEPTHS)
    for (const [naming, nameOf] of Object.entries(NAMES_OF_LEDGER))
      assert.deepEqual(readWhenRecordNames(nameOf('named-post'), place), expected, naming);
});

const REFUSED_LEDGER_NAMES = ['audits/x.json', 'audits/autowriter/2026/13/refused-post.json'];

for (const [layout, place] of Object.entries(PLACES)) {
  test(
    `a generation record the schema refuses fails the read of the working tree, naming its path, filed ${place}`,
    withScene((scene) => {
      const path = FILED_AT[layout]('generation', 'refused-post');
      scene.putLedger(ledger('refused-post', 1));
      for (const name of REFUSED_LEDGER_NAMES) {
        scene.put(path, { ...recordOf({ slug: 'refused-post', generatedAt: AT, usd: 1 }), ledger: name });
        assert.throws(
          () => read(scene),
          (error) =>
            error instanceof SpendDataError &&
            error.message.includes(path) &&
            error.message.includes('ledger must match pattern'),
          name
        );
      }
    })
  );

  test(
    `a generation record the schema refuses fails the read of a branch, naming the ref and its path, filed ${place}`,
    withScene((scene) => {
      const path = FILED_AT[layout]('generation', 'refused-post');
      scene.onBranch('autowriter/refused-post', () => {
        scene.putLedger(ledger('refused-post', 1));
        scene.put(path, {
          ...recordOf({ slug: 'refused-post', generatedAt: AT, usd: 1 }),
          ledger: REFUSED_LEDGER_NAMES[0],
        });
      });
      assert.throws(
        () => read(scene),
        (error) =>
          error instanceof SpendDataError &&
          error.message.includes('refs/heads/autowriter/refused-post') &&
          error.message.includes(path)
      );
    })
  );
}

test(
  'claims filed beside the ledgers, flat, in their month and below it, are not spend files, in the working tree and on a ref',
  withScene((scene) => {
    for (const place of DEPTHS) scene.put(place('claim', 'stray-post'), '{ not a ledger');
    scene.commit();
    assert.deepEqual(read(scene), []);
  })
);

test(
  'one slug filed flat on main and moved into its month on a branch is one ledger, the larger version',
  withScene((scene) => {
    const flat = FILED_AT.flat('ledger', 'moved-post');
    const month = FILED_AT.month('ledger', 'moved-post');
    scene.put(flat, ledger('moved-post', 1));
    scene.commit();
    scene.onBranch('autowriter/moved-post', () => {
      mkdirSync(dirname(join(scene.root, month)), { recursive: true });
      scene.git('mv', flat, month);
      scene.put(month, ledger('moved-post', 3));
    });
    assert.deepEqual(summary(read(scene)), [['refs/heads/autowriter/moved-post', 'moved-post', 3]]);
  })
);
