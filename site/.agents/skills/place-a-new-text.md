# Place a New Text Before Writing It

Every new user-facing string belongs somewhere specific. Decide where before writing it, or the
corpus grows a second page competing with one that already exists.

## Does a page already own this topic?

`docs/SEMANTIC-CORE.md` names the target query, intent and citable unit of every route family, and
the concept register names the single page that defines each concept. Check both before adding a
route or a section.

- The topic is already owned → extend that page. Two pages targeting one intent is cannibalisation.
- The concept is already defined → link to the definition. Never redefine it in passing.
- Neither is true → the topic is new, and it needs a route decision, not a paragraph.

## Which family does it join?

The route families are fixed: static page, service, resource, case study, article, glossary term,
FAQ answer, blog category, tag. Each has a title pattern, a meta shape and a body intent in the
semantic core, and `gate:content` gates the new page against its family's profile.

A text that fits no family is a signal the idea is wrong for this site, not that a family is
missing.

## What a new entry drags with it

Adding one collection entry is never one file. `add-collection-entry.md` is the procedure; the
surfaces that follow automatically are the `.md` sidecar, the per-collection feed and the merged
feed, the `/llms/` collection file and `llms-full.txt` body, the search index shard, the JSON-LD graph for
its family, the sitemap entry with `lastmod`, and the OG card.

All of those are build outputs. Verify them in `dist/`, never in source
(`verify-in-the-built-output.md`).

A new route also needs its `content-facts.json` row — target query and any numbers the copy cites —
or `gate:content` fails, and it enters the editorial ledger, which means a disposition
(`disposition-a-text.md`).

## Before you write the words

Read `write-copy.md`. Then write the answer sentence first: if the page cannot answer its own
question in one sentence, the page does not know what it is for yet.
