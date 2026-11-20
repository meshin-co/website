import { refuse, tableOf } from './repair-rows.mjs';

export const ORPHAN_KINDS = tableOf({
  orphans: refuse(
    'A page that no other page links to needs a sentence on another page that links to it, which is an edit outside the entry and a placement decision for a person.'
  ),
  'chrome-only': refuse(
    'A page reached only from listings, the header, the footer or a breadcrumb needs a sentence on another page that links to it, which is an edit outside the entry and a placement decision for a person.'
  ),
});
