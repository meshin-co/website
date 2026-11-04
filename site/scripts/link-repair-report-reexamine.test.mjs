import assert from 'node:assert/strict';
import test from 'node:test';

import {
  LISTED_PER_SECTION,
  MAX_BODY_LENGTH,
  commitMessage,
  pullRequestBody,
  pullRequestTitle,
  summaryLine,
} from './link-repair-report.mjs';

const TODAY = '2026-11-04';
const NIST = 'https://www.nist.gov/itl/ai-risk-management-framework';
const OTHER = 'https://example.org/report';
const SNAPSHOT = `https://web.archive.org/web/20230302214609/${OTHER}`;
const ENTRY = 'site/src/data/glossary/ai-rmf.md';

const restored = (changes = {}) => ({
  original: NIST,
  entry: ENTRY,
  citedOn: '2023-03-01',
  firstSeenDead: '2026-10-20',
  checked: true,
  why: `on ${TODAY} the original address answers again and its page carries the source title`,
  ...changes,
});
const upgraded = (changes = {}) => ({
  original: OTHER,
  entry: 'site/src/data/post/a-post.md',
  outcome: 'archive',
  replacement: SNAPSHOT,
  citedOn: '2023-03-01',
  firstSeenDead: '2026-10-21',
  why: 'the Internet Archive capture of 2023-03-02 is 1 day from the citation date 2023-03-01 and carries the title',
  ...changes,
});
const swept = (changes = {}) => ({
  checked: 120,
  dead: [],
  rows: [],
  waitingForCap: [],
  waitingForArchive: [],
  lapsed: [],
  counts: { dead: 0, archive: 0, search: 0, unplaced: 0, waiting: 0, watching: 0 },
  ...changes,
});
const resultOf = ({ restoredRows = [], upgradedRows = [], waiting = [], failures = [], ...changes } = {}) => {
  const base = swept(changes);
  return {
    ...base,
    restored: restoredRows,
    upgraded: upgradedRows,
    reexamineWaiting: waiting,
    reexamineFailures: failures,
    counts: { ...base.counts, restored: restoredRows.length, upgraded: upgradedRows.length },
  };
};
const bodyOf = (result) => pullRequestBody({ today: TODAY, result });

test('the summary line says how many citations were restored and how many moved up, between the watching count and the pull request', () => {
  const counts = { dead: 5, archive: 2, search: 1, unplaced: 1, waiting: 3, watching: 4, restored: 6, upgraded: 7 };

  assert.equal(
    summaryLine({ counts, pullRequest: 'https://github.com/meshin-co/website/pull/12' }),
    'repair-links: dead=5 archive=2 search=1 unplaced=1 waiting=3 watching=4 restored=6 upgraded=7 pr=https://github.com/meshin-co/website/pull/12'
  );
  assert.equal(
    summaryLine({ counts, pullRequest: null, note: 'a note' }),
    'repair-links: dead=5 archive=2 search=1 unplaced=1 waiting=3 watching=4 restored=6 upgraded=7 pr=none (a note)'
  );
});

test('the title says how many citations were restored and how many moved up, next to what the sweep repaired', () => {
  const title = (counts) =>
    pullRequestTitle({ today: TODAY, counts: { archive: 0, search: 0, unplaced: 0, ...counts } });

  assert.equal(title({ restored: 1 }), 'fix(links): restore 1 citation from a search link (2026-11-04)');
  assert.equal(title({ restored: 3 }), 'fix(links): restore 3 citations from a search link (2026-11-04)');
  assert.equal(title({ upgraded: 1 }), 'fix(links): move 1 citation up from a search link (2026-11-04)');
  assert.equal(
    title({ restored: 1, upgraded: 2 }),
    'fix(links): restore 1 citation and move 2 citations up from a search link (2026-11-04)'
  );
  assert.equal(
    title({ archive: 2, search: 1, restored: 1, upgraded: 2 }),
    'fix(links): repair 3 dead citations, restore 1 citation and move 2 citations up from a search link (2026-11-04)'
  );
  assert.equal(
    title({ unplaced: 2, restored: 1 }),
    'fix(links): restore 1 citation from a search link (2026-11-04)',
    'a change in an entry is a fix, whatever else was recorded'
  );
});

test('a run that changed nothing in an entry still has the title it always had, and counts without the new fields still work', () => {
  assert.equal(
    pullRequestTitle({ today: TODAY, counts: { archive: 0, search: 0, unplaced: 2, restored: 0, upgraded: 0 } }),
    'chore(links): record 2 dead addresses no entry can be repaired for (2026-11-04)'
  );
  assert.equal(
    pullRequestTitle({ today: TODAY, counts: { archive: 1, search: 0, unplaced: 0 } }),
    'fix(links): repair 1 dead citation (2026-11-04)'
  );
});

test('the commit message is the title when citations were restored too', () => {
  const counts = { archive: 0, search: 0, unplaced: 0, restored: 2, upgraded: 1 };

  assert.equal(commitMessage({ today: TODAY, counts }).split('\n')[0], pullRequestTitle({ today: TODAY, counts }));
});

test('the body lists each restored citation with the entry, the original address, the day cited, the day it went dead and why', () => {
  const body = bodyOf(
    resultOf({ restoredRows: [restored(), restored({ original: OTHER, entry: 'site/src/data/post/a-post.md' })] })
  );

  assert.match(body, /^## Restored to the original address$/m);
  assert.match(body, /answers again and carries the source title, so the row points at it again/);
  assert.ok(
    body.includes(
      `- \`${ENTRY}\`, cited 2023-03-01: ${NIST} went back to the address that was cited (first seen dead 2026-10-20; on ${TODAY} the original address answers again and its page carries the source title)`
    ),
    body
  );
  assert.ok(body.includes(`\`site/src/data/post/a-post.md\`, cited 2023-03-01: ${OTHER} went back`));
});

test('a restore that was accepted unchecked says so in its line, so a person knows to read the page', () => {
  const why = `on ${TODAY} the original address answers again. It was accepted unchecked because the page is application/pdf, which the machine cannot read; a person must judge it`;
  const body = bodyOf(resultOf({ restoredRows: [restored({ checked: false, why })] }));

  assert.ok(body.includes(why));
  assert.match(body, /accepted unchecked/);
});

test('the body lists each citation that moved up with the replacement address, like a repair, and says the original stays in the row', () => {
  const body = bodyOf(resultOf({ upgradedRows: [upgraded()] }));

  assert.match(body, /^## Moved up from a search link to the Internet Archive$/m);
  assert.ok(
    body.includes(
      `- \`site/src/data/post/a-post.md\`, cited 2023-03-01: ${OTHER} became ${SNAPSHOT} (the Internet Archive capture of 2023-03-02 is 1 day from the citation date 2023-03-01 and carries the title)`
    ),
    body
  );
  assert.match(body, /The address that was cited stays in the row as `original`/);
});

test('a section with nothing in it is not printed, and a result with no re-examination fields at all reads as it always did', () => {
  const none = bodyOf(resultOf());
  const old = bodyOf(swept());

  for (const body of [none, old]) {
    assert.doesNotMatch(body, /Restored to the original address/);
    assert.doesNotMatch(body, /Moved up from a search link/);
    assert.doesNotMatch(body, /left as they are because/);
  }
});

test('citations left alone because an address or the archive could not be asked are named, and not described as repaired', () => {
  const waiting = [
    { original: NIST, entry: ENTRY, why: 'the Internet Archive did not answer (HTTP 503)' },
    {
      original: OTHER,
      entry: 'site/src/data/post/a-post.md',
      why: 'the original address could not be asked (timed out)',
    },
  ];
  const body = bodyOf(resultOf({ waiting }));

  assert.match(body, /^## Waiting$/m);
  assert.ok(
    body.includes(
      `- 2 citations that rest on a search link were left as they are because the original address or the Internet Archive could not be asked, and the next run that reaches them asks again: \`${ENTRY}\`, \`site/src/data/post/a-post.md\`.`
    ),
    body
  );
});

test('an entry the re-examination could not rewrite is named with the reason, and is said to stay on its search link', () => {
  const failures = [
    { original: NIST, entry: ENTRY, message: `${ENTRY}: prose links to a search that more than one row rests on` },
  ];
  const body = bodyOf(resultOf({ failures }));

  assert.match(body, /^## Left on a search link$/m);
  assert.ok(body.includes(`- ${ENTRY}: prose links to a search that more than one row rests on`), body);
  assert.match(body, /a person decides/);
});

test('the sections come in the order a reader follows the story: repaired, moved up, restored, on a search link, not placed', () => {
  const body = bodyOf(
    resultOf({
      restoredRows: [restored()],
      upgradedRows: [upgraded()],
      rows: [
        { ...upgraded({ entry: 'site/src/data/post/b-post.md' }) },
        {
          ...upgraded({
            entry: 'site/src/data/post/c-post.md',
            outcome: 'search',
            replacement: 'https://www.google.com/search?q=x',
          }),
        },
        {
          original: 'https://t.example/',
          entry: null,
          outcome: 'unplaced',
          replacement: null,
          citedOn: null,
          firstSeenDead: '2026-11-04',
          why: 'w',
          pages: ['/'],
        },
      ],
      failures: [{ original: NIST, entry: ENTRY, message: 'x' }],
    })
  );
  const at = (heading) => body.indexOf(`## ${heading}`);

  assert.ok(at('Repaired from the Internet Archive') < at('Resting on a search link'));
  assert.ok(at('Resting on a search link') < at('Moved up from a search link to the Internet Archive'));
  assert.ok(at('Moved up from a search link to the Internet Archive') < at('Restored to the original address'));
  assert.ok(at('Restored to the original address') < at('Left on a search link'));
  assert.ok(at('Left on a search link') < at('Not placed'));
});

test('a body for a thousand restored and a thousand moved up stays under what GitHub accepts, and says where the rows it left out are', () => {
  const many = (make) =>
    Array.from({ length: 1000 }, (_, index) =>
      make({ original: `https://example.org/doc-${index}`, entry: `site/src/data/post/entry-${index}.md` })
    );
  const body = bodyOf(resultOf({ restoredRows: many(restored), upgradedRows: many(upgraded) }));

  assert.ok(body.length <= MAX_BODY_LENGTH, String(body.length));
  assert.match(body, /Restored to the original address/);
  assert.match(body, /more citations are in the diff of this pull request/);
  assert.match(body, /more rows are in audits\/link-rot\.json/);
  assert.ok(LISTED_PER_SECTION > 0);
});
