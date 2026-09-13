export const PAGE_SIZE = 12;

export function pageCount(entries, pageSize = PAGE_SIZE) {
  return Math.ceil(entries.length / pageSize);
}

/**
 * @template T
 * @param {T[]} entries
 * @returns {T[]}
 */
export function firstPage(entries, pageSize = PAGE_SIZE) {
  return entries.slice(0, pageSize);
}

export function paginate(entries, pageSize = PAGE_SIZE) {
  const pages = [];
  for (let pageNumber = 2; pageNumber <= pageCount(entries, pageSize); pageNumber += 1) {
    pages.push({
      pageNumber,
      entries: entries.slice((pageNumber - 1) * pageSize, pageNumber * pageSize),
    });
  }
  return pages;
}

export function pagePath(basePath, pageNumber) {
  return pageNumber === 1 ? basePath : `${basePath}/page/${pageNumber}`;
}

export function paginationLinks(basePath, entries, pageSize = PAGE_SIZE) {
  const total = pageCount(entries, pageSize);
  if (total <= 1) return [];
  return Array.from({ length: total }, (_, index) => ({
    pageNumber: index + 1,
    href: pagePath(basePath, index + 1),
  }));
}
