import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { outboundFrom, readOutbound } from './outbound-links.mjs';

const ORIGIN = 'https://example.test';
const page = (...hrefs) => `<html><body>${hrefs.map((href) => `<a href="${href}">x</a>`).join('')}</body></html>`;

test('every outbound anchor is found with the pages that carry it, in address order', () => {
  const found = outboundFrom(
    [
      { route: '/b', html: page('https://z.example/doc', 'https://a.example/one') },
      { route: '/a', html: page('https://z.example/doc') },
    ],
    ORIGIN
  );

  assert.deepEqual(
    [...found],
    [
      ['https://a.example/one', ['/b']],
      ['https://z.example/doc', ['/a', '/b']],
    ]
  );
});

test('a relative link, a mail link and a link to this site are not outbound', () => {
  const found = outboundFrom(
    [
      {
        route: '/a',
        html: page('/about', 'mailto:a@example.test', 'tel:+1', `${ORIGIN}/blog`, 'https://elsewhere.example/x'),
      },
    ],
    ORIGIN
  );

  assert.deepEqual([...found.keys()], ['https://elsewhere.example/x']);
});

test('a host that bot-blocks a runner is not probed, because its answer says nothing about the page', () => {
  const found = outboundFrom(
    [
      {
        route: '/a',
        html: page(
          'https://www.linkedin.com/company/meshin',
          'https://cal.com/meshin/intro',
          'https://github.com/meshin-co/engine',
          'https://apps.apple.com/app/x',
          'https://github.com/other/repo'
        ),
      },
    ],
    ORIGIN
  );

  assert.deepEqual([...found.keys()], ['https://github.com/other/repo']);
});

test('a host that is skipped for probing is still read when the caller asks for every outbound address', () => {
  const found = outboundFrom(
    [{ route: '/a', html: page('https://www.linkedin.com/company/meshin', `${ORIGIN}/x`, 'https://ok.example/') }],
    ORIGIN,
    {
      includeSkipped: true,
    }
  );

  assert.deepEqual([...found.keys()], ['https://ok.example/', 'https://www.linkedin.com/company/meshin']);
});

test('an entity in the markup is decoded, and a fragment is dropped, so the address is the one that is requested', () => {
  const found = outboundFrom(
    [{ route: '/a', html: page('https://a.example/p?x=1&amp;y=2#section', 'https://a.example/p?x=1&y=2') }],
    ORIGIN
  );

  assert.deepEqual([...found.keys()], ['https://a.example/p?x=1&y=2']);
});

test('a malformed outbound address is kept as written, so the gate can name it rather than lose it', () => {
  const found = outboundFrom(
    [{ route: '/a', html: page('https://exa mple.com/x', 'https://', 'https://ok.example/') }],
    ORIGIN
  );

  assert.deepEqual([...found.keys()].sort(), ['https://', 'https://exa mple.com/x', 'https://ok.example/']);
});

test('a built site is read page by page, and the route of each page is its path without .html', () => {
  const root = mkdtempSync(join(tmpdir(), 'outbound-'));
  try {
    mkdirSync(join(root, 'glossary'));
    writeFileSync(join(root, 'index.html'), page('https://a.example/home'));
    writeFileSync(join(root, 'glossary', 'term.html'), page('https://a.example/home', 'https://b.example/term'));
    writeFileSync(join(root, 'feed.json'), '{"url":"https://c.example/not-a-page"}');

    assert.deepEqual(
      [...readOutbound(root, ORIGIN)],
      [
        ['https://a.example/home', ['/', '/glossary/term']],
        ['https://b.example/term', ['/glossary/term']],
      ]
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
