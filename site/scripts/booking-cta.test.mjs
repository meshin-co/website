import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

import { BOOKING_URL } from '../src/utils/booking.mjs';
import { bookingCtaFinding, collectBookingFindings } from './booking-cta.mjs';

const link = (href, label = 'Book a 30-min fit call') => `<a href="${href}" rel="noopener noreferrer">${label}</a>`;

const page = ({ head = '', header = '', main = '', footer = '' } = {}) =>
  `<!doctype html><html><head><title>t</title>${head}</head><body><header>${header}</header><main>${main}</main><footer>${footer}</footer></body></html>`;

const withDist = async (files, check) => {
  const dir = await mkdtemp(join(tmpdir(), 'booking-cta-'));
  try {
    for (const [name, html] of Object.entries(files)) {
      await mkdir(dirname(join(dir, name)), { recursive: true });
      await writeFile(join(dir, name), html);
    }
    await check(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};

test('a route whose main links the booking url offers the next step', () => {
  assert.equal(bookingCtaFinding('/glossary/evals', page({ main: `<p>Text.</p>${link(BOOKING_URL)}` })), null);
});

test('a booking link in the header and footer alone is no call to action in the body', () => {
  const finding = bookingCtaFinding(
    '/glossary/evals',
    page({ header: link(BOOKING_URL), main: '<p>Text.</p>', footer: link(BOOKING_URL) })
  );

  assert.equal(finding.route, '/glossary/evals');
  assert.equal(finding.rule, 'booking-cta-missing');
  assert.match(finding.detail, /no link to https:\/\/cal\.com\/meshin\/30min inside <main>/);
  assert.match(finding.detail, /header and footer do not count/);
});

test('a page with no main element offers no next step', () => {
  const finding = bookingCtaFinding('/x', `<html><body><header>${link(BOOKING_URL)}</header></body></html>`);

  assert.equal(finding.rule, 'booking-cta-missing');
});

test('a booking url written inside a script, a json-ld block or a comment is not a link a reader can follow', () => {
  const main =
    `<script type="application/ld+json">{"url":"${BOOKING_URL}"}</script>` +
    `<script>box.innerHTML = '<a href="${BOOKING_URL}">x</a>';</script>` +
    `<!-- ${link(BOOKING_URL)} -->` +
    '<p>Text.</p>';

  assert.equal(bookingCtaFinding('/x', page({ main })).rule, 'booking-cta-missing');
});

test('an anchor to the cal profile or another event is named as the near miss, not accepted', () => {
  const profile = bookingCtaFinding('/x', page({ main: link('https://cal.com/meshin') }));
  const quick = bookingCtaFinding('/x', page({ main: link('https://cal.com/meshin/15min') }));

  assert.equal(profile.rule, 'booking-cta-missing');
  assert.match(profile.excerpt, /main links to https:\/\/cal\.com\/meshin instead/);
  assert.match(quick.excerpt, /main links to https:\/\/cal\.com\/meshin\/15min instead/);
});

test('a page with links but none to cal says how many it holds', () => {
  const finding = bookingCtaFinding(
    '/x',
    page({ main: '<p><a href="/pricing">Pricing</a> and <a href="/about">About</a></p>' })
  );

  assert.match(finding.excerpt, /2 links in main, none to the booking url/);
});

test('an href is compared after its ampersand entities decode', () => {
  const eventUrl = 'https://cal.com/meshin/30min?a=1&b=2';

  assert.equal(
    bookingCtaFinding('/x', page({ main: link('https://cal.com/meshin/30min?a=1&amp;b=2') }), eventUrl),
    null
  );
});

test('collecting reads every built route, skips noindex ones and names each indexable route without the call to action', async () => {
  await withDist(
    {
      'index.html': page({ main: link(BOOKING_URL) }),
      'about.html': page({ main: link(BOOKING_URL) }),
      'glossary/evals.html': page({ main: '<p>No band here.</p>' }),
      'glossary/rag.html': page({ main: '<p>No band here.</p>' }),
      'blog/page/2.html': page({ main: '<p>Page two lost its band.</p>' }),
      'search.html': page({ head: '<meta name="robots" content="noindex, follow">', main: '<p>Search.</p>' }),
      '404.html': page({ head: '<meta content="noindex, nofollow" name="robots">', main: '<p>Gone.</p>' }),
    },
    async (dist) => {
      const { checked, findings } = await collectBookingFindings(dist);

      assert.equal(checked, 5);
      assert.deepEqual(findings.map((finding) => finding.route).sort(), [
        '/blog/page/2',
        '/glossary/evals',
        '/glossary/rag',
      ]);
    }
  );
});

test('a built site whose every indexable route carries the call to action has no findings', async () => {
  await withDist(
    { 'index.html': page({ main: link(BOOKING_URL) }), 'faq/x.html': page({ main: link(BOOKING_URL) }) },
    async (dist) => {
      assert.deepEqual(await collectBookingFindings(dist), { checked: 2, findings: [] });
    }
  );
});

test('a dist with no indexable route is an error, not a pass', async () => {
  await withDist({ '404.html': page({ head: '<meta name="robots" content="noindex">', main: '' }) }, async (dist) => {
    await assert.rejects(collectBookingFindings(dist), /no indexable route/);
  });
});
