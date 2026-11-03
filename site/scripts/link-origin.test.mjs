import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { GIT_ENVIRONMENT, commitIn, gitAt, makeDiffRepo, removeRepo } from './fixtures/diff-repo.mjs';
import { canonicalUrl, introducedUrls, isShippedSource, linkOrigins, urlsIn } from './link-origin.mjs';

const urls = (text) => [...urlsIn(text)].sort();

test('an address is compared in one form: host lowercased, fragment dropped, entities decoded', () => {
  assert.equal(canonicalUrl('https://Example.com'), 'https://example.com/');
  assert.equal(canonicalUrl('https://example.com/a#section'), 'https://example.com/a');
  assert.equal(canonicalUrl('https://example.com/a?x=1&amp;y=2'), 'https://example.com/a?x=1&y=2');
});

test('only an http or https address is an outbound link', () => {
  for (const other of ['mailto:a@example.com', '/relative/path', 'not a url', 'ftp://example.com/f', '', undefined])
    assert.equal(canonicalUrl(other), null, String(other));
});

test('a markdown link, a titled link, an autolink and a reference definition each give their address', () => {
  const text = [
    'See [one](https://a.example/one) and [two](https://a.example/two "A title").',
    'Also <https://a.example/three> and',
    '[ref]: https://a.example/four',
  ].join('\n');

  assert.deepEqual(urls(text), [
    'https://a.example/four',
    'https://a.example/one',
    'https://a.example/three',
    'https://a.example/two',
  ]);
});

test('a frontmatter url is found plain, single-quoted and double-quoted, and so is one in a json string', () => {
  const text = [
    'url: https://a.example/plain',
    "url: 'https://a.example/single'",
    'url: "https://a.example/double"',
    '{ "href": "https://a.example/json", "other": 1 }',
  ].join('\n');

  assert.deepEqual(urls(text), [
    'https://a.example/double',
    'https://a.example/json',
    'https://a.example/plain',
    'https://a.example/single',
  ]);
});

test('the punctuation of the sentence around a bare address is not part of it', () => {
  assert.deepEqual(urls('Read https://a.example/x. Then https://a.example/y, and (see https://a.example/z).'), [
    'https://a.example/x',
    'https://a.example/y',
    'https://a.example/z',
  ]);
});

test('a parenthesis that belongs to the address stays, and one that closes the link does not', () => {
  assert.deepEqual(urls('[w](https://en.wikipedia.org/wiki/Foo_(bar)) and [x](https://a.example/x)'), [
    'https://a.example/x',
    'https://en.wikipedia.org/wiki/Foo_(bar)',
  ]);
});

test('an html attribute is read with its entities decoded, and a fragment does not make a second address', () => {
  assert.deepEqual(
    urls('<a href="https://a.example/p?a=1&amp;b=2#top">p</a> <a href="https://a.example/p?a=1&b=2">q</a>'),
    ['https://a.example/p?a=1&b=2']
  );
});

test('an address that is the start of a longer one is a different address', () => {
  assert.deepEqual(urls('https://a.example/x and https://a.example/xy and https://a.example/x/y'), [
    'https://a.example/x',
    'https://a.example/x/y',
    'https://a.example/xy',
  ]);
});

test('nothing is found in no text, and a non-http scheme is ignored', () => {
  assert.deepEqual(urls(''), []);
  assert.deepEqual(urls(null), []);
  assert.deepEqual(urls('mail me@example.com or ftp://a.example/f'), []);
});

test('an address introduced is one the new text has and the old text did not', () => {
  const before = 'url: https://a.example/kept\nurl: https://a.example/dropped\n';
  const after = "url: 'https://a.example/kept'\nurl: https://a.example/added\n";

  assert.deepEqual([...introducedUrls({ before, after })], ['https://a.example/added']);
});

test('re-quoting a line, moving it or editing the text around it introduces nothing', () => {
  const before = 'one [a](https://a.example/x) two\n';
  const after = 'intro\n\n<https://a.example/x> reworded\n';

  assert.deepEqual([...introducedUrls({ before, after })], []);
});

test('a file that is new introduces every address it holds, and a file that is gone introduces none', () => {
  assert.deepEqual([...introducedUrls({ before: null, after: '[a](https://a.example/x)' })], ['https://a.example/x']);
  assert.deepEqual([...introducedUrls({ before: '[a](https://a.example/x)', after: null })], []);
});

test('only text that can reach the built pages counts: shipped sources, not tests, scripts or documents', () => {
  const shipped = [
    'site/src/data/glossary/a.md',
    'site/src/data/post/b.mdx',
    'site/src/components/site/Footer.astro',
    'site/src/navigation.ts',
    'site/src/config.yaml',
    'site/public/llms.json',
  ];
  const other = [
    'site/src/utils/archive-url.test.mjs',
    'site/scripts/links-gate.mjs',
    'docs/PRD.md',
    'audits/link-rot.json',
    'site/src/assets/images/logo.png',
    'site/src/assets/fonts/inter.woff2',
    'site/src/styles/global.css',
  ];

  for (const path of shipped) assert.equal(isShippedSource(path), true, path);
  for (const path of other) assert.equal(isShippedSource(path), false, path);
});

const BASE_FILES = {
  'site/src/data/glossary/old.md': '---\nsources:\n  - url: https://dead.example/old\n---\nOld body.\n',
  'site/src/components/Footer.astro': '<a href="https://dead.example/footer">footer</a>\n',
  'site/scripts/notes.mjs': "export const note = 'https://dead.example/script-only';\n",
};

const gitFor = (root) => (args) => {
  try {
    return execFileSync('git', ['-C', root, ...args], { env: GIT_ENVIRONMENT, encoding: 'utf8', stdio: 'pipe' });
  } catch {
    return null;
  }
};

const readIn = (root) => (path) => {
  try {
    return readFileSync(join(root, path), 'utf8');
  } catch {
    return null;
  }
};

function scene(headChange) {
  const root = makeDiffRepo({ ...BASE_FILES, 'docs/PRD.md': '# PRD\n' });
  const base = gitAt(root, 'rev-parse', 'HEAD');
  const head = commitIn(root, { ...headChange, message: 'the change' });
  return { root, range: `${base}..${head}`, git: gitFor(root), readFile: readIn(root) };
}

test('a dead address that the change did not add is on main and is not introduced', () => {
  const { root, range, git, readFile } = scene({
    write: {
      'site/src/data/glossary/old.md': '---\nsources:\n  - url: https://dead.example/old\n---\nOld body, reworded.\n',
    },
  });
  try {
    const origins = linkOrigins({ git, readFile, range });

    assert.deepEqual([...origins.introduced], []);
    assert.equal(origins.onMain.has('https://dead.example/old'), true);
    assert.equal(origins.onMain.has('https://dead.example/footer'), true);
    assert.equal(origins.onMain.has('https://dead.example/script-only'), false, 'scripts are not shipped');
  } finally {
    removeRepo(root);
  }
});

test('a citation a new entry adds is introduced, even when another entry on main already cites the same address', () => {
  const { root, range, git, readFile } = scene({
    write: {
      'site/src/data/glossary/new.md': [
        '---',
        'sources:',
        '  - url: https://dead.example/new',
        '  - url: https://dead.example/old',
        '---',
        'New body.',
        '',
      ].join('\n'),
    },
  });
  try {
    const origins = linkOrigins({ git, readFile, range });

    assert.deepEqual([...origins.introduced].sort(), ['https://dead.example/new', 'https://dead.example/old']);
    assert.equal(origins.onMain.has('https://dead.example/new'), false);
  } finally {
    removeRepo(root);
  }
});

test('an address added to an entry that already existed is introduced, and the ones it kept are not', () => {
  const { root, range, git, readFile } = scene({
    write: {
      'site/src/data/glossary/old.md':
        '---\nsources:\n  - url: https://dead.example/old\n  - url: https://dead.example/added\n---\nOld body.\n',
    },
  });
  try {
    assert.deepEqual([...linkOrigins({ git, readFile, range }).introduced], ['https://dead.example/added']);
  } finally {
    removeRepo(root);
  }
});

test('a change that touches only scripts or documents introduces no address', () => {
  const { root, range, git, readFile } = scene({
    write: {
      'site/scripts/notes.mjs': "export const note = 'https://dead.example/another';\n",
      'docs/PRD.md': '[x](https://dead.example/doc)\n',
    },
  });
  try {
    assert.deepEqual([...linkOrigins({ git, readFile, range }).introduced], []);
  } finally {
    removeRepo(root);
  }
});

test('without a range and without a main to compare with, nothing can be proven inherited', () => {
  const { root, git, readFile } = scene({ write: { 'docs/PRD.md': '# changed\n' } });
  try {
    assert.equal(linkOrigins({ git, readFile }), null);
  } finally {
    removeRepo(root);
  }
});
