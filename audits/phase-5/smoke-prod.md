# Production smoke

Generated-from: a96c323

Measured against `http://127.0.0.1:4340` by `npm run smoke:prod`. Every row is one request; nothing
here is read from a config file.

failures: 9

| Check | Status | Detail |
|---|---|---|
| headers | pass | all 6 present, CSP has no unsafe directive |
| route / | pass | 200 |
| noindex removed | pass | no noindex robots meta ships |
| route /services | fail | answered 308, expected 200 |
| route /pricing | fail | answered 308, expected 200 |
| route /approach | fail | answered 308, expected 200 |
| route /about | fail | answered 308, expected 200 |
| route /contact | fail | answered 308, expected 200 |
| route /faq | fail | answered 308, expected 200 |
| route /blog | fail | answered 308, expected 200 |
| route /glossary | fail | answered 308, expected 200 |
| route /resources | fail | answered 308, expected 200 |
| route /robots.txt | pass | 200 |
| route /sitemap-index.xml | pass | 200 |
| route /llms.txt | pass | 200 |
| route /rss.xml | pass | 200 |
| route /feed.json | pass | 200 |
| route /.well-known/security.txt | pass | 200 |
