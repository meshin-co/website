import { STATIC_PAGE_CATALOG } from '../../src/data/static-pages.mjs';

export const PLANTED_DATED_PAGE = {
  path: '/planted-dated',
  title: 'A planted dated page',
  description: 'A public page with an editorial date, added to the static page catalog by a test.',
  updatedDate: '2026-01-02',
};

export const PLANTED_UNDATED_PAGE = {
  path: '/planted-undated',
  title: 'A planted undated page',
  description: 'A public page with no date of its own, added to the static page catalog by a test.',
};

export function withCatalogPages(pages, run) {
  STATIC_PAGE_CATALOG.push(...pages);
  try {
    return run();
  } finally {
    STATIC_PAGE_CATALOG.splice(STATIC_PAGE_CATALOG.length - pages.length, pages.length);
  }
}
