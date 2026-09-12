export function lastmod(entry) {
  const stamps = [entry?.updatedDate, entry?.publishDate]
    .filter((value) => value != null)
    .map((value) => new Date(value).getTime());
  return stamps.length === 0 ? null : new Date(Math.max(...stamps)).toISOString();
}
