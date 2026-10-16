# Production smoke

Generated-from: 218b3b1

Measured against `https://meshin.pages.dev` by `npm run smoke:prod`. Every row is one request; nothing
here is read from a config file.

failures: 0

| Check | Status | Detail |
|---|---|---|
| headers | pass | all 6 present, CSP has no unsafe directive |
| route / | pass | 200 |
| noindex removed | pass | no noindex robots meta ships |
| route /services | pass | 200 |
| route /pricing | pass | 200 |
| route /approach | pass | 200 |
| route /about | pass | 200 |
| route /contact | pass | 200 |
| route /faq | pass | 200 |
| route /blog | pass | 200 |
| route /glossary | pass | 200 |
| route /resources | pass | 200 |
| route /robots.txt | pass | 200 |
| route /sitemap-index.xml | pass | 200 |
| route /llms.txt | pass | 200 |
| route /rss.xml | pass | 200 |
| route /feed.json | pass | 200 |
| route /.well-known/security.txt | pass | 200 |
