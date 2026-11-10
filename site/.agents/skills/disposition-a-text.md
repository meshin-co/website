# Disposition a Reviewed Text

A disposition is a file under `audits/phase-4.7/dispositions/`, one JSON array per family, never a
hand edit of `inventory.json` — the ledger is generated. `scripts/dispositions.mjs` applies them
and `npm run assets:seal` stamps each entry with the digest of the text it reviewed.

    [{ "target": "src/data/<collection>/<slug>.md", "status": "rewritten", "reason": "answer now leads" }]

`target` is a source file path or a route. `location` narrows it to one row. `status` is
`rewritten`, `verified`, or `owner-blocked` with a `reason`. The digest covers every row of that
target, so any later change to the text makes the disposition stale and the rows go back to
unreviewed — a disposition certifies the words that were read, not the file name.

A disposition naming a target with no rows is reported rather than ignored, which catches a
renamed or deleted file whose review record was left behind.

A route Astro numbers, `/blog/tag/<slug>/page/<n>` and `/blog/category/<slug>/page/<n>`, needs no disposition for
its title or heading. `scripts/dispositions.mjs` (`inheritPaginatedStatus`) reads them as the reviewed heading of
the first page put through the one wording row, `constant.PAGE_HEADING_FORMAT` in `src/utils/paginate.mjs`, with
the page's own number, and reads a post card's date, reading time, category and tag line as the reviewed names it is
made of. It writes no row and changes no digest, so the seal is the same with or without a second page. Anything
else on a numbered route stays unreviewed and stops the gate: a sentence, a button, a title that is not exactly
that expansion, a card line with a word of its own.

Editing the wording is a text edit like any other. The digest of `src/utils/paginate.mjs` no longer matches, its
disposition goes stale, the wording row returns to unreviewed, and every numbered heading follows it back to
unreviewed. Read the new wording, then run `npm run assets:seal`; no page inherits an approval of words it never
showed.
The format row itself is declared in `audits/phase-4.7/conditional-copy.json`, because no page ships the format, only
its expansions; change that entry together with the wording.

Work the gate's own worklist: `audits/phase-4.7/findings.json` carries the untraceable and dead
rows grouped by the file or route that owns them.
