# Phase 0 · Initialization

Goal: a scaffolded, committed repo whose template builds untouched, with a recorded baseline.

- `git init` at repo root, remote `meshin-co/website`, branch `main`, first commit with `docs/`.
- `npm create astro@latest -- --template arthelokyo/astrowind site`; Node from `.nvmrc` (22).
- `npm i && npm run build` in `/site` — prove the template builds as shipped.
- Baseline Lighthouse of the untouched template → `audits/phase-0/baseline/`.
- `/.omp-perfect-coder/config.yml`: `mode: shadow`, `languages: { typescript-javascript: strict }`. Renamed 2026-09-12: the plugin moved from `.perfect-coder` to `.omp-perfect-coder`, and the old path was silently ignored for all of Phase 4.
- `AGENTS.md` (PRD Appendix I, adjusted for L1–L19), `CLAUDE.md` → pointer to `AGENTS.md`.
- `docs/DECISIONS.md` = PRD §2 plus the L-table above. `audits/`, `docs/VISUAL_CHANGELOG.md`.
- CI in build-only mode; gates switch on in Phase 1.

Exit: template builds, baseline captured, decisions committed. No CG (nothing of ours is built).
