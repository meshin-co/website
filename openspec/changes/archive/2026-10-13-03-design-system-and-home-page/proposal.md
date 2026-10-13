# Phase 2 · Design system and home page

Goal: the visual language is fixed in tokens and components; `/` is final.

- Frame per `frontend-excellence` §1: audience (PRD §6), everything indexable, "engineering brief"
  lane (PRD §10.1), SSG.
- Components (PRD §10.4) reusing AstroWind widgets: Hero, Signals, ServiceCards, StepsTimeline,
  ResourceCard, CaseMetrics, PostCard, AnswerBlock, KeyTakeaways, TOC, FAQ (`<details>`),
  AuthorBox, Sources, CTA, Header/Footer, SearchBox (Pagefind, lazy on focus).
- `/styleguide`, noindex, out of sitemap: every component in every state, both themes. This is the
  widget inventory the later gates diff against.
- States: hover, `focus-visible`, active, disabled, reduced motion, dark mode checked on its own.
- Build `/` to PRD §9.1 with Appendix A copy and L8 prices.
- First Playwright visual baselines.

CG-2 routes: `/`, `/styleguide`, `/404`. Load `design.md`, `components.md`, `responsive.md`.
Run polish-loop phases 3, 11, 12. Contrast checked in both themes.
