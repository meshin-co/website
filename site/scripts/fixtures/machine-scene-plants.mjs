import { STATIC_PAGE_CATALOG } from '../../src/data/static-pages.mjs';
import {
  ORIGIN,
  appendText,
  dropLines,
  editJson,
  editText,
  readText,
  removeFile,
  writeText,
} from './machine-scene.mjs';

const LLMS = '/llms.txt';
const LLMS_FULL = '/llms-full.txt';
const SITEMAP = '/sitemap-0.xml';
const HUMANS = '/humans.txt';
const LLMS_BYTE_GUARD = 8192;
const FILLER = `${'filler '.repeat(1100)}\n`;
const PLANTED_INSTANT = '2026-10-01T00:00:00.000Z';
const STALE_DAY = '1999-01-01';
const PLANTED_DESCRIPTION = 'Planted drift.';

const HUMANS_ABSENT = 'humans.txt names Bogus Framework, which is not a dependency of this project';
const HUMANS_MISSING = 'humans.txt names no Components line, so its stack claim cannot be checked';
const BROKEN_LD_JSON = '/imprint carries an ld+json block that does not parse, so its dateModified was not compared';
const NOT_BUILT = '/blog/tags catalog-route-missing [/blog/tags is in the catalog but did not build]';
const FEED_JSON_RULE = '/feed.json\n  X-Robots-Tag: noindex';
const SEARCH_ENTRY = `<url><loc>${ORIGIN}/search</loc><lastmod>${PLANTED_INSTANT}</lastmod></url>\n</urlset>`;
const INLINE_REASON = 'entries of an unbounded collection belong in /llms/';
const UNLISTED_SPRINT = 'llms.txt and /llms/ are missing indexable route /services/sprint';

const failure = (rule, text, subjects = []) => ({ rule, subjects, text });
const instantOf = (day) => `${day}T00:00:00.000Z`;
const bytesOf = (scene, file) => Buffer.byteLength(readText(scene.distFile(file)), 'utf8');

function catalogPage(path) {
  const page = STATIC_PAGE_CATALOG.find((candidate) => candidate.path === path);
  if (page === undefined) throw new Error(`the catalog has no ${path}, which the scene plants against`);
  return page;
}

const editDist = (file, change) => (scene) => editText(scene.distFile(file), change);
const dropDist = (file, needle) => (scene) => dropLines(scene.distFile(file), needle);
const appendDist = (file, extra) => (scene) => appendText(scene.distFile(file), extra);
const removeDist = (file) => (scene) => removeFile(scene.distFile(file));

function together(...steps) {
  return (scene) => {
    for (const step of steps) step(scene);
  };
}

const dropGlossaryFromFeedJson = (scene) =>
  editJson(scene.distFile('feed.json'), (feed) => {
    feed.items = feed.items.filter(({ url }) => !url.includes('/glossary/'));
  });

const declareGhostCollection = (scene) =>
  editText(scene.siteFile('src/content.config.ts'), (source) => source.replace('};', '  ghost: ghostCollection,\n};'));

const withBogusComponent = (text) => text.replace('Tailwind CSS', 'Tailwind CSS, Bogus Framework');
const withoutComponents = (text) => text.replace(/^Components:.*\n/m, '');
const withSearchEntry = (xml) => xml.replace('</urlset>', SEARCH_ENTRY);
const withoutTitle = (text) => text.replace(/^# .*\n/, '');
const withStaleDay = (text) => text.replace(/^Updated: .*$/m, `Updated: ${STALE_DAY}`);
const withBrokenLdJson = (html) => html.replace(/(<script type="application\/ld\+json">)[^<]*/, '$1{not json');
const withOtherCanonical = (html) => html.replace(`href="${ORIGIN}/pricing"`, `href="${ORIGIN}/pricing-old"`);
const withPlantedDescription = (html) =>
  html.replace(/(<meta name="description" content=")[^"]*/, `$1${PLANTED_DESCRIPTION}`);
const withOtherRobotsTag = (text) => text.replace(FEED_JSON_RULE, FEED_JSON_RULE.replace('noindex', 'all'));
const withOtherCount = (text) => text.replace('llms/glossary.txt): 1 entry', 'llms/glossary.txt): 7 entries');

export const PLANTS = [
  {
    variant: 'absent',
    name: 'humans.txt names a component the project does not depend on',
    plant: editDist('humans.txt', withBogusComponent),
    expected: () => [failure('humans-component-absent', `humans-component-absent ${HUMANS_ABSENT}`, [HUMANS])],
  },
  {
    variant: 'missing',
    name: 'humans.txt has no Components line',
    plant: editDist('humans.txt', withoutComponents),
    expected: () => [failure('humans-components-missing', `humans-components-missing ${HUMANS_MISSING}`, [HUMANS])],
  },
  {
    name: 'llms.txt links a noindex static page',
    plant: appendDist('llms.txt', '- [Search](/search): the search page\n'),
    expected: () => [failure('llms-lists-noindex-page', 'llms.txt lists noindex page /search', [LLMS, '/search'])],
  },
  {
    name: 'llms.txt grows past its byte guard',
    plant: appendDist('llms.txt', FILLER),
    expected: (scene) => {
      const text = `llms.txt is ${bytesOf(scene, 'llms.txt')} bytes, over the ${LLMS_BYTE_GUARD} byte guard`;
      return [failure('llms-size', text, [LLMS])];
    },
  },
  {
    name: 'llms.txt, llms-full.txt and a per-collection file each leave out a route',
    plant: together(
      dropDist('llms.txt', `(${ORIGIN}/services/sprint)`),
      dropDist('llms.txt', `(${ORIGIN}/about)`),
      dropDist('llms-full.txt', `${ORIGIN}/glossary/evals`),
      dropDist('llms/post.txt', `${ORIGIN}/blog/first-post`)
    ),
    expected: () => [
      failure('llms-omits-route', 'llms.txt omits /services/sprint', [LLMS, '/services/sprint']),
      failure('llms-omits-route', 'llms.txt and /llms/ are missing indexable route /about', [LLMS, '/about']),
      failure('llms-omits-route', UNLISTED_SPRINT, [LLMS, '/services/sprint']),
      failure('llms-omits-route', 'llms-full.txt omits /glossary/evals', [LLMS_FULL, '/glossary/evals']),
      failure('llms-omits-route', '/llms/post.txt omits /blog/first-post', ['/llms/post.txt', '/blog/first-post']),
      failure('llms-corpus', 'llms.txt says 2 entries for post, its files hold 1'),
    ],
  },
  {
    name: 'llms.txt lists an entry of an unbounded collection inline',
    plant: appendDist('llms.txt', `- [First post](${ORIGIN}/blog/first-post): a post\n`),
    expected: () => {
      const text = `llms.txt lists /blog/first-post inline, ${INLINE_REASON}`;
      return [failure('llms-lists-inline', text, [LLMS, '/blog/first-post'])];
    },
  },
  {
    name: 'a collection with entries ships no full-text file',
    plant: removeDist('llms/service.txt'),
    expected: () => [failure('llms-file-missing', 'no /llms/service.txt full-text file', ['/llms/service.txt'])],
  },
  {
    name: 'feed.json and the sitemap cover no glossary entry',
    plant: together(dropGlossaryFromFeedJson, dropDist('sitemap-0.xml', `${ORIGIN}/glossary/evals`)),
    expected: () => [
      failure('entry-coverage', 'feed.json covers no glossary entry'),
      failure('entry-coverage', 'sitemap covers no glossary entry'),
      failure('feed-coverage', 'feed.json does not mirror rss.xml item-for-item'),
      failure('sitemap-lastmod-missing', 'sitemap has no lastmod for /glossary/evals', [SITEMAP, '/glossary/evals']),
    ],
  },
  {
    name: 'the sitemap lists a noindex route',
    plant: editDist('sitemap-0.xml', withSearchEntry),
    expected: () => [
      failure('sitemap-lists-noindex-route', 'sitemap lists noindex route /search', [SITEMAP, '/search']),
    ],
  },
  {
    name: 'the sitemap has no lastmod for a page',
    plant: dropDist('sitemap-0.xml', `<loc>${ORIGIN}/security</loc>`),
    expected: () => {
      const { updatedDate } = catalogPage('/security');
      const dated = `JSON-LD dateModified ${instantOf(updatedDate)} (WebPage), sitemap lastmod MISSING`;
      const stated = `${dated}, sidecar Updated ${updatedDate}`;
      return [
        failure('sitemap-lastmod-missing', 'sitemap has no lastmod for /security', [SITEMAP, '/security']),
        failure('date-agreement', `/security has no modified date in its sitemap entry: ${stated}`),
      ];
    },
  },
  {
    name: 'an entry has no markdown sidecar',
    plant: removeDist('blog/second-post.md'),
    expected: () => [
      failure('sidecar-missing', 'no markdown sidecar for /blog/second-post.md', ['/blog/second-post.md']),
    ],
  },
  {
    name: 'a sidecar carries no title',
    plant: editDist('approach.md', withoutTitle),
    expected: () => [failure('sidecar-content', 'sidecar for /approach carries no title')],
  },
  {
    name: 'a page declares another canonical',
    plant: editDist('pricing.html', withOtherCanonical),
    expected: () => [
      failure('canonical-mismatch', `/pricing canonical is ${ORIGIN}/pricing-old, expected ${ORIGIN}/pricing`),
    ],
  },
  {
    name: 'one page disagrees on its date and another carries a broken ld+json block',
    plant: together(editDist('now.md', withStaleDay), editDist('imprint.html', withBrokenLdJson)),
    expected: () => {
      const instant = instantOf(catalogPage('/now').updatedDate);
      const stated = `JSON-LD dateModified ${instant} (WebPage), sitemap lastmod ${instant}`;
      const text = `/now modified dates disagree: ${stated}, sidecar Updated ${STALE_DAY}`;
      return [failure('date-agreement', text), failure('date-agreement', BROKEN_LD_JSON)];
    },
  },
  {
    name: 'a surface lists a collection that has no live entry',
    plant: appendDist('llms.txt', `- [Case studies](${ORIGIN}/case-studies): the case studies\n`),
    expected: () => {
      const text = '/llms.txt lists /case-studies but /case-studies has no live case entry';
      return [failure('empty-collection-surface', text)];
    },
  },
  {
    name: 'a hub does not advertise its own feed',
    plant: dropDist('glossary.html', 'rel="alternate"'),
    expected: () => {
      const text = '/glossary does not advertise its own collection feed <link>';
      return [failure('hub-feed-link-missing', text, ['/glossary'])];
    },
  },
  {
    name: 'a content collection has no FEED_BASES entry',
    plant: declareGhostCollection,
    expected: () => [failure('feed-base-missing', 'ghost has no FEED_BASES entry; skipping its feed coverage check')],
  },
  {
    name: 'a collection feed omits a live route',
    plant: dropDist('blog/rss.xml', `${ORIGIN}/blog/second-post`),
    expected: () => [failure('feed-coverage', '/blog/rss.xml omits /blog/second-post')],
  },
  {
    name: 'a catalog page did not build',
    plant: removeDist('blog/tags.html'),
    expected: () => [failure('catalog-route-missing', NOT_BUILT, ['/blog/tags'])],
  },
  {
    name: 'a page ships another description than the catalog',
    plant: editDist('terms.html', withPlantedDescription),
    expected: () => {
      const drift = `catalog says "${catalogPage('/terms').description}" but the page ships "${PLANTED_DESCRIPTION}"`;
      return [failure('catalog-description-drift', `/terms catalog-description-drift [${drift}]`, ['/terms'])];
    },
  },
  {
    name: 'a machine file carries another X-Robots-Tag than its siblings',
    plant: editDist('_headers', withOtherRobotsTag),
    expected: () => [failure('machine-header', '/feed.json carries X-Robots-Tag "all", its siblings carry noindex')],
  },
  {
    name: 'a machine file is shipped and nothing references it',
    plant: (scene) => writeText(scene.distFile('stray/rss.xml'), '<rss version="2.0"><channel></channel></rss>\n'),
    expected: () => {
      const text = '/stray/rss.xml is shipped but nothing references it';
      return [failure('machine-file-unreferenced', text, ['/stray/rss.xml'])];
    },
  },
  {
    name: 'llms.txt states another entry count than the files hold',
    plant: editDist('llms.txt', withOtherCount),
    expected: () => [failure('llms-corpus', 'llms.txt says 7 entries for glossary, its files hold 1')],
  },
];

export const plantsOf = (variant) => PLANTS.filter((entry) => entry.variant === undefined || entry.variant === variant);

export function plantScene(scene, variant) {
  for (const { plant } of plantsOf(variant)) plant(scene);
}

export const expectedFailures = (scene, variant) => plantsOf(variant).flatMap(({ expected }) => expected(scene));
