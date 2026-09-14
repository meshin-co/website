# Coordinate Parallel Agents

meshin.co phases run with several subagents editing the same checkout at once. This is the
protocol that keeps concurrent edits from colliding, derived from running it under Phase 4.5 and
4.6. It supplements, never replaces, whatever the dispatching agent states as the wave's explicit
file assignments and cross-task contracts.

## File ownership is strict and explicit

Each agent gets a named file list in its assignment. Touch only those files. If a fix belongs in
a file you do not own, send the file owner the exact text or line, and keep working on your own
scope — never edit around the boundary "just this once." A handful of files are effectively
always owned by the dispatching agent across every wave: `package.json`,
`.github/workflows/ci.yml`, `docs/plan/INDEX.md`, `AGENTS.md`, and any single data file multiple agents
would otherwise race on (e.g. `site/content-facts.json`). Confirm current ownership from the
wave's dispatch message; it can rotate between waves.

## Shared-file protocol

A skill file, data file, or module more than one agent's job touches (e.g.
`site/.agents/skills/machine-interfaces.md` carrying findings from several audits) needs a
read-before-write: message the file's owner for that wave, wait for or check their current
draft, then append rather than overwrite. Announce once you have written, so a sibling who read
it earlier knows to re-read before writing.

## Build embargo

Do not run `npm run build`, `npm run gate:lh`, `npm run gate:visual`, or `playwright --update-
snapshots` while siblings are mid-edit on content or components, unless your assignment says
otherwise. A shared `dist` or baseline set built from someone else's half-finished change reports
phantom failures against your own work. The dispatching agent regenerates Lighthouse and visual
baselines once, after every agent's edits have landed.

## Cross-task contracts are named up front, not negotiated mid-flight

When two agents' work must agree on a shape (an exported constant, a family definition, a JSON
schema), the wave's dispatch message states who produces it and who consumes it, and the shape
itself, before either agent starts. An agent that discovers it needs something from a sibling's
in-progress file mid-task asks over `hub`, not by reading the sibling's uncommitted draft and
guessing.
