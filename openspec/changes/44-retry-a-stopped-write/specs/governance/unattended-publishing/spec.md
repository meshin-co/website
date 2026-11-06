## ADDED Requirements

### Requirement: A run that stops after its claim releases the slot, within a daily bound

A write SHALL be handed its own failed checks at most `loop.correctionRounds` times for one entry. When
a run stops after its claim is committed, `site/scripts/release-claim.mjs` SHALL mark each claim the
run holds `abandoned` and the workflow SHALL commit it. An abandoned claim SHALL keep holding its slug
and title until it expires. `site/scripts/slot-standing.mjs` SHALL forgive at most
`loop.stoppedRunRetriesPerDay` abandoned article claims of a UTC day.

#### Scenario: A stopped run leaves its slot owed

- **WHEN** a run stops after the correction budget with its claim abandoned, and a catch-up cron starts
  later the same UTC day
- **THEN** `slot-due.mjs` says the slot is owed and names the forgiven stopped run, and the run writes a
  topic other than the abandoned one

#### Scenario: A second stopped run is not forgiven

- **WHEN** the day holds more abandoned article claims than `loop.stoppedRunRetriesPerDay`
- **THEN** the claims beyond that number count as entries again, no later attempt of the day writes, and
  a failing model cannot spend all day

#### Scenario: A written claim is not released

- **WHEN** `release-claim.mjs` meets a claim whose status is `written` or already `abandoned`
- **THEN** it leaves the claim as it was and prints no `path=` line for it

#### Scenario: The budget of corrections is read from the configuration

- **WHEN** a draft still fails its checks after `loop.correctionRounds` corrections
- **THEN** the run stops with an output error that names the number of corrections it made, and makes no
  further model call for that entry

#### Scenario: Forgiveness is switched off

- **WHEN** `loop.stoppedRunRetriesPerDay` is 0
- **THEN** a stopped run's claim counts as the slot's entry and the day stops, as before this change

## MODIFIED Requirements

### Requirement: A dropped slot is run late and a filled slot is never run twice

A scheduled run SHALL end green before any model is called when its UTC day already holds as many
article claims as write times have passed, less the abandoned claims the day forgives, as
`site/scripts/slot-standing.mjs` counts them, and SHALL otherwise write; a manual run SHALL always
write. A run that fills a slot at least the first catch-up delay late SHALL put `catchUp`, the slot and
the minutes late, on its claims and on the claim in its generation record, and SHALL leave `origin`
alone.

#### Scenario: The on-time run never starts

- **WHEN** GitHub never starts the run for 03:17, and the attempt two hours later finds no article
  claim for the day
- **THEN** that attempt writes one entry, and its claim and record carry `catchUp` naming the 03:17
  slot and 120 minutes

#### Scenario: A day is counted by claims

- **WHEN** a scheduled run counts the day
- **THEN** it counts article claims by the UTC day of `claimedAt`, so a glossary term claim and an
  article claim of another day do not change the count

#### Scenario: The slot already has its entry

- **WHEN** the run for 03:17 filed an article claim at 03:20, and the attempts at 05:17 and 07:17 start
- **THEN** both end before any model is called and no second entry is written for that slot

#### Scenario: Two slots, two entries, four late attempts

- **WHEN** both slots of a day have an article claim and the late attempts of both start
- **THEN** every one of them ends before any model is called, so the day holds two entries and never three

#### Scenario: A run is started by hand

- **WHEN** the owner dispatches the workflow on a day that already holds an article for every slot
- **THEN** it writes, because the owner asked for it, and the entry counts toward the day

#### Scenario: A write fails after its claim

- **WHEN** a run files its claim and then stops without an entry, and the day has forgiven fewer
  abandoned claims than `loop.stoppedRunRetriesPerDay`
- **THEN** the claim is abandoned and the slot is owed again, so the next attempt writes a different topic

#### Scenario: A run fails before its claim

- **WHEN** a run stops at the demand refresh or the pick, before it files a claim
- **THEN** the day holds no claim for the slot, so the next attempt writes

#### Scenario: Yesterday's entry does not fill today's slot

- **WHEN** the only article claim is dated the previous UTC day
- **THEN** the first slot of today is owed

#### Scenario: A catch-up is not an origin

- **WHEN** a catch-up writes an entry for a demand, a weak-demand or a category topic
- **THEN** the claim keeps that `origin` and gains `catchUp`, and the generation record carries both

#### Scenario: Catch-ups are counted

- **WHEN** `npm run measure:origins` reads the generation records
- **THEN** it prints the entries that arrived on time and those a catch-up wrote, and lists each catch-up
  with its slot, the minutes late and its date
