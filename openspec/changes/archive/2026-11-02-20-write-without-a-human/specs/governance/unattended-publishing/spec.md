# governance/unattended-publishing Specification

## ADDED Requirements

### Requirement: A run claims its topic before it spends

The pipeline SHALL commit a claim to the default branch before the writing model is called. The
claim SHALL name the slug, the title, the format, the target query, the impressions and position
that justified it, the prompt it serves, the run id and an expiry. A topic SHALL NOT be selected
while an unexpired claim holds its title or its slug.

#### Scenario: A run dies between selection and drafting

- **WHEN** a scheduled run stops after the claim is committed and before a branch exists
- **THEN** the claim remains on the default branch as a readable orphan, and the next run either
  adopts it or lets it expire, rather than reselecting the same topic blindly

#### Scenario: The title already exists

- **WHEN** the candidate title matches a title in the generated layer of `docs/SEMANTIC-CORE.md`
  or an unexpired claim, compared after case folding and punctuation normalisation
- **THEN** the candidate is refused and the next candidate is taken, and the refusal is recorded in
  the run's ledger with the title it collided with

### Requirement: The watcher classifies by the failing job

The watcher SHALL read the checks of the pull request's head commit for the pull-request event's
own workflow run and SHALL identify the single job whose conclusion is `failure`. A `cancelled`
conclusion on a sibling job SHALL NOT by itself be treated as a stop, because the repository
cancels its own run whenever a job fails.

#### Scenario: One gate fails and the run cancels itself

- **WHEN** a content gate fails and the cancelling job terminates the remaining jobs
- **THEN** the watcher reports the failing gate by name and classifies the cause from its findings,
  rather than reporting the cancelling job or treating every cancelled sibling as unrepairable

#### Scenario: The head commit carries no checks

- **WHEN** the head commit of the branch has zero check runs, or a content gate reports `skipped`
- **THEN** the watcher stops and escalates, and SHALL NOT merge, because an absent check is not a
  passing one

#### Scenario: Checks are unsettled

- **WHEN** some checks are still running
- **THEN** the watcher dispatches a successor and exits, and SHALL NOT hold a job open waiting

### Requirement: Merge happens only after a quarantine window

The watcher SHALL merge only when every expected check for the head commit has concluded
successfully and the quarantine window stated in the configuration has elapsed since the pull
request was opened. The quarantine SHALL be measurable from the pull request alone.

#### Scenario: The owner intervenes during quarantine

- **WHEN** the owner closes the pull request, pushes to its branch or applies the configured hold
  label before the window elapses
- **THEN** the watcher stops without merging and records the reason

### Requirement: Repair is bounded to the article's own text

Automated repair SHALL change only the article entry's prose and frontmatter, SHALL make at most
the configured number of attempts, and SHALL write its attempt ledger inside the repair commit.
A failure SHALL be fingerprinted by its rule and path only.

#### Scenario: The same rule fails twice

- **WHEN** a repair attempt produces a failure whose rule and path match an earlier attempt
- **THEN** the loop escalates immediately rather than spending the remaining attempts

#### Scenario: A failure the article did not cause

- **WHEN** the failing job is not a content gate, or the finding names a path outside the article
  and its ledgers
- **THEN** the loop opens an issue, notifies Slack and stops, leaving the branch for a human

### Requirement: Automation cannot certify what no human read

The pipeline SHALL NOT run the disposition seal, and SHALL NOT write the recorded Lighthouse
measurement. A merged article SHALL record the measurement debt it leaves.

#### Scenario: The editorial gate reports stale dispositions

- **WHEN** a repair attempt faces a stale disposition
- **THEN** it rewrites the disposition's reason for the text it just wrote, and any attempt to
  reach the seal path fails

### Requirement: Spend is recorded and capped

Every run SHALL record its token counts and computed cost in its ledger. When the configured
monthly ceiling is reached the workflow SHALL stop and notify, rather than continuing at reduced
quality or silently.

#### Scenario: The ceiling is reached mid-month

- **WHEN** the recorded spend for the current month reaches the ceiling
- **THEN** the daily run exits without calling the model, posts one message naming the ceiling and
  the spend, and does not post again until the next month

### Requirement: A failed demand refresh stops the run

The daily workflow SHALL refresh the committed demand report before selection and SHALL escalate
when the refresh fails, rather than selecting from the previous report.

#### Scenario: The credential is dead

- **WHEN** the Search Console request fails to authenticate
- **THEN** the run stops, notifies Slack naming the secret, and leaves the committed report
  untouched and visibly unrefreshed
