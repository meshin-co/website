import { refuse, rewrite, sharedRewrite, tableOf } from './repair-rows.mjs';

export const CONTENT_KINDS = tableOf({
  'h1-count': rewrite(
    'The template draws the one h1 from a frontmatter field, so a second comes only from heading syntax in the entry body.'
  ),
  'h1-query': rewrite(
    'The h1 is the post title or the glossary term, both frontmatter, and a rewrite can put every word of the target query into it.'
  ),
  'query-opening': rewrite('The opening words are the lead and the first paragraphs, which are entry text.'),
  'paragraph-words': rewrite('A paragraph over its word cap is split inside the entry.'),
  'sentence-length': rewrite('A sentence over its word cap is split or shortened inside the entry.'),
  'median-sentence': rewrite(
    'The median sentence is over its cap across the whole entry, so the fix shortens sentences throughout and may lower the word count.',
    'words-down'
  ),
  'banned-phrase': rewrite('A phrase from banned-phrases.json sits in the entry text, and rewording removes it.'),
  'unsourced-number': rewrite(
    'A number outside the facts.numbers allowlist sits in the entry, and the sentence is reworded around it, not dropped.'
  ),
  takeaways: rewrite(
    'The key takeaways are frontmatter and must stay within their count, so the fix may add one or drop one.',
    'takeaways'
  ),
  'table-or-figure': rewrite('The page needs a table or a figure, and the entry body can hold a table.'),
  'inbound-links': refuse('The count includes the header and footer links, so only the layout can break it.'),
  'outbound-links': refuse(
    'The external links are the entry sources, and only a new real source raises the count, which a rewrite must not invent.'
  ),
  'question-headings': rewrite(
    'The page needs sub-headings that end in a question mark, and renaming or adding entry headings supplies them.'
  ),
  'updated-date': refuse(
    'The rendered date comes from the updatedDate field through the template, not from the entry words.'
  ),
  'formulaic-transition': rewrite('A formulaic transition sits in the entry prose, and rewording removes it.'),
  'not-only-but-also': rewrite('The not-only-but-also pattern sits in the entry prose, and rewording removes it.'),
  'guide-preamble': rewrite(
    'A guide preamble such as "this article will" sits in the entry prose, and rewording removes it.'
  ),
  'hollow-credential': rewrite('A hollow credential phrase sits in the entry prose, and rewording removes it.'),
  'semicolon-density': rewrite(
    'Semicolons are denser than the cap in the entry prose, and recasting some as sentences lowers the density.'
  ),
  'em-dash-density': rewrite(
    'Em dashes are denser than the cap in the entry prose, and recasting some as sentences lowers the density.'
  ),
  'rhetorical-question-run': rewrite(
    'Question sentences run back to back in the entry prose, and turning one into a statement ends the run.'
  ),
  'duplicate-sentence': sharedRewrite(
    'The entry shares a long sentence with another route, and the entry is the side a repair can edit, so the finding is repairable when the entry is among its subjects.'
  ),
  'query-without-route': refuse(
    'The target query rows in content-facts.json are pipeline data, and a row with no built route is not a wording fault.'
  ),
  'route-without-query': refuse(
    'A built route with no content-facts.json row is a missing pipeline row, not a wording fault.'
  ),
  'duplicate-query': refuse(
    'Two routes that claim one target query are a conflict in content-facts.json, which a repair does not write.'
  ),
  'title-missing': refuse('The title element comes from the page layout, not from the entry words.'),
  'title-suffix': refuse('The title suffix comes from the layout title template, not from the entry words.'),
  'title-stem': rewrite(
    'A glossary page title is the entry title field and must read as a What question, which a rewrite can fix.'
  ),
  'doc-drift': refuse(
    'The generated table in docs/SEMANTIC-CORE.md differs from the build, and regeneration fixes that, not rewording.'
  ),
  'doc-drift-structure': refuse(
    'The generated headings or grammar lines differ from docs/SEMANTIC-CORE.md, and regeneration fixes that, not rewording.'
  ),
  'buyer-prompt-must-win-missing': refuse(
    'The route a buyer prompt must win is not built, which is a missing page, not a wording fault.'
  ),
  'buyer-prompt-passage-missing': refuse(
    'A passage quoted in an owner-curated document is gone from the page and nothing says which side is stale, so a person decides.'
  ),
  'published-against-a-decision': rewrite(
    'A term the owner decided not to publish sits in the entry text, and rewording removes it.'
  ),
  'booking-cta-missing': refuse(
    'The booking link is drawn by the template, so a page without one is a template defect.'
  ),
});
