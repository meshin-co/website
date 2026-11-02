# Make the engine extractable, and prove a copy of it works

## Why

The owner will start other websites and wants to copy the engine, not rebuild it. Three verbs
follow: extract, adopt, interview. Change 20 made the site-specific values configurable and added
`npm run gate:engine`. Three things still stop a copy.

- Nothing says which tracked file is the engine and which belongs to this site. The adoption skill
  says how to configure an engine that has already been copied.
- No one has copied the engine into an empty repository and run the gates there. Until that happens,
  portable is an opinion.
- The questions only the owner can answer live in finished documents, not in a set of questions.

Measured on 2026-11-02 with the partition this change adds (`node scripts/run-partition-gate.mjs`):
1,618 tracked files, of which 835 are engine, 129 are site, 652 are evidence and 2 fit no rule. The
same run finds 37 engine files that name the brand, the host or the author of this site, and 9
anchor files that the engine expects and that nothing ships, seeds or measures. A copy made today
would carry the name of this site into the next one, and `gate:engine` would fail on arrival.

The run also shows a third kind of drift that no rule names yet: about 57 site or evidence paths are
cited by engine skills, so `gate:skills` would report each as `missing-path` in a new repository.

## What changes

**The partition (delivered).** Every tracked file is engine, site or evidence. The class comes from
an ordered list of rules that read properties a file has: where it lives, whether a script reads it,
whether it names a collection entry, whether a generator writes it, whether the engine ships a seed
for it. No rule reads a list of paths. A file that fits no rule is a finding, never a default. An
engine file that names the brand, the host or the author of the site is a finding. An anchor file
that nothing ships, seeds or measures is a finding.

**The adoption skill (delivered).** `extract-the-engine-from-a-site.md` says how a file gets its
class, what each finding asks of the person who sees it, and what does not transfer: the Cloudflare
account and project, the domain, the Search Console property and its service account, anything
priced per vendor, the budgets measured on this site's pages, every measured record, and the locked
decisions L1 to L67.

**Still to do in this change.** The export command that writes the engine into an empty directory
with its seeds. The proof of adoption: an invented second site, install, build and every gate that
needs no secret. The starter files the engine ships so a fresh site is not dead on arrival. The
interview and its skill. The npm gate and its mutation specimens. The decision where the expensive
export proof runs, recorded beside `localOnlyGates`. `tasks.md` lists each with its state.

## Measured records never travel

The sentence band and the demand report describe one corpus and one property. The engine already
refuses to use another site's band: `bandFor` throws when `audits/sentence-band.json` is absent, and
`gate:autowriter` reports `record-corpus-stale` for a record whose corpus differs from the tree.
This change keeps that behaviour and adds the rule that no record under `audits/` is ever exported.

## Impact

- New: `scripts/engine-partition.mjs`, `scripts/engine-partition-facts.mjs`,
  `scripts/engine-partition-gate.mjs`, `scripts/engine-records.mjs`, `scripts/run-partition-gate.mjs`,
  their tests and two fixtures; the skill `extract-the-engine-from-a-site.md`.
- Changed: `site/scripts/README.md`, the index of scripts.
- No npm script, workflow or mutation specimen yet: the tree still has findings, and a gate that
  starts red is not a gate. Wiring waits for the findings to reach zero.
