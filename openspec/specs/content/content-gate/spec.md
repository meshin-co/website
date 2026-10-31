# content/content-gate Specification

## Purpose

The content gate governs the mechanical rules each gated page must clear in its built HTML, from its one h1 and target query to sentence caps, sourced numbers, profile structure and title alignment. `npm run gate:content` runs `site/scripts/content-gate.mjs` from the site directory against `dist`, prints `content: N pages gated`, a count per rule and one line per finding, and exits 1 while any finding remains.

## Requirements

### Requirement: The content gate judges every built page except the utility and pagination routes

`npm run gate:content` SHALL gate every route that `site/scripts/content-gate.mjs` finds in `dist`, except /404, /search, /styleguide and the numbered /blog, category and tag pagination pages. It MUST read only the main content, after cutting header, footer, nav, script, style and data-gate-ignore blocks, and print each finding as `<route> <rule> [<detail>] <excerpt>`. `site/scripts/content-gate.test.mjs` pins the skipped routes.

#### Scenario: A finding on a gated page fails the run

- **WHEN** a built post's main content says "We leverage AI."
- **THEN** `npm run gate:content` prints a line holding `banned-phrase [leverage]` and exits 1

#### Scenario: Ungated routes and cut blocks are not judged

- **WHEN** that sentence appears only on /404, /search, /styleguide or /blog/page/2, or only inside a header, footer, nav or data-gate-ignore block
- **THEN** `npm run gate:content` raises no `banned-phrase` finding for it

### Requirement: Each gated page is judged against the profile its route selects

`site/scripts/content-gate.mjs` SHALL pick a profile from the route: posts under /blog/ are article; pages under /services/, /resources/ and /case-studies/ are offer; /glossary/ entries are term; /faq/ entries are faq-answer. Every other route MUST be page, including the /blog/tags, /blog/tag/ and /blog/category/ archives and the /blog, /glossary and /faq hubs. `site/scripts/content-gate.test.mjs` pins the mapping.

#### Scenario: An offer page with no table

- **WHEN** /services/90-day-production-sprint is built with no table, figure or svg in its main content
- **THEN** `npm run gate:content` prints `/services/90-day-production-sprint table-or-figure [no table and no figure]` and exits 1
- **AND** /pricing, a page-profile route, raises no `table-or-figure` finding without a table

### Requirement: Every gated page has exactly one h1

`npm run gate:content` SHALL refuse a gated page whose main content holds no h1 or more than one (`h1-count`), whatever its profile. The rule lives in `site/scripts/content-rows.mjs`, and `site/scripts/content-rows.test.mjs` pins it.

#### Scenario: Two h1 elements

- **WHEN** /blog/ai-register renders two h1 elements, "One" and "Two"
- **THEN** `npm run gate:content` prints `/blog/ai-register h1-count [2 h1 elements] One | Two` and exits 1

### Requirement: A page's target query appears in its h1 and in its opening hundred words

For a page with one h1 and a row in `site/content-facts.json`, `npm run gate:content` SHALL refuse an h1 missing any word of the target query (`h1-query`), and otherwise an opening missing any of them (`query-opening`). The opening MUST be the first 100 words of the lead and ordinary paragraphs, with the h1 in front on a faq-answer page. Words match as case-insensitive substrings. `site/scripts/content-rows.test.mjs` pins both rules.

#### Scenario: The query is missing from the h1

- **WHEN** the target query for /blog/ai-register is "AI register" and its h1 reads "Everything about governance"
- **THEN** `npm run gate:content` prints `/blog/ai-register h1-query [missing "AI register"] Everything about governance` and exits 1

#### Scenario: The query is buried past the opening

- **WHEN** the h1 holds "AI register" but the first 100 words of the page's paragraphs do not
- **THEN** it prints a line starting `/blog/ai-register query-opening [missing "AI register" in the first 100 words]` and exits 1

### Requirement: Every gated route has a target query, and no two routes share one

`npm run gate:content` SHALL refuse a gated route with no row in `site/content-facts.json` (`route-without-query`), a row whose route was never built (`query-without-route`), and each route of a group whose queries match after trimming, lower-casing and collapsing spaces (`duplicate-query`). `site/scripts/semantic-core.mjs` runs these checks, and `site/scripts/semantic-core.test.mjs` pins them.

#### Scenario: A new page with no target query

- **WHEN** a new gated page /pricing-faq is built and `site/content-facts.json` has no row for it
- **THEN** `npm run gate:content` prints `/pricing-faq route-without-query [no content-facts row]` and exits 1

#### Scenario: Two routes claim one query

- **WHEN** /a and /b both declare "AI Register" as their target query
- **THEN** it prints `/a duplicate-query ["ai register" is also claimed by /b]` and the matching line for /b, and exits 1

### Requirement: Paragraphs stay within 75 words and their sentences within 40

`npm run gate:content` SHALL refuse an ordinary paragraph longer than 75 words (`paragraph-words`) and, in a paragraph within that cap, a sentence longer than 40 words (`sentence-length`). Paragraphs marked data-gate-lead MUST NOT be held to either cap. A sentence ends at a full stop, exclamation mark or question mark, but not after a listed abbreviation, inside a decimal or after a single initial. `site/scripts/prose-rules.test.mjs` pins 40 words passing and 41 refused.

#### Scenario: A paragraph of 76 words

- **WHEN** a gated page has a paragraph of 76 words
- **THEN** `npm run gate:content` prints a line starting `/about paragraph-words [76 words]` followed by the first 80 characters of the paragraph, and exits 1

#### Scenario: A 41-word sentence in a short paragraph

- **WHEN** a paragraph of 75 words or fewer holds a sentence of 41 words
- **THEN** it prints a line starting `/about sentence-length [41 words]` and exits 1

### Requirement: The median sentence on a page is 22 words or fewer

`npm run gate:content` SHALL refuse a page whose median sentence length, across its first data-gate-lead paragraph and its ordinary paragraphs, is above 22 words (`median-sentence`, quoting the longest sentence). For an even count the median is the rounded mean of the middle two. The cap lives in `site/scripts/content-rows.mjs`, and `site/scripts/prose-rules.test.mjs` pins how the median is taken.

#### Scenario: A page of 23-word sentences

- **WHEN** every sentence in a gated page's paragraphs has 23 words
- **THEN** `npm run gate:content` prints a line starting `/about median-sentence [median 23 words]` and exits 1

### Requirement: No page uses a banned phrase

`npm run gate:content` SHALL refuse any phrase from `site/banned-phrases.json` in a gated page's main text, matched without regard to case and only between non-letters, so "unlockable" does not match "unlock" (`banned-phrase`, with the phrase as the detail). `npm run test:smoke` builds a post carrying "leverage" and needs the gate to print `banned-phrase [leverage]`.

#### Scenario: A post that says leverage

- **WHEN** a built post's main text says "We leverage AI."
- **THEN** `npm run gate:content` prints a line holding `banned-phrase [leverage]` and the text around the phrase, and exits 1

### Requirement: Every number in a paragraph is on the allowlist or exempt

`npm run gate:content` SHALL refuse a number in an ordinary paragraph that is not listed under numbers in `site/content-facts.json` (`unsourced-number`); a percent sign stays part of the value. Exempt: years 1900 to 2099, a number at most 24 characters after ISO, IEC, NIST, SP, OWASP, EU, Article, Annex or Regulation with no full stop between, and a number beside a month name. Only p elements not marked data-gate-lead MUST be scanned. `site/scripts/content-rows.test.mjs` pins the exemptions.

#### Scenario: An unlisted count

- **WHEN** a paragraph says "We run 47 systems." and 47 is not on the list
- **THEN** `npm run gate:content` prints `/blog/ai-register unsourced-number [47] We run 47 systems.` and exits 1

#### Scenario: Years, standard numbers and dates pass

- **WHEN** a paragraph says "ISO/IEC 42001 was published in 2023, and Article 14 covers oversight. Updated 8 September 2026."
- **THEN** the gate raises no `unsourced-number` finding for it

### Requirement: Article pages carry takeaways, a table or figure, and a rendered updated date

On an article page, `npm run gate:content` SHALL refuse fewer than 3 or more than 5 list items in the data-takeaways block (`takeaways`), a main content with no table, figure or svg (`table-or-figure`), and a main element with no time element carrying a datetime, data-gate-ignore blocks included (`updated-date`). An offer page MUST also carry a table, figure or svg. `site/scripts/content-rows.test.mjs` pins these rows.

#### Scenario: Two takeaways

- **WHEN** an article's data-takeaways block lists 2 items
- **THEN** `npm run gate:content` prints `/blog/ai-register takeaways [2 takeaways]` and exits 1

#### Scenario: No rendered date

- **WHEN** an article's main element holds no time element with a datetime
- **THEN** it prints `/blog/ai-register updated-date [no rendered updated date]` and exits 1

### Requirement: Article pages ask at least three questions in their sub-headings

On an article page, `npm run gate:content` SHALL refuse fewer than 3 h2, h3 or h4 headings that end in a question mark (`question-headings`). The rule counts question headings and MUST NOT be read as a share of all headings. `site/scripts/content-rows.test.mjs` pins it.

#### Scenario: Two question headings

- **WHEN** an article's sub-headings are "Background", "What now?", "Sources" and "Why?"
- **THEN** `npm run gate:content` prints `/blog/ai-register question-headings [2 of 4 ask a question] Background | What now? | Sources | Why?` and exits 1

### Requirement: Each profile sets a floor of distinct internal and external links

`npm run gate:content` SHALL refuse a page with fewer distinct internal links than its profile needs (`inbound-links`): article 2, offer 2, page 1, term 1, faq-answer 0. Despite its name, that rule counts links on the page itself, header, nav and footer included. It SHALL refuse fewer distinct http or https links in the main content than needed (`outbound-links`): article 3, offer 1, term 1, page and faq-answer 0. `site/scripts/content-rows.mjs` sets the floors.

#### Scenario: An article with two outbound links

- **WHEN** an article's main content links to only 2 distinct external URLs
- **THEN** `npm run gate:content` prints `/blog/ai-register outbound-links [2 external links]` and exits 1

### Requirement: No sentence of twelve or more words appears on two gated routes

`npm run gate:content` SHALL report each sentence of 12 or more words that appears, ignoring case, on two or more gated routes (`duplicate-sentence`), once per sentence and naming every route. Only p elements MUST be compared: the first one marked data-gate-lead and every unmarked one, so a heading, a list item with no p inside, or a data-gate-ignore block never matches. `site/scripts/content-gate.test.mjs` pins it.

#### Scenario: One sentence on two routes

- **WHEN** /pricing and /about both say "An AI register is the list of every AI system your company runs today."
- **THEN** `npm run gate:content` prints `/pricing + /about duplicate-sentence [2 routes] an ai register is the list of every ai system your company runs today.` and exits 1

### Requirement: Prose carries no formulaic machine patterns

In a page's first lead paragraph and ordinary paragraphs, `npm run gate:content` SHALL refuse the transitions moreover, furthermore, additionally, in conclusion, in summary and as such (`formulaic-transition`), "not only" followed by "but also" within 80 characters (`not-only-but-also`), a preamble such as "this guide will" (`guide-preamble`), and hollow credentials such as "industry-leading" or "passionate about" (`hollow-credential`). `site/scripts/prose-rules.test.mjs` pins each.

#### Scenario: A formulaic transition

- **WHEN** a gated page's paragraph opens "Moreover, the register matters."
- **THEN** `npm run gate:content` prints `/about formulaic-transition [machine pattern] Moreover` and exits 1

### Requirement: Semicolons and em dashes stay at six per thousand words or fewer

`npm run gate:content` SHALL refuse a page whose first lead paragraph and ordinary paragraphs hold 3 or more semicolons at more than 6 per 1,000 words (`semicolon-density`), and the same for em dashes (`em-dash-density`). `site/scripts/prose-rules.test.mjs` pins both rules.

#### Scenario: Three semicolons in 400 words

- **WHEN** a gated page's paragraphs hold 3 semicolons in 400 words
- **THEN** `npm run gate:content` prints `/about semicolon-density [7.5 per 1000, cap 6] 3 in 400 words` and exits 1
- **AND** the same 3 semicolons in 500 words pass, at exactly 6.0 per 1,000

### Requirement: A page never asks two questions in a row

`npm run gate:content` SHALL refuse a page whose first lead paragraph and ordinary paragraphs hold two or more consecutive sentences ending in a question mark (`rhetorical-question-run`, cap 1). `site/scripts/prose-rules.test.mjs` pins the count.

#### Scenario: Two questions back to back

- **WHEN** a paragraph says "Who owns it? Who signs it off? Nobody knows."
- **THEN** `npm run gate:content` prints `/about rhetorical-question-run [cap 1] 2 consecutive questions` and exits 1

### Requirement: Every gated page title ends in the brand suffix and fits its family pattern

`npm run gate:content` SHALL refuse a gated page with no title element (`title-missing`) or a title that does not end in a spaced em dash and the site name from `site/src/config.yaml` (`title-suffix`). Before that suffix, a glossary term title MUST be a question that opens with "What", and an FAQ answer title MUST end in "?" or "…" (`title-stem`). `npm run test:smoke` proves the suffix check can fail, and `site/scripts/semantic-core.test.mjs` pins all three.

#### Scenario: A glossary title that is not a question

- **WHEN** /glossary/evals is titled "Evals" followed by the suffix
- **THEN** `npm run gate:content` prints `/glossary/evals title-stem [stem "Evals" breaks the term pattern]` and exits 1

#### Scenario: A title with no suffix

- **WHEN** /blog is titled "Writing" with no suffix
- **THEN** it prints a `/blog title-suffix` line that names the expected suffix, and exits 1

### Requirement: The generated semantic-core tables match the build

`npm run gate:content` SHALL refuse each route whose row in the generated block of `docs/SEMANTIC-CORE.md` differs from a fresh render of the build or exists on one side only (`doc-drift`), and any other changed line in that block, such as a family heading (`doc-drift-structure`). It MUST stop with an error when a block marker is missing. Run from the site directory, `site/scripts/semantic-core.mjs` rewrites the block; `site/scripts/semantic-core.test.mjs` pins the drift rules.

#### Scenario: A hand-edited cell in the generated block

- **WHEN** someone edits the title cell of /about inside the generated block of `docs/SEMANTIC-CORE.md`
- **THEN** `npm run gate:content` prints `/about doc-drift [generated table differs from docs/SEMANTIC-CORE.md]` and exits 1

### Requirement: Every buyer prompt's must-win route is built and its quoted passage is still on the page

`npm run gate:content` SHALL read the buyer prompts in `docs/SEMANTIC-CORE.md` and refuse a must-win route that was not built (`buyer-prompt-must-win-missing`) and a quoted passage that is no longer a literal substring of its route's main text (`buyer-prompt-passage-missing`). Passages MUST be checked on every built route, gated or not. `site/scripts/semantic-core.test.mjs` pins both rules.

#### Scenario: An edit removes a quoted passage

- **WHEN** /blog/ai-acceptable-use-policy-for-a-50-person-company is rewritten so the passage that `docs/SEMANTIC-CORE.md` quotes for prompt 7 no longer appears in its main text
- **THEN** `npm run gate:content` prints a line starting `/blog/ai-acceptable-use-policy-for-a-50-person-company buyer-prompt-passage-missing [prompt 7 passage no longer found on the page]` followed by the start of the passage, and exits 1

### Requirement: No built page publishes a term a locked decision keeps off the site

`npm run gate:content` SHALL refuse any built page, gated or not, whose main text holds a term from the absence list in `site/scripts/semantic-core.mjs` (`published-against-a-decision`). The finding MUST name the decision row and point to `docs/plan/reference/locked-decisions.md`. `site/scripts/semantic-core.test.mjs` pins it.

#### Scenario: A page publishes an excluded term

- **WHEN** any built page's main text contains a term on the absence list
- **THEN** `npm run gate:content` prints a `published-against-a-decision` line naming the first route that holds the term, and the term itself, and exits 1

### Requirement: Every indexable route offers the next step

A built route a visitor can land on from search SHALL carry a booking call to action inside its
`<main>`, not only in the header or footer. The gate SHALL fail naming every indexable route without
one. Utility routes that are `noindex` by design are exempt.

#### Scenario: A glossary term is the landing page

- **WHEN** an answer engine sends a visitor to a glossary term
- **THEN** the page body offers the fit call, because the header button is not a call to action a
  reader arrives at

#### Scenario: A template stops rendering the band

- **WHEN** a template's closing booking band is removed
- **THEN** `npm run gate:content` fails naming the routes that lost it

### Requirement: A claim about an artefact resolves

Copy SHALL NOT describe a deliverable the page does not hold, and SHALL NOT label an artefact with a
licence no file states. A resource entry SHALL carry a `license` only when a licence text exists for
it.

#### Scenario: A licence is asserted with nothing behind it

- **WHEN** a resource entry declares `license: MIT` while no licence text ships
- **THEN** the build fails, because an unbacked licence is the most expensive claim a practice
  selling trust can make
