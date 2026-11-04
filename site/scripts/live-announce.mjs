import { surfacesOf } from './entry-surfaces.mjs';
import { probeUntilLive } from './live-probe.mjs';
import { liveMessage, messageGroups, unreachableMessage } from './live-slack.mjs';
import { deliverNotice } from './slack-notice.mjs';
import { countText } from './spend-report-text.mjs';

const failureOf = ({ failure, attempts, checkedAt }) =>
  `${failure} after ${countText(attempts, 'attempt', 'attempts')}, last checked ${checkedAt}`;

async function probeAll({ urls, fetch, sleep, now }) {
  const probed = await Promise.all(
    [...new Set(urls)].map(async (url) => [url, await probeUntilLive({ url, fetch, sleep, now })])
  );
  return new Map(probed);
}

const probedEntry = ({ entry, surfaces, probes }) => {
  const [page, ...others] = surfaces.map((surface) => ({ ...surface, probe: probes.get(surface.url) }));
  return { ...entry, page, surfaces: others };
};

const liveLine = ({ slug, page: { probe } }) =>
  `live entry: ${slug} is live: HTTP ${probe.status} on attempt ${probe.attempts}, checked ${probe.checkedAt}`;

const unreachableLine = ({ slug, page }) =>
  `::warning::live entry: ${slug} merged but ${page.url} is not reachable: ${failureOf(page.probe)}`;

const surfaceLines = ({ slug, surfaces }) =>
  surfaces
    .filter(({ probe }) => !probe.reachable)
    .map(
      ({ label, url, probe }) =>
        `::warning::live entry: ${slug} is live, but a surface does not answer: ${label} ${url}, ${failureOf(probe)}`
    );

export async function announceEntries({ entries, origin, status, links, record, ...io }) {
  const { env, fetch, now, sleep, stdout, stderr } = io;
  const listed = entries.map(({ format, slug }) => surfacesOf({ format, slug, origin }));
  const probes = await probeAll({ urls: listed.flat().map(({ url }) => url), fetch, sleep, now });
  const probed = entries.map((entry, at) => probedEntry({ entry, surfaces: listed[at], probes }));
  const post = (label, message) => deliverNotice({ label, message, env, fetch, instant: now(), stdout, stderr });
  const live = probed.filter(({ page }) => page.probe.reachable);
  for (const group of messageGroups(live)) {
    group.forEach((entry) => stdout(liveLine(entry)));
    group.flatMap(surfaceLines).forEach(stderr);
    if (await post('live entry', liveMessage({ status, entries: group, links })))
      record(group.map(({ route }) => route));
  }
  const unreachable = probed.filter(({ page }) => !page.probe.reachable);
  if (unreachable.length === 0) return;
  unreachable.map(unreachableLine).forEach(stderr);
  await post('live entry warning', unreachableMessage({ status, entries: unreachable, links }));
}
