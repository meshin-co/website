import { readFile } from 'node:fs/promises';

import { BOOKING_URL } from '../src/utils/booking.mjs';
import { mainRegion } from './content-html.mjs';
import { discoverRoutes, isNoindex, routeFile } from './gate.mjs';
import { extractHrefs } from './orphan-gate.mjs';

const CAL_LINK = /^https?:\/\/(?:www\.)?cal\.com\//i;

const decoded = (href) => href.replaceAll('&amp;', '&').trim();

const linkCount = (count) => `${count} ${count === 1 ? 'link' : 'links'}`;

export function bookingCtaFinding(route, html, bookingUrl = BOOKING_URL) {
  const hrefs = extractHrefs(mainRegion(html)).map(({ href }) => decoded(href));
  if (hrefs.includes(bookingUrl)) return null;

  const nearMiss = hrefs.find((href) => CAL_LINK.test(href));
  return {
    route,
    rule: 'booking-cta-missing',
    detail: `no link to ${bookingUrl} inside <main>; header and footer do not count`,
    excerpt: nearMiss
      ? `main links to ${nearMiss} instead`
      : `${linkCount(hrefs.length)} in main, none to the booking url`,
  };
}

export async function collectBookingFindings(distDir) {
  const findings = [];
  let checked = 0;

  for (const route of await discoverRoutes(distDir)) {
    const html = await readFile(await routeFile(distDir, route), 'utf8');
    if (isNoindex(html)) continue;
    checked += 1;
    const finding = bookingCtaFinding(route, html);
    if (finding) findings.push(finding);
  }

  if (checked === 0) throw new Error(`booking: no indexable route under ${distDir}, so no call to action was checked`);
  return { checked, findings };
}
