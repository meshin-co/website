## ADDED Requirements

### Requirement: A pull request main has moved under is caught up on main, and its derived files are regenerated, never merged

When a green pull request of the writer is past its quarantine and `main` has changed a derived file
since the branch left it, the watcher SHALL have the branch caught up before it merges: one merge
commit of the bot that takes the side of `main` for every shared derived path, replays the rows the
branch added and regenerates the derived set, kept only when a second regeneration changes no byte.
The push SHALL be a fast-forward, never a rebase or a force push.

#### Scenario: Two writer runs of one day

- **WHEN** two runs branch from the same `main` and the first pull request is merged
- **THEN** the second is caught up by the watcher and merges with no human, `git merge-tree --write-tree` of it against `main` exits 0, and regenerating every derived file afterwards changes no byte

#### Scenario: Main did not move a derived file

- **WHEN** `main` moved only paths that are not derived
- **THEN** the pull request is merged as before, with no merge commit of the bot

#### Scenario: A file list GitHub cut short

- **WHEN** the comparison of the head with `main` lists as many files as GitHub returns in one page
- **THEN** the watcher counts `main` as having moved a derived file, because one may be in the part that
  was cut

#### Scenario: A conflict outside the derived set

- **WHEN** the merge conflicts in a path that is not a derived file, such as the article of the branch
- **THEN** the catch-up stops, `git merge --abort` leaves the branch exactly as it was, and the
  watcher escalates a hard stop

#### Scenario: Main moves again after every catch-up

- **WHEN** the branch already holds as many catch-up merge commits of the bot as the cap
- **THEN** the watcher escalates no convergence and does not catch the branch up a fourth time

#### Scenario: A branch that already holds main

- **WHEN** the catch-up finds `origin/main` already in the branch
- **THEN** it makes no commit and reports the repair as stale, so the watcher judges the branch again

#### Scenario: A row the branch added would be lost

- **WHEN** a route, a target query or a buyer prompt passage the branch added is absent from the
  regenerated files
- **THEN** the catch-up stops and the watcher escalates no convergence

#### Scenario: A pipeline commit touches a path nobody registered

- **WHEN** a commit of the writer changes a path that is not the run's own, not registered as derived
  in `site/scripts/derived-files.mjs` and not a restated disposition
- **THEN** `gate:autowriter` fails with `unregistered-path-committed` naming the path, so a new
  derived file cannot start colliding without the catch-up learning to heal it
