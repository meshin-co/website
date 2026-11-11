# License the resources and stop promising repositories

## Why

Four things were wrong around the seven `/resources/*` pages. Each was read off the tree or the live site, not
assumed.

**The licence file named someone else.** `site/LICENSE.md` read `MIT License` and `Copyright (c) 2023 onWidget`,
the grant of the Astro theme the site started from, in the theme author's name. Apart from the font notice in
`site/src/assets/fonts/LICENSE.md`, it was the only licence file the repository tracked.

**The licence check passed on absence.** `licenseHasText` in `site/src/utils/resource-license.mjs` returned true
whenever `entry.license` was `undefined`. None of the 7 entries in `site/src/data/resource/` declared a `license`,
and `site/public/licenses/`, the folder the check reads for the text, did not exist. The content gate rule that
copy never labels an artefact with a licence no file states, in `openspec/specs/content/content-gate/spec.md`,
passed on all 7 entries because none declared a licence, not because a file backed one.

**`/terms` granted less than the decision.** Its Content section read "The writing on this site is mine and you
may quote it with a link", which lets nobody copy, share or adapt a page. L75 sets the text of a resource at CC BY
4.0 and the code at MIT, and names that section as one of three defects to fix before the first repository exists.
The Engagements section is not in L75. It read "You own the deliverables and the code produced for you" and carried
no exception for what the practice made before an engagement, such as the templates the resources are made of.

**The pages promised a copy that for some of them will not exist.** The `status` of all 7 entries read "Available
as a page on this site. A repository copy is not published yet."
`docs/plan/reference/resource-publication-sequence.md` orders the repositories under L70 and says
`build-vs-buy-ai-kit` is "Not published" and `ai-readiness-scorecard` is "Reviewed, not promised". On 2026-11-11 the
7 addresses `https://github.com/meshin-co/<slug>` answered 404, and the organisation listed 1 public repository,
`website`.

The work was opened on a premise that was wrong: that each page links one of those addresses. None has linked one
since commit `ce6ee10` of 2026-10-02 removed `repoUrl` from the 5 entries that carried one. The other 2,
`handover-playbook` and `adoption-telemetry-dashboard-template`, were added on 2026-10-03 without one. On the build
of 2026-11-11, `grep -rl 'github.com/meshin-co/' site/dist` lists 0 files. The one address of the organisation in
the build is its page, `https://github.com/meshin-co`, in the Organization node's `sameAs` on 119 of 122 HTML files,
and it answers 200. What was dead was the sentence, and the clause of L10 that says the pages link to the addresses
stopped describing the build on 2026-10-02.

## What changes

Every resource entry declares `license`, and the build refuses one that does not. The 7 entries declare
`CC-BY-4.0`, and its text, the whole legal code at 18,657 bytes, ships at `site/public/licenses/CC-BY-4.0.txt` and is
served at `/licenses/CC-BY-4.0.txt`. `licenseHasText` returns false for an entry with no `license`, and the schema in
`site/src/content.config.ts` requires the field, so an entry that omits it fails `npm run build` naming
`license: Required`. A licence that no file backs still fails, naming `license: needs its text`. On the build of
2026-11-11 each of the 7 cards on `/resources` ends `· CC-BY-4.0` and each resource page carries
`"license":"CC-BY-4.0"` in its JSON-LD. The seeds of the engine export carry a `license` on their resource entry and
the text of the licence, because the schema now requires one.

The site grants what L75 says. The Content section of `/terms` grants the writing under CC BY 4.0, states the credit
the licence asks for and names the text at `/licenses/CC-BY-4.0.txt`. `site/LICENSE.md` states two licences: the code
is MIT, in the name of the site's author and with the notice of the theme it came from kept above the permission
text, and the writing is CC BY 4.0. Its seed for a copy of the engine leaves the holder to the owner of the copy.

The Engagements section of `/terms` now says only the working method travels between engagements and points at the
FAQ for where that line falls. Two earlier drafts were refused. One reserved background material including
templates, which contradicts the published answer that everything written for the client's business belongs to
them; the next copied that answer verbatim onto the page and `gate:content` refused it as a duplicate sentence
under L53. The page now carries the pointer and the FAQ keeps the definition, so the only thing still resting on
no owner answer is the FAQ's own wording (G91).

The pages promise no repository. The `status` of each of the 7 entries reads "Available as a page on this site.
There is no repository copy.", and none sets `repoUrl`. The field stays optional: the page draws the "Open the
repository" button and the JSON-LD names a `codeRepository` only when it is set, so one frontmatter line and a new
`status` bring a repository back.

L10 is not edited. Row L76 of `docs/plan/reference/locked-decisions.md` amends it, as L69 amended L61.

One requirement of the main specs changes, `Resource entries name a known type and what is inside` in
`content/collection-schemas`. `A claim about an artefact resolves` in `content/content-gate` stays true as written:
an entry still carries a licence only when a text exists for it. No capability governs `site/LICENSE.md` or `/terms`,
so the delta holds nothing about them: the guard of the first is named by task 5.3, and the second has none (G90).

## What does not change

No repository is created. That is a separate job, in the order of L70. `gate:links` still reads the outbound
addresses of the build and never fetches one (G38), and `THIRD_PARTY_HOSTS` in `site/scripts/links-gate.mjs` still
lists the prefix `github.com/meshin-co`, which now skips only the organisation page. Rows 6.3 and 16.8 of
`docs/COPY-CHECKLIST.md` still say MIT where L75 says CC BY 4.0 for text, because the owner answered them and decides
whether that changes: G88.

## The limits

A 404 from `github.com` is also what an anonymous client gets for a private repository, so the 7 answers and the one
public repository show that no public copy exists, never that no private one does. The guards prove that a licence is
declared and that its text ships. None proves that the licence suits an artefact, and nothing checks the `status` of
an entry against its `repoUrl`, or that a `repoUrl` answers: G87. The structured data names the licence by its bare
id, and schema.org types that property as a URL or a CreativeWork: G89. Nothing reads what `/terms` grants: G90. The
boundary on ownership rests on no answer of the owner: G91. `site/public/licenses/` holds no MIT text
because no entry declares MIT. The first that does must add it, and the build says so.

## Why this change is parked

`openspec/changes/44-retry-a-stopped-write` is in flight and its last task cannot be ticked before 2026-11-21. A
change with ticked boxes cannot be parked, so this one is, and the code it describes ships ahead of its own spec
delta, as it does for `45-order-a-topic-by-hand` and `46-write-from-measured-keyword-demand`, which wait behind 44
too. Every box of `tasks.md` is unticked for the same reason, though the work is in the tree. Row G86 of
`docs/plan/reference/known-gaps.md` records the window and what reads wrong inside it, and `blocked.md` says where
this change sits in the queue.
