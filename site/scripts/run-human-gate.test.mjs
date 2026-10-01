import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { pageFromHtml, reportLines, runGate } from './human-gate.mjs';

const RUNNER = fileURLToPath(new URL('./run-human-gate.mjs', import.meta.url));

const PLAIN =
  'The register lists every AI system the company runs. Each row names an owner and a risk tier. Someone reviews the tiers every quarter and writes the review date next to each row. A first version takes a week.';
const ANTITHESIS = 'This is not a plan, it is a way of living.';

const document = (main) =>
  `<!doctype html><html><head><title>x</title></head><body><header><nav><ul><li>Home</li><li>About</li></ul></nav></header><main>${main}</main><footer><p>Footer text here.</p></footer></body></html>`;

const withDist = async (files, check) => {
  const dir = mkdtempSync(join(tmpdir(), 'human-gate-'));
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), content);
  }
  try {
    return await check(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

test('prose counts sentences in paragraphs, list items and table cells, and never a heading or a label', () => {
  const found = pageFromHtml(
    '/x',
    document(
      '<h2>What the register holds</h2><p>The register lists every system.</p><ul><li>Each row names an owner.</li><li>Label only</li></ul><table><tbody><tr><td>Review it every quarter.</td><td>Owner</td></tr></tbody></table>'
    )
  );
  assert.equal(found.prose, 'The register lists every system. Each row names an owner. Review it every quarter.');
  assert.deepEqual(found.paragraphs, ['The register lists every system.']);
  assert.deepEqual(found.headings, ['What the register holds']);
});

test('a list item that wraps its own heading and paragraph yields the paragraph, not a glued label', () => {
  const found = pageFromHtml(
    '/x',
    document('<ol><li><div><h3>Data readiness</h3><p>I find out what data you hold.</p></div></li></ol>')
  );
  assert.equal(found.prose, 'I find out what data you hold.');
});

test('lists are counted from real ul and ol markup, so the variety rule can see them', () => {
  const found = pageFromHtml('/x', document('<ul><li>a</li><li>b</li></ul><ol><li>c</li><li>d</li><li>e</li></ol>'));
  assert.deepEqual(found.lists, [2, 3]);
});

test('chrome and data-gate-ignore blocks are never judged', () => {
  const found = pageFromHtml(
    '/x',
    document(
      '<p>Kept sentence here.</p><article data-gate-ignore><p>Card blurb that is skipped.</p><ul><li>Skipped item one.</li><li>Skipped item two.</li></ul></article>'
    )
  );
  assert.equal(found.prose, 'Kept sentence here.');
  assert.deepEqual(found.lists, []);
  assert.ok(!found.text.includes('Footer'));
  assert.ok(!found.text.includes('skipped'));
});

test('a lead paragraph marked for answer engines is still prose the reader reads', () => {
  const found = pageFromHtml('/x', document('<p data-gate-lead>The answer comes first in the lead.</p>'));
  assert.equal(found.prose, 'The answer comes first in the lead.');
});

test('runGate names the route of each finding and leaves utility and pagination routes alone', async () => {
  const flawed = document(`<p>${PLAIN}</p><p>${ANTITHESIS} The owner updates it every month.</p>`);
  await withDist(
    {
      'about/index.html': flawed,
      'fine/index.html': document(`<p>${PLAIN}</p>`),
      '404.html': flawed,
      'search/index.html': flawed,
      'styleguide/index.html': flawed,
      'blog/page/2/index.html': flawed,
      'blog/category/ops/page/3/index.html': flawed,
    },
    async (dist) => {
      const { checked, findings } = await runGate(dist);
      assert.equal(checked, 2);
      assert.deepEqual(
        findings.map(({ route, rule }) => [route, rule]),
        [['/about', 'antithesis-template']]
      );
    }
  );
});

test('the bolded-lead and emoji-bullet tells are read from the built markup', async () => {
  await withDist(
    {
      'a/index.html': document(`<p>${PLAIN}</p><ul><li><strong>Governance:</strong> the owner signs it off.</li></ul>`),
      'b/index.html': document(`<p>${PLAIN}</p><ul><li>✅ Done and signed off.</li></ul>`),
    },
    async (dist) => {
      const { findings } = await runGate(dist);
      assert.deepEqual(
        findings.map(({ route, rule }) => [route, rule]),
        [
          ['/a', 'bolded-lead'],
          ['/b', 'emoji-bullet'],
        ]
      );
    }
  );
});

test('a page with too little prose to grade is still checked for the templates', async () => {
  await withDist(
    { 'a/index.html': document(`<p>${PLAIN}</p>`), 'b/index.html': document(`<p>${ANTITHESIS}</p>`) },
    async (dist) => {
      const { checked, measured, findings } = await runGate(dist);
      assert.equal(checked, 2);
      assert.equal(measured, 1);
      assert.deepEqual(
        findings.map(({ route, rule }) => [route, rule]),
        [['/b', 'antithesis-template']]
      );
    }
  );
});

test('a tree with no pages is a finding, because a gate that checked nothing reads like a pass', async () => {
  await withDist({}, async (dist) => {
    const { checked, findings } = await runGate(dist);
    assert.equal(checked, 0);
    assert.deepEqual(
      findings.map(({ rule }) => rule),
      ['no-pages']
    );
  });
});

test('a tree where no page has enough prose to grade is a finding, because extraction may have broken', async () => {
  await withDist({ 'a/index.html': document('<p>One short line.</p>') }, async (dist) => {
    const { checked, measured, findings } = await runGate(dist);
    assert.equal(checked, 1);
    assert.equal(measured, 0);
    assert.deepEqual(
      findings.map(({ rule }) => rule),
      ['nothing-measured']
    );
  });
});

test('the report opens with the counts, then names the route and rule of every finding', () => {
  const lines = reportLines({
    checked: 3,
    measured: 2,
    findings: [
      { route: '/about', rule: 'antithesis-template', detail: 'not X, it is Y', excerpt: 'not a plan, it is a way' },
      { route: '/faq', rule: 'reading-grade', detail: '14.2 > 14' },
    ],
  });
  assert.deepEqual(lines, [
    'human: 3 pages checked, 2 measured for reading level, 2 findings',
    'HUMAN /about antithesis-template: not X, it is Y | not a plan, it is a way',
    'HUMAN /faq reading-grade: 14.2 > 14',
  ]);
});

test('the runner exits 0 on a clean tree and prints the summary', async () => {
  await withDist({ 'a/index.html': document(`<p>${PLAIN}</p>`) }, (dist) => {
    const run = spawnSync(process.execPath, [RUNNER, dist], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stdout + run.stderr);
    assert.match(run.stdout, /^human: 1 pages checked, 1 measured for reading level, 0 findings$/m);
  });
});

test('the runner exits 1 and names the route and the rule of a finding', async () => {
  await withDist(
    {
      'a/index.html': document(`<p>${PLAIN}</p>`),
      'b/index.html': document(`<p>${PLAIN}</p><p>You can commence the task now.</p>`),
    },
    (dist) => {
      const run = spawnSync(process.execPath, [RUNNER, dist], { encoding: 'utf8' });
      assert.equal(run.status, 1);
      assert.match(run.stdout, /^HUMAN \/b controlled-word: commence → start$/m);
    }
  );
});
