import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

import { sha256Hex } from './spec-artefacts.mjs';
import { specArtefactFindings } from './spec-artefacts-check.mjs';

const VECTORS = '{"vectors":[]}\n';
const SCHEMA = '{"type":"object"}\n';
const SITE = 'https://example.test';
const PAGE = 'spec/evals-baseline/1.0.html';
const SIDECAR = 'spec/evals-baseline/1.0.md';
const address = (file, version = '1.0') => `/spec/evals-baseline/${version}/${file}`;
const digestOf = (text) => sha256Hex(Buffer.from(text));

const htmlItem = (file, shown, version = '1.0') =>
  `<li data-artefact="${address(file, version)}"><a href="${address(file, version)}">${file}</a> SHA-256 <code data-artefact-digest>${shown}</code></li>`;
const htmlPage = (...items) => `<main><ul>${items.join('')}</ul></main>`;
const sidecarLine = (file, shown, version = '1.0') =>
  `- [${file}](${SITE}${address(file, version)}): \`application/json\`, SHA-256 \`${shown}\``;
const sidecarPage = (...lines) => `## Published files\n\n${lines.join('\n')}\n`;

function world(files = { 'vectors.json': VECTORS, 'baseline.schema.json': SCHEMA }) {
  const dist = mkdtempSync(join(tmpdir(), 'spec-artefacts-check-'));
  const put = (relative, text) => {
    mkdirSync(dirname(join(dist, relative)), { recursive: true });
    writeFileSync(join(dist, relative), text);
  };
  for (const [file, text] of Object.entries(files)) put(`spec/evals-baseline/1.0/${file}`, text);
  const names = Object.keys(files).sort();
  put(PAGE, htmlPage(...names.map((file) => htmlItem(file, digestOf(files[file])))));
  put(SIDECAR, sidecarPage(...names.map((file) => sidecarLine(file, digestOf(files[file])))));
  return { dist, put, done: () => rmSync(dist, { recursive: true, force: true }) };
}

const findingsOf = async (setup) => {
  const w = world();
  setup(w);
  const findings = await specArtefactFindings(w.dist);
  w.done();
  return findings;
};

const flipFirst = (digest) => digest.replace(/^./, (c) => (c === 'a' ? 'b' : 'a'));

test('a build whose page and sidecar show the digest of every file served has no finding', async () => {
  assert.deepEqual(await findingsOf(() => {}), []);
});

test('a build with no specification at all has no finding', async () => {
  const dist = mkdtempSync(join(tmpdir(), 'spec-artefacts-check-'));
  assert.deepEqual(await specArtefactFindings(dist), []);
  rmSync(dist, { recursive: true, force: true });
});

test('a version that serves no file has no finding, however its page reads', async () => {
  const dist = mkdtempSync(join(tmpdir(), 'spec-artefacts-check-'));
  mkdirSync(join(dist, 'spec/evals-baseline'), { recursive: true });
  writeFileSync(join(dist, PAGE), '<main>no list</main>');
  assert.deepEqual(await specArtefactFindings(dist), []);
  rmSync(dist, { recursive: true, force: true });
});

test('a digest on the page that is not the digest of the served bytes is a finding naming the page, the file and both digests', async () => {
  const served = digestOf(VECTORS);
  const wrong = flipFirst(served);
  const findings = await findingsOf(({ put }) =>
    put(PAGE, htmlPage(htmlItem('baseline.schema.json', digestOf(SCHEMA)), htmlItem('vectors.json', wrong)))
  );
  assert.equal(findings.length, 1);
  assert.ok(findings[0].includes(PAGE));
  assert.ok(findings[0].includes(address('vectors.json')));
  assert.ok(findings[0].includes(wrong));
  assert.ok(findings[0].includes(served));
});

test('a served file that changed after the page was built is a finding, because the page still shows the old digest', async () => {
  const findings = await findingsOf(({ put }) => put('spec/evals-baseline/1.0/vectors.json', `${VECTORS} `));
  assert.ok(findings.length >= 1);
  assert.ok(findings.every((finding) => finding.includes(address('vectors.json'))));
});

test('a file served at a version address that its page does not list is a finding', async () => {
  const findings = await findingsOf(({ put }) => put(PAGE, htmlPage(htmlItem('vectors.json', digestOf(VECTORS)))));
  assert.equal(findings.length, 1);
  assert.ok(findings[0].includes(address('baseline.schema.json')) && findings[0].includes('does not list'));
});

test('a page that lists a file the build does not ship is a finding', async () => {
  const findings = await findingsOf(({ put }) =>
    put(
      PAGE,
      htmlPage(
        htmlItem('baseline.schema.json', digestOf(SCHEMA)),
        htmlItem('vectors.json', digestOf(VECTORS)),
        htmlItem('ghost.json', 'c'.repeat(64))
      )
    )
  );
  assert.equal(findings.length, 1);
  assert.ok(findings[0].includes(address('ghost.json')) && findings[0].includes('not shipped'));
});

for (const shown of ['', 'abc', 'A'.repeat(64), 'g'.repeat(64), `${'a'.repeat(63)}`, `${'a'.repeat(65)}`]) {
  test(`a digest shown as ${JSON.stringify(shown.slice(0, 12))} (${shown.length} characters) is a finding`, async () => {
    const findings = await findingsOf(({ put }) =>
      put(PAGE, htmlPage(htmlItem('baseline.schema.json', digestOf(SCHEMA)), htmlItem('vectors.json', shown)))
    );
    assert.equal(findings.length, 1);
    assert.ok(findings[0].includes(address('vectors.json')));
  });
}

test('an item with no digest element is a finding that says so', async () => {
  const findings = await findingsOf(({ put }) =>
    put(
      PAGE,
      htmlPage(
        `<li data-artefact="${address('vectors.json')}"><a href="${address('vectors.json')}">vectors.json</a></li>`,
        htmlItem('baseline.schema.json', digestOf(SCHEMA))
      )
    )
  );
  assert.equal(findings.length, 1);
  assert.ok(findings[0].includes('shows no digest') && findings[0].includes(address('vectors.json')));
});

test('the digest element is read whether the minifier kept its empty attribute value or dropped it', async () => {
  const digest = digestOf(VECTORS);
  const findings = await findingsOf(({ put }) =>
    put(
      PAGE,
      htmlPage(
        htmlItem('baseline.schema.json', digestOf(SCHEMA)).replace('data-artefact-digest', 'data-artefact-digest=""'),
        `<li class="x" data-artefact="${address('vectors.json')}"><code data-artefact-digest>\n  ${digest}\n</code></li>`
      )
    )
  );
  assert.deepEqual(findings, []);
});

test('a version served without its page is a finding', async () => {
  const findings = await findingsOf(({ dist }) => rmSync(join(dist, PAGE)));
  assert.equal(findings.length, 1);
  assert.ok(findings[0].includes(PAGE) && findings[0].includes('missing'));
});

test('a sidecar line with the wrong digest names the sidecar, the file, the digest it shows and the digest served', async () => {
  const wrong = '0'.repeat(64);
  const findings = await findingsOf(({ put }) =>
    put(SIDECAR, sidecarPage(sidecarLine('baseline.schema.json', digestOf(SCHEMA)), sidecarLine('vectors.json', wrong)))
  );
  assert.equal(findings.length, 1);
  assert.ok(findings[0].includes(SIDECAR) && findings[0].includes(wrong) && findings[0].includes(digestOf(VECTORS)));
});

test('a sidecar that does not list a served file is a finding', async () => {
  const findings = await findingsOf(({ put }) =>
    put(SIDECAR, sidecarPage(sidecarLine('baseline.schema.json', digestOf(SCHEMA))))
  );
  assert.equal(findings.length, 1);
  assert.ok(findings[0].includes(address('vectors.json')) && findings[0].includes('does not list'));
});

test('a sidecar line that shows no digest is a finding that says so', async () => {
  const findings = await findingsOf(({ put }) =>
    put(
      SIDECAR,
      sidecarPage(
        sidecarLine('baseline.schema.json', digestOf(SCHEMA)),
        `- [vectors.json](${SITE}${address('vectors.json')}): application/json`
      )
    )
  );
  assert.equal(findings.length, 1);
  assert.ok(findings[0].includes('shows no digest'));
});

test('a missing sidecar is a finding', async () => {
  const findings = await findingsOf(({ dist }) => rmSync(join(dist, SIDECAR)));
  assert.equal(findings.length, 1);
  assert.ok(findings[0].includes(SIDECAR) && findings[0].includes('missing'));
});

test('every wrong digest is reported, and the findings come in a stable order', async () => {
  const w = world();
  w.put(PAGE, htmlPage(htmlItem('vectors.json', '1'.repeat(64)), htmlItem('baseline.schema.json', '2'.repeat(64))));
  const first = await specArtefactFindings(w.dist);
  const second = await specArtefactFindings(w.dist);
  assert.equal(first.length, 2);
  assert.deepEqual(first, second);
  assert.deepEqual(first, [...first].sort());
  w.done();
});

test('two versions are each checked against their own files', async () => {
  const other = '{"other":true}\n';
  const findings = await findingsOf(({ put }) => {
    put('spec/evals-baseline/1.1/vectors.json', other);
    put('spec/evals-baseline/1.1.html', htmlPage(htmlItem('vectors.json', 'f'.repeat(64), '1.1')));
    put('spec/evals-baseline/1.1.md', sidecarPage(sidecarLine('vectors.json', digestOf(other), '1.1')));
  });
  assert.equal(findings.length, 1);
  assert.ok(findings[0].includes('1.1'));
});

test('two series are each checked', async () => {
  const findings = await findingsOf(({ put }) => {
    put('spec/other-spec/2.0/vectors.json', VECTORS);
    put('spec/other-spec/2.0.html', htmlPage());
    put('spec/other-spec/2.0.md', sidecarPage());
  });
  assert.ok(findings.every((finding) => finding.includes('other-spec')));
  assert.equal(findings.length, 2);
});

test('a prose line that links a file without a digest does not hide the line that carries it', async () => {
  const findings = await findingsOf(({ put }) =>
    put(
      SIDECAR,
      `The vectors are one file, [vectors.json](${SITE}${address('vectors.json')}).\n\n${sidecarPage(sidecarLine('baseline.schema.json', digestOf(SCHEMA)), sidecarLine('vectors.json', digestOf(VECTORS)))}`
    )
  );
  assert.deepEqual(findings, []);
});

test('a wrong digest on any line that links a file is a finding, even when another line shows the right one', async () => {
  const wrong = '9'.repeat(64);
  const findings = await findingsOf(({ put }) =>
    put(
      SIDECAR,
      sidecarPage(
        sidecarLine('baseline.schema.json', digestOf(SCHEMA)),
        sidecarLine('vectors.json', digestOf(VECTORS)),
        sidecarLine('vectors.json', wrong)
      )
    )
  );
  assert.equal(findings.length, 1);
  assert.ok(findings[0].includes(wrong));
});
