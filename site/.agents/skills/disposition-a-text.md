# Disposition a Reviewed Text

A disposition is a file under `audits/phase-4.7/dispositions/`, one JSON array per family, never a
hand edit of `inventory.json` — the ledger is generated. `scripts/dispositions.mjs` applies them
and `npm run assets:seal` stamps each entry with the digest of the text it reviewed.

    [{ "target": "src/data/faq/are-models-trained-on-our-customer-data.md", "status": "rewritten", "reason": "answer now leads" }]

`target` is a source file path or a route. `location` narrows it to one row. `status` is
`rewritten`, `verified`, or `owner-blocked` with a `reason`. The digest covers every row of that
target, so any later change to the text makes the disposition stale and the rows go back to
unreviewed — a disposition certifies the words that were read, not the file name.

A disposition naming a target with no rows is reported rather than ignored, which catches a
renamed or deleted file whose review record was left behind.

Work the gate's own worklist: `audits/phase-4.7/findings.json` carries the untraceable and dead
rows grouped by the file or route that owns them.
