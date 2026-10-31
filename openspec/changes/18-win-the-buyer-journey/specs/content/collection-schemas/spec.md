# content/collection-schemas Specification

## MODIFIED Requirements

### Requirement: Resource entries name a known type and what is inside

A resource entry SHALL carry name, version, status and howToUse, a type of template, kit, scorecard, repo or checklist, and at least one whatInside item. A license, when present, MUST be an identifier such as MIT whose text ships in the site's public folder. A repoUrl, when present, MUST parse as a URL. `site/src/content.config.ts` enforces this at `npm run build`, with the licence rule in `site/src/utils/resource-license.mjs`.

#### Scenario: An unknown resource type

- **WHEN** a resource's type is "ebook"
- **THEN** `npm run build` fails, naming `type: Invalid option: expected one of "template"|"kit"|"scorecard"|"repo"|"checklist"`

#### Scenario: A repository link that is not a URL

- **WHEN** a resource's repoUrl is "github repo"
- **THEN** `npm run build` fails, naming `repoUrl: Invalid URL`

#### Scenario: A licence with no text behind it

- **WHEN** a resource declares `license: MIT` and no MIT text ships in the public folder
- **THEN** `npm run build` fails, naming `license: needs its text`

#### Scenario: A resource that declares no licence

- **WHEN** a resource omits `license`
- **THEN** `npm run build` passes, and the card, the page and the JSON-LD state no licence
