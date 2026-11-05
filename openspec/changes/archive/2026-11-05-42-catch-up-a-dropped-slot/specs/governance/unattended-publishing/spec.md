## MODIFIED Requirements

### Requirement: The schedule is configuration and the workflow is generated from it

The times at which the writer runs SHALL be a list of UTC clock times in the engine configuration,
at least one, each a zero-padded `HH:MM` in 24 hours, none repeated, and a second list SHALL give the
minutes after each time at which that slot is tried again. The schedule block of the writer's workflow
SHALL be generated from both lists, and `npm run gate:schedule` SHALL fail when the committed workflow
differs from a regeneration. No code SHALL assume that a run started at the time it names.

#### Scenario: A cron line is edited by hand

- **WHEN** a cron line of the workflow is changed, added or removed without changing the lists
- **THEN** the schedule gate fails, names the line or the time that differs and says which command
  regenerates the block

#### Scenario: A catch-up cron is written or removed by hand

- **WHEN** a cron entry that no write time and no delay produces is added, or the entry of a
  configured delay is deleted
- **THEN** the schedule gate fails with `cron-extra` or `cron-missing`, so a retry that would
  never run, or one nobody configured, is never committed

#### Scenario: The list is empty

- **WHEN** the configured list holds no time
- **THEN** the configuration is refused at load with a message that says the writer is paused by
  disabling the workflow or leaving a required secret unset, and a cron block never disappears
  without anyone being told

#### Scenario: The catch-up list is empty

- **WHEN** the configured delays are an empty list
- **THEN** the workflow holds one cron entry for each write time and nothing else, and no run is
  labelled a catch-up

#### Scenario: A time is malformed or repeated

- **WHEN** an entry is not a zero-padded `HH:MM` between `00:00` and `23:59`, or appears twice
- **THEN** the configuration is refused at load, naming the entry and its position in the list

#### Scenario: A delay would put two meanings on one cron minute

- **WHEN** a delay carries a slot past midnight, or lands on a write time or on the time another
  delay gives for another slot
- **THEN** the configuration is refused at load, naming the delay, the slot and the clash

#### Scenario: A run starts late

- **WHEN** GitHub starts a scheduled run many minutes after the time it names
- **THEN** the run chooses its topic from what the corpus and the demand report hold, as it would at
  the named time, and only the schedule modules name the configured times in their configuration key

## ADDED Requirements

### Requirement: A dropped slot is run late and a filled slot is never run twice

A scheduled run SHALL end green before any model is called when its UTC day already holds as many
article claims as write times have passed, as `site/scripts/slot-standing.mjs` counts them, and SHALL
otherwise write; a manual run SHALL always write. A run that fills a slot at least the first catch-up
delay late SHALL put `catchUp`, the slot and the minutes late, on its claims and on the claim in its
generation record, and SHALL leave `origin` alone.

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

- **WHEN** a run files its claim and then fails, the money is spent and an escalation is raised
- **THEN** the claim counts as that slot's entry and no later attempt of the day writes again

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
