# Fonts used only at build time

These two files exist so the build-time Open Graph renderer (satori) has a TTF it can parse.
Astro's Font API caches web fonts as WOFF2 only, and satori's parser cannot read WOFF2.
Browsers never receive these files; the site serves the WOFF2 versions from Astro's font pipeline.

- `Fraunces-SemiBold.ttf` — Fraunces, SIL Open Font License 1.1, https://github.com/undercasetype/Fraunces
- `IBMPlexSans-Regular.ttf` — IBM Plex Sans, SIL Open Font License 1.1, https://github.com/IBM/plex
