import { HUB_PAGES, STATIC_PAGE_CATALOG } from '../data/static-pages.mjs';

export function pageExists(path, { staticPages = STATIC_PAGE_CATALOG, hubs = HUB_PAGES } = {}) {
  return staticPages.some((page) => page.path === path) || hubs.some((hub) => hub.base === path);
}
