import { HUB_PAGES, STATIC_PAGE_CATALOG } from '../../src/data/static-pages.mjs';
import { EMPTY_COLLECTIONS } from '../../src/utils/route-exceptions.mjs';
import { SCENE_EMPTY_COLLECTIONS, SCENE_HUBS, SCENE_PAGES } from './machine-scene-catalog.mjs';

STATIC_PAGE_CATALOG.splice(0, STATIC_PAGE_CATALOG.length, ...SCENE_PAGES);
HUB_PAGES.splice(0, HUB_PAGES.length, ...SCENE_HUBS);
EMPTY_COLLECTIONS.splice(0, EMPTY_COLLECTIONS.length, ...SCENE_EMPTY_COLLECTIONS);
