# Publish the evals-baseline specification

## Why

The site had nowhere to publish a definition. L70 settles which artefact is built first and
`docs/plan/reference/resource-publication-sequence.md` names it `evals-baseline`, a check that reads two
evaluation tools' run files and refuses a regression against a committed baseline. The research behind L77
found that every artefact in the studied corpus that became a reference is cited at a versioned path of its
own project, and none at a repository address. So the artefact needs an address on this site that holds its
version, and the nine route families this site had held no place for one.

**A definition is not a page about a thing.** The existing `/resources/*` family describes an artefact and
links to it. A specification is the artefact: a second implementation in another language reads it to decide
whether its own output is right. The two have different obligations, and L53 froze the families, so L77
amends L53 for one new family and no more.

**The version has to be in the address.** `keepachangelog.com` shipped 2.0.0 in 2026 without invalidating nine
years of citations, because each version has its own page. The counter-signal is in the same corpus: after
2.0.0 shipped the site still defaulted to 1.1.0 and its issue 745 records that 2.0.0 was not discoverable. So
each version gets one page and the artefact gets one unversioned page that lists them and holds no normative
text.

**The specification was written before the implementation and is already settled.**
`docs/plan/reference/evals-baseline-spec.md` holds the design, with section 12 recording the four answers the
owner settled on 2026-11-11: the address, the binding case digest shipping as a warning only, the npm account,
and the two names the artefact carries. The published page is the normative half of that document, as section
8.1 lists it, and nothing else.

## What changes

A content collection `spec` with a zod schema, keyed by `name` and `version`, so a later version publishes
beside the first instead of replacing it. Two routes: the version page at `/spec/<name>/<major>.<minor>` and
the series page at `/spec/<name>`. The family carries every per-route obligation the others carry: the
markdown sidecar, the sitemap entry, the search document, the social card, the JSON-LD graph, and a place in
the machine files as a seventh public collection.

The dotted version segment is new to this site and three places read it as a file extension. The gate server
answered 404, the link gate skipped the `.html` rewrite, and the edge worker skipped Accept-negotiation for the
sidecar. Each is fixed with a test.

The cited address carries no trailing slash, against the form section 12 settled on 2026-11-11, because the
site is built with `trailingSlash: 'never'` and the slash form answers with a 308. A citation that redirects is
one step from being rewritten by whoever quotes it. L77 and the design document record the correction.

## What this does not do

It does not publish the repository, the package or the Action, and it names no GitHub or npm address. L76
binds: a page promises no artefact it does not have. The reference implementation is built and green on disk
and waits for the owner's approval to be published.

It does not close the two gaps the family opens. G92: the page defines conformance against vectors that live
in the unpublished repository, so a reader can read the definition and cannot test against it. G93: the page
and the implementation live in two repositories and no check relates them, so a clause reworded here and an
implementation left alone drift apart silently.
