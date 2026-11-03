const SNAPSHOT = /^https:\/\/web\.archive\.org\/web\/(\d{14})(?:[a-z]{2}_)?\/(https?:\/\/.+)$/;
const FOURTEEN_DIGITS = /^\d{14}$/;
const ARCHIVE_ORIGIN = 'https://web.archive.org';
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const ARCHIVE_NOTE_LEAD = 'Internet Archive copy, captured';
const SEARCH_NOTE = 'the original page has gone; this link is a search for it';

export const SEARCH_ORIGIN = 'https://www.google.com/search';

export function archiveSnapshot(address) {
  const found = typeof address === 'string' ? SNAPSHOT.exec(address) : null;
  return found === null ? null : { timestamp: found[1], original: found[2] };
}

const normalised = (address) => (URL.canParse(address) ? new URL(address).href : null);

export function isSnapshotOf(archiveUrl, original) {
  const snapshot = archiveSnapshot(archiveUrl);
  if (snapshot === null) return false;
  const captured = normalised(snapshot.original);
  return captured !== null && captured === normalised(original);
}

export function capturedOn(archiveUrl) {
  const snapshot = archiveSnapshot(archiveUrl);
  if (snapshot === null) return null;
  const { timestamp } = snapshot;
  const day = `${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)}`;
  const parsed = new Date(`${day}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day ? null : day;
}

export function archiveUrlFor({ timestamp, original }) {
  if (!FOURTEEN_DIGITS.test(timestamp)) throw new Error(`an archive timestamp is fourteen digits, got ${timestamp}`);
  return `${ARCHIVE_ORIGIN}/web/${timestamp}/${original}`;
}

const phraseOf = (title) => (typeof title === 'string' ? title.replace(/["\s]+/g, ' ').trim() : '');
const publisherOf = (publisher) => (typeof publisher === 'string' ? publisher.replace(/\s+/g, ' ').trim() : '');

export function searchFallbackUrl({ title, publisher }) {
  const phrase = phraseOf(title);
  if (phrase === '') throw new Error('a search link is built from the title of a source, and this one has no title');
  const named = publisherOf(publisher);
  const query = named === '' ? `"${phrase}"` : `"${phrase}" ${named}`;
  return `${SEARCH_ORIGIN}?${new URLSearchParams({ q: query })}`;
}

export const isSearchFor = (url, { title, publisher }) =>
  phraseOf(title) !== '' && url === searchFallbackUrl({ title, publisher });

export function standInKind({ url, original, title, publisher }) {
  if (typeof original !== 'string') return null;
  if (isSnapshotOf(url, original) && capturedOn(url) !== null) return 'archive';
  return isSearchFor(url, { title, publisher }) ? 'search' : null;
}

const NOTE_OF = {
  archive: ({ url }) => `${ARCHIVE_NOTE_LEAD} ${capturedOn(url)}`,
  search: () => SEARCH_NOTE,
};

export function standInNote(row) {
  const kind = standInKind(row);
  return kind === null ? null : NOTE_OF[kind](row);
}

export const isStandInNote = (text) =>
  text === SEARCH_NOTE ||
  (text.startsWith(`${ARCHIVE_NOTE_LEAD} `) && ISO_DAY.test(text.slice(ARCHIVE_NOTE_LEAD.length + 1)));

export const isStandInPhrase = (text) => text === ARCHIVE_NOTE_LEAD || text === SEARCH_NOTE;

export const citedHost = ({ original, url }) => new URL(original ?? url).hostname.replace(/^www\./, '');
