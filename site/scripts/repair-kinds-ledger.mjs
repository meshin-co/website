import { refuse, restate, tableOf } from './repair-rows.mjs';

export const EDITORIAL_KINDS = tableOf({
  'unreviewed-copy': restate(
    'A stale disposition leaves the entry rows unreviewed, and restating the disposition for the text just written clears both.',
    'stale-disposition'
  ),
  'untraceable-copy': refuse(
    'Shipped text that traces to no source row may be an inventory fault as easily as an entry fault, so a person decides.'
  ),
  'dead-copy': refuse(
    'Source copy that no page ships may be a ledger fault as easily as an entry fault, so a person decides.'
  ),
  'stale-disposition': restate(
    'The digest of a generated disposition no longer matches the text just written, and restating it is deterministic and never the seal.'
  ),
  'stale-conditional-declaration': refuse(
    'The conditional-copy.json file is owner data, and only the owner can say whether a declaration still holds.'
  ),
  'invalid-conditional-declaration': refuse(
    'A conditional declaration with no reason is owner data that only the owner can complete.'
  ),
  'disposition-target-missing': refuse(
    'A disposition names a file that does not exist, and a repair never renames or restores files.'
  ),
});

export const REGISTER_KINDS = tableOf({
  'registers-drift': refuse(
    'The generated register block differs from docs/SEMANTIC-CORE.md, and regeneration fixes that, not rewording.'
  ),
  'registers-markers-missing': refuse(
    'The markers of the generated block are missing from docs/SEMANTIC-CORE.md, which is a document defect, not a wording fault.'
  ),
});
