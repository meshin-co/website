const SNAPSHOT = /^https:\/\/web\.archive\.org\/web\/(\d{14})(?:[a-z]{2}_)?\/(https?:\/\/.+)$/;
const FOURTEEN_DIGITS = /^\d{14}$/;
const ARCHIVE_ORIGIN = 'https://web.archive.org';

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
