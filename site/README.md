# site

The Astro application behind meshin.co. The methodology that governs it lives one level up:
read `../AGENTS.md` first, then `../docs/plan/INDEX.md`.

Scaffolded from AstroWind and since rewritten: the template's demo pages, widgets, analytics and
client runtime are gone, and the design lane, content model, gates and skills are this project's
own.

## Where things are

| Path              | What it holds                                                                        |
| ----------------- | ------------------------------------------------------------------------------------ |
| `src/pages/`      | Routes. Dynamic templates render the collections in `src/data/`                      |
| `src/data/`       | Content collections: post, faq, glossary, resource, service, case                    |
| `src/components/` | `common/` chrome, `site/` this project's blocks, `ui/` primitives, `widgets/` layout |
| `src/utils/`      | Build-time logic: JSON-LD, machine text, the markdown pipeline, permalinks           |
| `scripts/`        | Every gate, generator and audit. The map is `scripts/README.md`                      |
| `tests/`          | Playwright: visual baselines, axe, search, cross-browser                             |
| `.agents/skills/` | One procedure per job. Read the matching one before doing that job by hand           |

## Commands

```
npm run build       # production build, the only build Lighthouse may measure
npm run check       # astro check, eslint, prettier
npm test            # unit tests
npm run test:smoke  # every guard family proven able to fail
npm run gate:plan   # phase tree, gate wiring, CI browser coverage
```

The full gate list, with what each one refuses, is in `scripts/README.md`. Every `gate:*` script
runs in `../.github/workflows/ci.yml` unless `package.json`'s `localOnlyGates` declares a reason,
and `gate:plan` fails if that is ever untrue.

## Rules that are not negotiable here

Lighthouse 100/100/100/100 on every audited route, both form factors. JS, CSS and page byte
budgets measured from the shipped build. No client JavaScript beyond Plausible, the theme toggle
and the lazy search fetch. No comments in source. Every guard proven able to fail before it is
trusted. All of it, with the reasons, is in `../AGENTS.md`.
