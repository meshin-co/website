# History rewrite, 2026-09-15

Every commit hash changed on this date. Two rewrites ran with `git filter-repo`: the first
dropped 272 MB of raw Lighthouse runs from `audits/*/lh-mobile/`, `lh-desktop/` and
`baseline/`, the second dropped 579 MB of superseded Playwright baselines from
`site/tests/__screenshots__`. The repository went from 761 MB to 113 MB.

A hash cited anywhere before this date will not resolve. This table translates them. Commit
messages written before the rewrite still quote pre-rewrite hashes; they are immutable, so
read them against this table.

Matched 84 of 91 commits by subject; the other 7 were pruned, and are listed at the end.

Two hashes are unchanged, `0361a40` and `b329cb9`: they precede the first commit that touched a
removed path, and `git filter-repo` only rewrites from that point forward. Every hash below them
moved.

| Before    | After     | Commit                                                                                        |
| --------- | --------- | --------------------------------------------------------------------------------------------- |
| `0361a40` | `0361a40` | docs: PRD, master plan, reference stack, phased build plan                                    |
| `b329cb9` | `b329cb9` | chore: treat mhtml docs as binary                                                             |
| `906c153` | `9fd5605` | chore(phase-0): scaffold AstroWind in site/, project rules, decision log, baseline audit      |
| `2e0228d` | `a8a41e9` | feat(phase-1): strip template, design tokens, strict CSP, derived-route gate                  |
| `ee58ca9` | `83beaac` | fix(phase-1): one env-driven lighthouse config, per-form-factor reports, gate guard           |
| `72b943d` | `096dfeb` | fix(phase-1): run only *.test.mjs under the node test runner                                  |
| `edf940c` | `ce62f40` | fix(phase-1): platform-scoped visual baselines                                                |
| `a5d4122` | `967ac76` | feat(phase-2): hero pipeline motif, centred heads, grouped CTA, computed copyright            |
| `5af457e` | `ba20aee` | feat(phase-2): two-axis hero grid, centred heads, grouped CTA, computed copyright             |
| `0350185` | `c65ea2e` | feat(phase-2): article and case components, valid FAQ markup, named landmarks                 |
| `f3a53c5` | `f9c27d7` | feat(phase-3): content model, all page templates, machine interfaces, own search              |
| `f9e71b9` | `716b187` | fix(phase-3): single-column card grid, one JSON-LD document builder                           |
| `ab31570` | `42d9090` | ci: run the machine-interface and JSON-LD gates                                               |
| `2ad3bf9` | `19d85c1` | ci: name the phase for lighthouse artifacts                                                   |
| `de2a4f9` | `6319ec3` | feat(phase-4): content gate, judged copy, editorial hero, private pricing                     |
| `67fc2d2` | `f3c634f` | fix(phase-4): styleguide service table uses feeShape, drop unused order                       |
| `5747b07` | `48779eb` | fix(phase-4): drop unused map params left by index-prop removal                               |
| `c07d225` | `18d293c` | style: format content-facts.json                                                              |
| `265eea8` | `6661607` | fix(phase-4): case study title inside the 70-character limit                                  |
| `2a877a2` | `590e839` | perf(gate): lighthouse audits one heaviest leaf per template family                           |
| `ab2d2f5` | `bf54602` | chore: rename .perfect-coder to .omp-perfect-coder to match the plugin's config path          |
| `f1bb86c` | `b1fa2cb` | docs: point plan and friction log at .omp-perfect-coder config path                           |
| `c802b26` | `04b1969` | fix: store repo-relative paths in the perfect-coder antibody ledger                           |
| `61aea1c` | `155c39c` | chore: untrack perfect-coder runtime ledgers that record absolute paths                       |
| `20dd3bd` | `eac3f92` | docs(plan): Phase 4.5a machine layer + 4.5b human layer, decisions L20-L34                    |
| `9fef1ae` | `92e2771` | docs(plan): name the rule-violating vendored skills in L34 packet                             |
| `fc56711` | `332b4c7` | docs(plan): harden Phase 4.5 after six-frame ADHD review                                      |
| `063f57c` | `876d3e8` | docs(plan): ADHD evidence parked in audits/, live specimen wording, mutation-smoke packet L35 |
| `02c9e47` | `4f47546` | fix: replace corrupt [object Promise] ADHD evidence with recovered reports                    |
| `815694b` | `bddaafb` | feat(phase-4.5a): machine layer complete                                                      |
| `ff9a5d6` | `8242114` | fix(phase-4.5a): lint and type cleanup across new endpoints                                   |
| `853ee87` | `4ec6865` | fix(machine): llms route coverage parses listing lines, not substrings                        |
| `070fc74` | `9446751` | feat(brand): chip logo lockup 'Fractional [CAIO]' replaces green-square wordmark              |
| `3bfdff2` | `bbca989` | fix(brand): CAIO renders in IBM Plex Mono webfont, not system mono                            |
| `68d377d` | `9f1068b` | feat(brand): owner-corrected chip geometry, CAIO outlined as paths                            |
| `6d68f7e` | `184ea4f` | feat(phase-4.5b): navigation, semantic core, standards, mutation smoke                        |
| `443c606` | `551bf1d` | fix(case-studies): industry label renders as text, not a pillar link                          |
| `d3aea1b` | `03db300` | ci: workflow_dispatch job regenerates linux baselines on the runner itself                    |
| `be737e0` | `9c66096` | ci: register workflow_dispatch trigger                                                        |
| `e18381e` | `2cb06d7` | ci: regen job needs contents:write; gate job skips dispatch runs                              |
| `748f77b` | `85f9218` | fix(validation): close every gap between the plan and the shipped site                        |
| `9eb0cf9` | `4a84ca4` | test(smoke): report what the build actually said when a token is missed                       |
| `f259bb0` | `3e50f88` | fix(csp): hash the inline font-metrics style block                                            |
| `013b83a` | `ff77c0c` | perf: three font faces, no dead components, gate measures real delivery                       |
| `7671d6a` | `8bfbaeb` | ci: run the gate as a parallel graph, Lighthouse as an 8-way matrix                           |
| `29343fb` | `38b1168` | docs: record the parallel gate graph and the single-shard command                             |
| `0ae9fcc` | `90b24ec` | docs(skills): L34 states what actually shipped, runbook covers the parallel gate              |
| `2f70424` | `a4c0270` | ci: visual tests serve dist through the gate server, not a downloaded one                     |
| `69eed43` | `f43993d` | docs(skills): author design-lane.md, the one procedure with no home                           |
| `44eec4b` | `9942548` | feat(phase-4.6): answer-engine hardening across markup, schema, feeds, search                 |
| `15c5206` | `4718666` | test(phase-4.6): darwin baselines and the CG-4.6 gate report                                  |
| `ef3106e` | `d799fd0` | docs(plan): split the plan into an indexed tree with status in filenames                      |
| `4869dba` | `0987eb5` | docs: name the locked rows file for what it holds, fix the stale L range                      |
| `c61ba4d` | `c589d77` | style: format navigate-the-plan.md                                                            |
| `dc1e61e` | `f5b1971` | docs(skills): a Markdown-only commit still has to pass check                                  |
| `0297f6f` | `c7d94a9` | docs(skills): keep run-the-gate.md inside its own 80-line cap                                 |
| `aaed646` | `64ab4bd` | fix(skills): the line cap counted the trailing newline as a line                              |
| `019cfa1` | `96bf075` | docs(skills): the shared-output-directory trap predated sharding                              |
| `2e3c443` | `b03703c` | feat(brand): replace the chip with the ring mark, generated and theme-aware                   |
| `c5dcd84` | `82740c2` | docs(plan): add phase 4.7, the editorial pass over every text                                 |
| `af670d3` | `d4b1be1` | style: format the plan tree                                                                   |
| `20ab376` | `07da8b7` | ci: classify the diff so prose cannot spend a Lighthouse matrix                               |
| `d075a47` | `a70da99` | docs(skills): emulated containers are not evidence about linux rendering                      |
| `b6efd87` | `dd9f6f2` | feat(gate): build the editorial ledger and prove nothing was skipped                          |
| `ef0a171` | `7824ca0` | fix(gate): calibrate the dead-copy bucket to the same standard as the other                   |
| `f28b062` | `528da8d` | feat(core): generate the entity, concept and relationship registers                           |
| `b977293` | `fae8b9c` | fix(core): count a concept use only in body prose                                             |
| `db881e7` | `9433a1a` | docs: the unlinked-concept count is 37, read from the artifact                                |
| `56e3a29` | `48647a4` | feat(gate): disposition texts by file, sealed against the words reviewed                      |
| `1a1e65f` | `8a93740` | feat(standards): the editorial rules become skills, locked rows and gates                     |
| `f65b64f` | `11db074` | feat(content): the editorial pass over every user-facing text                                 |
| `06e41ac` | `10c7eb2` | perf: brand mark as one symbol, analytics off the critical path                               |
| `bcfaf11` | `4c58bf0` | fix(gate): the phase report enforces metric budgets, not only scores                          |
| `8e6176e` | `f395b93` | docs(skills): keep run-the-gate under its cap                                                 |
| `3c53c98` | `7fea339` | docs(skills): fold the perfect-coder note into the trap list                                  |
| `ffd64ff` | `663e498` | docs: English only, no second language                                                        |
| `b53c161` | `15ba58e` | docs(plan): close phase 4.7, promote phase 5                                                  |
| `49e508c` | `664570e` | feat(audit): baseline the 30 buyer prompts from the shipped build                             |
| `b1a7a79` | `b9828bd` | fix(ui): every tap target clears the AA minimum, and mobile stops scrolling                   |
| `57a9755` | `d412cc6` | fix(brand): the mark is clipped because two viewBoxes stack                                   |
| `3996103` | `2b1065a` | test(gate): phase 5 Lighthouse and the polish sweep artifact                                  |
| `f48f603` | `f3943eb` | test(gate): the pre-launch checklist is measured, and two more engines run                    |
| `5278d0f` | `e9d359e` | docs(plan): record what phase 5 has proved and what it waits on                               |
| `784ef13` | `d366be3` | docs(plan): L13 records who actually decided 1850, and when                                   |

## Pruned

Seven commits carried nothing but superseded baseline PNGs. With those blobs removed the commits
were empty, so `git filter-repo` dropped them. Nothing else was in them; the baselines they
produced were themselves replaced by later regenerations, and the current set is one commit.

- `a3d8f5d` test(phase-4): regenerate linux visual baselines in the CI container
- `5215b5b` test(phase-4.5a): regenerate linux visual baselines for the FAQ hub redesign
- `827ddf3` test: regenerate linux baselines on the CI runner
- `c15224f` test: regenerate linux baselines on the CI runner
- `1c3d1e5` test: regenerate linux baselines on the CI runner
- `bb49ba1` chore: verify the full gate on the regenerated baselines
- `3c763fe` test: regenerate linux baselines on the CI runner
