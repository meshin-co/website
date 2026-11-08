## MODIFIED Requirements

### Requirement: Every entry records where its topic came from

Every claim and every generation record SHALL carry an origin, one of `demand`, `weak-demand`,
`category` or `ordered`, and a claim written before the ladder existed SHALL read as `demand`. An entry of origin
`weak-demand` SHALL list the reasons it is weak. An entry of origin `category` SHALL name its
category. An entry of origin `ordered` SHALL carry the buyer prompt it was ordered by when the
order named a number, and none when the order named a title. Neither a `weak-demand` nor a
`category` entry SHALL carry a buyer prompt.

#### Scenario: The owner counts what was written blind

- **WHEN** the owner reads the generation records
- **THEN** the number of entries of each origin, their cost and the categories of the blind entries
  are countable from the records alone

#### Scenario: A category claim names a prompt

- **WHEN** a committed claim of origin `category` carries a buyer prompt or lacks its category
- **THEN** the autowriter gate fails and names the claim

#### Scenario: An ordered entry is told apart from an automatic one

- **WHEN** the owner reads the generation records after ordering a topic by hand
- **THEN** that entry reads `ordered` and no automatic entry does, so the two are counted separately

## ADDED Requirements

### Requirement: A hand order chooses the topic and refusing it writes nothing

A run dispatched by hand SHALL take at most one order, either a buyer-prompt number or an article
title, and SHALL refuse two together. An order SHALL pass the same occupancy checks as an automatic
choice: a concept another route owns, a slug already claimed and an article that repeats an existing
one SHALL each refuse it. A refused order SHALL end the run with nothing written, and SHALL NOT fall
back to any automatic signal or to the category rotation.

#### Scenario: The order names a prompt that is already served

- **WHEN** the owner orders a prompt whose route is already in the article family
- **THEN** the run reports the refusal, names the route that already answers it, writes nothing, and
  names no other topic

#### Scenario: The order names two topics

- **WHEN** both a prompt number and a title are given
- **THEN** the run stops with a usage error naming both inputs, because a run writes one entry

#### Scenario: A scheduled run carries no order

- **WHEN** the workflow runs on its schedule
- **THEN** the picker behaves exactly as it did before orders existed
