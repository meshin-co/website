import { supportsCitation, visibleText } from './snapshot-support.mjs';

export const ARCHIVE_SPACING_MS = 10_000;

const days = (count) => `${count} ${count === 1 ? 'day' : 'days'}`;

const waiting = (reason) => ({
  kind: 'waiting',
  why: `the Internet Archive did not answer (${reason}), so the citation was left as it is and is tried again on the next run`,
});

const searching = (why) => ({ kind: 'search', why });

const archived = ({ snapshot, checked, why }) => ({
  kind: 'archive',
  archiveUrl: snapshot.url,
  checked,
  capture: { timestamp: snapshot.timestamp, capturedOn: snapshot.capturedOn, distanceDays: snapshot.distanceDays },
  why,
});

const remembered = (memory, key, ask) => {
  if (!memory.has(key)) memory.set(key, ask());
  return memory.get(key);
};

export function archiveRung({ closestSnapshot, readSnapshot, sleep, spacingMs = ARCHIVE_SPACING_MS }) {
  const lookups = new Map();
  const captures = new Map();
  let calls = 0;

  const paced = async (ask, input) => {
    if (calls > 0) await sleep(spacingMs);
    calls += 1;
    return ask(input);
  };
  const lookup = (address, citedOn) =>
    remembered(lookups, `${address}\n${citedOn}`, () => paced(closestSnapshot, { url: address, citedOn }));
  const capture = (snapshot) => remembered(captures, snapshot.url, () => paced(readSnapshot, { snapshot }));

  async function place({ address, citedOn, title }) {
    const found = await lookup(address, citedOn);
    if (found.kind === 'unavailable') return waiting(found.reason);
    if (found.kind === 'none') return searching(`no usable Internet Archive capture: ${found.reason}`);

    const { snapshot } = found;
    const page = await capture(snapshot);
    if (page.kind === 'unavailable') return waiting(page.reason);

    const closeness = `the Internet Archive capture of ${snapshot.capturedOn} is ${days(snapshot.distanceDays)} from the citation date ${citedOn}`;
    if (page.kind === 'unreadable' && page.cause === 'content-type') {
      return archived({
        snapshot,
        checked: false,
        why: `${closeness}. It was accepted unchecked because ${page.reason}.`,
      });
    }
    if (page.kind === 'unreadable') {
      return searching(`the Internet Archive capture of ${snapshot.capturedOn} could not be read: ${page.reason}`);
    }

    const verdict = supportsCitation({ text: visibleText(page.text), title, spans: [] });
    if (!verdict.ok) {
      return searching(
        `the Internet Archive capture of ${snapshot.capturedOn} does not carry the source title: ${verdict.reason}`
      );
    }
    return archived({ snapshot, checked: true, why: `${closeness} and carries the title` });
  }

  return { place };
}
