import { refuse, rewrite, tableOf } from './repair-rows.mjs';

export const HUMAN_KINDS = tableOf({
  'reading-grade': rewrite(
    'The reading grade of the whole entry is over its cap, so the fix simplifies sentences throughout and may lower the word count.',
    'words-down'
  ),
  'reading-ease': rewrite(
    'The reading ease of the whole entry is under its floor, so the fix simplifies wording throughout and may lower the word count.',
    'words-down'
  ),
  'sentence-average': rewrite(
    'The average sentence is over its cap across the whole entry, so the fix shortens sentences throughout and may lower the word count.',
    'words-down'
  ),
  'sentence-longest': rewrite('One sentence is over the longest allowed, and it is split inside the entry.'),
  'long-sentences': rewrite(
    'More sentences are long than the size-scaled limit allows, so the fix shortens several and may lower the word count.',
    'words-down'
  ),
  'long-word-share': rewrite(
    'Too large a share of the words are long, so the fix swaps in shorter words throughout and may lower the word count.',
    'words-down'
  ),
  'passive-voice': rewrite('Too many sentences are passive, and each is reworded in place.'),
  'sentence-variance': rewrite('The sentences are too even in length, and the entry prose can vary them.'),
  'paragraph-variance': rewrite('The paragraphs are too even in length, and the entry prose can vary them.'),
  'list-variety': rewrite('Several lists hold the same number of items, and the entry lists can change.'),
  'heading-variety': rewrite(
    'Every sub-heading opens on the same word, and renaming headings fixes that without removing one.'
  ),
  'antithesis-template': rewrite('A "not X, it is Y" pattern sits in the entry prose, and rewording removes it.'),
  'bolded-lead': rewrite('A list item opens in bold, and rewriting the item removes it.'),
  'emoji-bullet': rewrite('A list item opens with a symbol, and rewriting the item removes it.'),
  'controlled-word': rewrite(
    'A word that controlled-words.json replaces sits in the entry text, and the preferred word fixes it.'
  ),
  'no-pages': refuse('No built page was found, so there is nothing to rewrite and the finding names no route.'),
  'nothing-measured': refuse('No page had enough prose to grade, which is a whole-site finding, not a wording fault.'),
});
