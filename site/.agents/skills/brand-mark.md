# Regenerate the Brand Mark

The logo is a generated asset. Nothing about it is hand-edited in the repo: change
`site/scripts/logo-geometry.json`, run `npm run assets:logo`, and every version follows.

## What the generator owns

`npm run assets:logo` runs `scripts/generate-logo.mjs` then `scripts/generate-favicons.mjs` and
writes all of these. Never edit them by hand — the next regeneration overwrites you.

| Output                                          | Purpose                                                |
| ----------------------------------------------- | ------------------------------------------------------ |
| `src/components/common/LogoMark.astro`          | inline mark used in the header and footer              |
| `public/logo.svg`                               | standalone mark, ink `#16181c`, for embeds and sharing |
| `public/brand/logo-on-dark.svg`                 | same mark in paper `#f4f2ee` for dark surfaces         |
| `src/assets/favicons/favicon.svg` and `.ico`    | browser icons, padded square                           |
| `src/assets/favicons/apple-touch-icon.png`      | 180 px, on paper                                       |
| `public/brand/logo-{dark,light}-{512,1024}.png` | square transparent PNGs for social profiles            |

## How it is built, and why that way

The source artwork is a conic sweep: grey depends only on the angle around the centre and is
constant along every radius. SVG has no conic gradient, so the ring is one annular path filled
with a single ink colour and masked by wedges whose mask luminance carries the ramp.

Two details are load-bearing:

- The wedges live inside a `<mask>`, not on the page. Semi-transparent wedges painted directly
  would double their alpha where they overlap and show hairline seams; mask luminance does not
  accumulate, so a small overlap is safe and gaps cannot appear.
- Ink is `currentColor` in the component, so the mark inverts with the theme from
  `text-heading` alone. No second file, no `prefers-color-scheme` query.

`wedgeStep` in the geometry file controls the graduation count: 3° gives 85 wedges and a ramp
whose visible joins measure under one grey level. 6° halves the bytes and the steps become
visible at large sizes. Do not go below 1.5° — the file doubles and the measured gain is 0.05 of
a grey level.

Each instance scopes its gradient and mask ids with a random prefix, because two marks on one
page with shared ids is invalid HTML and `gate:html` fails on it.

## After regenerating

1. `npm run build`
2. `npm run gate:html` — catches duplicate ids
3. `node scripts/gate.mjs dist budgets.json` — the inline mark counts against the page budget
4. `npx playwright test --update-snapshots`, then the linux baselines per
   `visual-baselines.md`, because the mark appears in the header and footer of every route
5. Optionally add an entry to `docs/VISUAL_CHANGELOG.md` recording why the mark changed
