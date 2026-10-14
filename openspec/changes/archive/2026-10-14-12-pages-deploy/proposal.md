# Publish the build to Cloudflare Pages

## Why

L16 says the site deploys to `meshin.pages.dev` and the apex is attached at launch, but nothing
in this repository can publish: there is no wrangler, no deploy script, no credential contract.
Every gate runs against `dist/` or the local gate server, so "the site is correct" has never
meant "the site is live and correct".

## What changes

A direct-upload deploy from the built output, run from a workstation or from CI with the same two
credentials. Nothing is built on Cloudflare: the artefact that was gated is the artefact that is
uploaded, which is the only way the Calibration Gate's evidence still describes what visitors get.

The deploy reads `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` and
`CLOUDFLARE_PAGES_PROJECT`. `site/.env.example` names them and the exact token scopes.
`npm run deploy:check` answers whether the credentials work before a deploy is attempted, so a
missing scope is a sentence rather than a failed upload.

Both CI paths download the `dist` artifact a gated run produced rather than building again.
Every pull request gets a preview at `pr-<number>`, smoked and commented. Production has no
automatic trigger: a person dispatches the `deploy` workflow and names the ci run to publish,
which the job refuses unless it concluded `success` on `main`. The environment carries no
required reviewer because the billing plan refuses that rule (G39).

The IndexNow key moves with it. It was written into a `dist/` that nothing published, so the
announced `keyLocation` would have 404ed; a key is public by definition, so it is now a committed
file under `site/public/` that every build ships, and the ping refuses to announce a key the live
host does not already serve.

## What does not change

No Pages Function, no server-side anything (L6). The apex stays off until the owner attaches it
(G35); the token needs no DNS scope for this change.
