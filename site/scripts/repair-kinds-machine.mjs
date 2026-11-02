import { refuse, tableOf } from './repair-rows.mjs';

export const MACHINE_KINDS = tableOf({
  'humans-components-missing': refuse(
    'The humans.txt file is a build output, and a missing Components line is a generator fault, not entry text.'
  ),
  'humans-component-absent': refuse(
    'The humans.txt file names a component the project does not depend on, which is generator drift, not entry text.'
  ),
  'llms-lists-noindex-page': refuse(
    'The llms.txt file lists a page that is marked noindex, which is a generator rule fault, not entry text.'
  ),
  'llms-size': refuse(
    'The byte guard on llms.txt and llms-full.txt is a site-wide budget, and changing it is a decision for the owner.'
  ),
  'llms-omits-route': refuse(
    'An llms file that omits an indexable route is a generator fault, because the files are built from the route list.'
  ),
  'llms-lists-inline': refuse('Which collections llms.txt lists inline is a generator rule, not entry text.'),
  'llms-file-missing': refuse(
    'A missing per-collection llms file is a generator fault, because the build writes one per collection.'
  ),
  'entry-coverage': refuse(
    'A feed or sitemap that covers no entry of a collection is a generator fault, not entry text.'
  ),
  'sitemap-lists-noindex-route': refuse(
    'The sitemap lists a route that is marked noindex, which is a generator rule fault, not entry text.'
  ),
  'sitemap-lastmod-missing': refuse(
    'A sitemap entry without a lastmod is a generator fault, because the date comes from the build helper.'
  ),
  'sidecar-missing': refuse('A missing markdown sidecar is a generator fault, because the build writes one per page.'),
  'sidecar-content': refuse(
    'A wrong title, canonical, date or body in a sidecar is a generator fault, because the sidecar is built from the page.'
  ),
  'canonical-mismatch': refuse('The canonical URL and og:url come from the layout and the route, not from entry text.'),
  'date-agreement': refuse(
    'The JSON-LD, sitemap and sidecar dates come from one helper, so a disagreement is a generator fault.'
  ),
  'empty-collection-surface': refuse(
    'A collection with no entries that still serves surfaces is a site structure fault, not entry text.'
  ),
  'hub-feed-link-missing': refuse('A hub that does not advertise its feed is a template fault, not entry text.'),
  'feed-base-missing': refuse('A collection with no FEED_BASES entry is a configuration fault, not entry text.'),
  'feed-coverage': refuse(
    'A feed that omits a live route, or a feed.json that does not mirror rss.xml, is a generator fault.'
  ),
  'catalog-route-missing': refuse('A catalog page that did not build is a site structure fault, not entry text.'),
  'catalog-description-drift': refuse(
    'A catalog description that differs from the built page is a generator fault, not entry text.'
  ),
  'machine-header': refuse('The X-Robots-Tag rule for machine files is header configuration, not entry text.'),
  'machine-file-unreferenced': refuse(
    'A shipped machine file that nothing references is a site structure fault, not entry text.'
  ),
  'llms-corpus': refuse('The llms shards and their index disagree, which is a generator fault, not entry text.'),
});
