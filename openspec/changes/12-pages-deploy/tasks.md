## 1. Credentials

- [x] 1.1 Name every variable and its exact token scope in `site/.env.example`
- [x] 1.2 Keep real secrets out of git and let the example travel
- [x] 1.3 `npm run deploy:check` reports whether the token, the account and the project resolve

## 2. Deploy

- [x] 2.1 `npm run deploy:preview` uploads `dist/` to a preview deployment and prints its URL
- [x] 2.2 `npm run deploy` uploads `dist/` to production
- [x] 2.3 Refuse to upload a `dist/` the gates have not seen

## 3. Verify against the live origin

- [x] 3.1 `npm run smoke:prod <url>` passes against the deployed origin, not the gate server

## 4. Publish from CI, never a second build

- [x] 4.1 Every pull request gets a preview from the gated artifact, smoked and commented
- [x] 4.2 Production is published only when a person dispatches `deploy` with a passing ci run
- [x] 4.3 The IndexNow key is a build output, announced only once the live host serves it
- [x] 4.4 `gate:plan` reads every workflow, so a step cannot hide outside `ci.yml`

## 5. Calibration Gate

- [ ] 5.1 Run the Calibration Gate and commit its report
