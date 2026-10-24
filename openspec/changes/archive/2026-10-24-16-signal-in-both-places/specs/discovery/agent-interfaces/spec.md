# discovery/agent-interfaces Specification

## REMOVED Requirements

### Requirement: Every response declares the site's AI content signals

**Reason**: it forbade the `robots.txt` directive to protect the SEO score under Lighthouse 12.6.1,
whose safelist had no `content-signal`. Lighthouse 13.1.0 added it, so the prohibition protects
nothing and costs the only source the scanner reads.

**Migration**: replaced by the requirement below, which keeps the header and adds the directive,
both from one definition.

## ADDED Requirements

### Requirement: Both robots.txt and every response declare the site's AI content signals

The built headers file SHALL carry a `Content-Signal` response header on every route, and the built
`robots.txt` SHALL carry the same value as a directive in every user-agent group. Both SHALL name
all three signals `search`, `ai-train` and `ai-input`, each with an explicit `yes` or `no` value,
and SHALL read from one definition so the two cannot drift.

#### Scenario: The header is missing

- **WHEN** the `Content-Signal` header is removed from the catch-all rule
- **THEN** the gate fails saying no response declares a Content-Signal

#### Scenario: A robots group is added without the directive

- **WHEN** a new user-agent group carries no `Content-Signal` line
- **THEN** the gate fails naming the agent that group was added for

#### Scenario: The two sources disagree

- **WHEN** a `robots.txt` group says `ai-train=no` and the header says `ai-train=yes`
- **THEN** the gate fails printing both values, because a reader cannot tell which one binds

#### Scenario: The signal names only two of the three

- **WHEN** either source carries `search` and `ai-input` but not `ai-train`
- **THEN** the gate fails naming the signal that is absent

#### Scenario: The measuring engine is older than the directive

- **WHEN** the gate runs a Lighthouse older than 13.1.0, whose safelist has no `content-signal`
- **THEN** its `robots-txt` audit reports an unknown directive and the SEO category falls below the
  required 100 on every route, which is a fault in the engine version and not in the file
