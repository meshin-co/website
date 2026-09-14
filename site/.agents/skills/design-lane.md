# Stay Inside the Design Lane

Read before writing any markup or CSS. The lane is "engineering brief": paper and ink, one deep
teal accent, hairlines instead of boxes, numbers instead of adjectives. `docs/PLAN.md` rows L9a,
L9b and L39 are the binding part; this file is how to obey them without inventing a second
convention.

## Where the design lives

- `src/assets/styles/tailwind.css` — the only place colours, fonts and shared utilities are
  declared. Every colour is OKLCH, defined once as an `--aw-color-*` variable in `:root` and
  overridden in `.dark`. Never write a hex value, an `rgb()` or a raw `oklch()` in a component.
- `src/components/site/` — the project's own components. `src/components/common/` is plumbing
  (metadata, JSON-LD, theme, breadcrumbs) and `src/components/ui/Button.astro` plus
  `src/components/widgets/{Header,Footer}.astro` are the only template survivors.
- `src/pages/styleguide.astro` — the visual inventory. It is `noindex` and deliberately unlinked
  (the orphan gate exempts it by name). Add a specimen here when you add a component.

## Tokens, not values

Colour: `--aw-color-primary` (teal, `oklch(45% 0.09 200)` light / `oklch(80% 0.1 200)` dark),
`--aw-color-line` for every hairline, `--aw-color-tint` and the `bg-surface` utility for the only
permitted fills. Text: `--aw-color-text-heading`, `--aw-color-text-default`,
`--aw-color-text-muted`.

Type: `--aw-font-heading` and `--aw-font-serif` are Fraunces 600, `--aw-font-sans` is IBM Plex
Sans 400 and 500, `--aw-font-mono` resolves to the platform monospace stack. Three faces ship and
no more (L39): never request a weight that is not loaded, because the browser then synthesizes
bold and a display serif looks visibly wrong. Headings ask for 600, including the prose headings
in `prose-brief-headings`.

Reach for an existing utility before writing classes: `eyebrow`, `figure-num`, `text-numeral`,
`accent-underline`, `rule-accent`, `card`, `card-hover`, `hairline-grid`, `link-signature`,
`link-signature-hover`, `btn-primary`, `btn-secondary`, `btn-tertiary`, `prose-brief`,
`table-scroll`.

## Rules the gates enforce

- No numbered section labels ("01", "02") and no figure-number chips anywhere (L9a). `figure-num`
  exists for tabular numerals inside a real figure, not for decorating a heading.
- An inline link inside a text block carries a persistent underline, never colour alone —
  `underline decoration-2 underline-offset-4` or the `link-signature` utility. axe's
  `link-in-text-block` rule runs on every route in both themes and will fail the gate.
- No gradients, no stock imagery, no purple, no shadows standing in for a hairline.
- Inline `<style>` and inline `style=` attributes are blocked by the shipped CSP. Astro's font
  API emits one inline `<style>` per family; `scripts/gen-headers.mjs` hashes those into
  `style-src`. Anything else you inline will be blocked in production and will drop
  best-practices to 0.93 in the gate.
- Every visual change needs an entry in `docs/VISUAL_CHANGELOG.md` in the same commit as the
  regenerated baselines (visual-baselines.md).

## Checking your work

1. `npm run build && npm run gate:visual` — snapshots and axe, both themes, both viewports,
   served through `scripts/gate-server.mjs` so the real CSP applies.
2. `node scripts/gate.mjs dist budgets.json` — CSS is capped at 20 KB gzip. Tailwind scans every
   file under `src/`, so an unused component costs real bytes; delete it rather than parking it.
3. Look at `/styleguide` in a browser at 375 px and 1440 px before claiming a component is done.
