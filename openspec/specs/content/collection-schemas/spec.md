# content/collection-schemas Specification

## Purpose

Collection schemas govern the frontmatter each content entry must carry before the site builds: required fields, word and character limits, date order and fixed vocabularies. The zod schemas live in `site/src/content.config.ts`, and `npm run build` stops on an entry that breaks them, naming the collection, the entry, the field and the message; the category pillars in `site/src/data/categories.mjs` are held by their own unit test.

## Requirements

### Requirement: An entry that breaks its collection schema stops the build

`npm run build` SHALL validate every entry in the post, service, resource, case, glossary, faq and author collections against `site/src/content.config.ts`. It MUST fail on an entry that breaks its schema, printing an InvalidContentEntryDataError that names the collection, the entry and each failing field with its message. `npm run test:smoke` copies violating fixtures into a scratch copy of the site and needs the build to fail naming the field.

#### Scenario: A planted entry that breaks the schema

- **WHEN** `site/tests/guard-mutations/fixtures/faq-missing-updated-date.md` is copied into the faq collection
- **THEN** `npm run build` prints `[InvalidContentEntryDataError] faq → faq-missing-updated-date data does not match collection schema.` and the failing field, and fails

### Requirement: Every dated entry carries both dates, and the update is never earlier than the publish date

Post, service, resource, case, glossary and faq entries SHALL carry publishDate and updatedDate, and updatedDate MUST NOT be earlier than publishDate; the same day passes. `site/src/content.config.ts` enforces both at `npm run build`, `site/src/utils/content-rules.test.mjs` pins the date comparison, and `npm run test:smoke` plants an FAQ entry with no updatedDate.

#### Scenario: An FAQ entry with no updated date

- **WHEN** an faq entry omits updatedDate
- **THEN** `npm run build` fails, naming `updatedDate: Required`

#### Scenario: An update dated before the publish date

- **WHEN** a post's updatedDate is earlier than its publishDate
- **THEN** `npm run build` fails, naming `updatedDate: updatedDate must not be before publishDate`

### Requirement: Titles and FAQ questions are 98 characters or fewer

The title of every post, service, resource, case and glossary entry, and the question of every faq entry, SHALL be 98 characters or fewer, through `ogTitleSchema` in `site/src/utils/content-rules.mjs`. `site/src/utils/content-rules.test.mjs` accepts 98 and refuses 99, and `npm run test:smoke` plants an over-long FAQ question and an over-long post title.

#### Scenario: An FAQ question past the cap

- **WHEN** `site/tests/guard-mutations/fixtures/faq-question-too-long.md` is copied into the faq collection
- **THEN** `npm run build` fails, naming `question: must be 98 characters or fewer`

#### Scenario: A post title past the cap

- **WHEN** `site/tests/guard-mutations/fixtures/post-title-too-long.md` is copied into the post collection
- **THEN** `npm run build` fails, naming `title: must be 98 characters or fewer`

### Requirement: Descriptions fit the snippet length limits

The description of every post, service, resource, case and glossary entry SHALL be 155 characters or fewer. An faq description, when present, MUST be 120 to 160 characters; when it is absent, the description that `site/src/utils/faq-meta.mjs` computes from the question and answer MUST fall in that range. `site/src/utils/faq-meta.test.mjs` checks every real FAQ entry, and `npm run test:smoke` plants a description that is too short.

#### Scenario: A post description of 156 characters

- **WHEN** a post's description has 156 characters
- **THEN** `npm run build` fails, naming `description: Too big: expected string to have <=155 characters`

#### Scenario: An FAQ description under the floor

- **WHEN** `site/tests/guard-mutations/fixtures/faq-description-too-short.md` is copied into the faq collection
- **THEN** `npm run build` fails, naming `description: must be 120 characters or more`

#### Scenario: A computed FAQ description out of range

- **WHEN** an faq entry has no description and the computed one falls outside 120 to 160 characters
- **THEN** `npm run build` fails, naming `description: computed description must be 120–160 characters`

### Requirement: Answer and definition fields stay inside their word ranges

At build, a post shortAnswer SHALL be 40 to 60 words and its fullAnswer 130 to 170, a service shortAnswer 40 to 60, a glossary shortDefinition at most 50 and its definition 100 to 200, and an faq answer at most 80. `countWords` in `site/src/utils/content-rules.mjs` MUST do the counting: en and em dashes split words, and a token counts only if it holds a letter or digit. `site/src/utils/content-rules.test.mjs` pins the counting and the inclusive bounds.

#### Scenario: A short answer one word under the floor

- **WHEN** a post's shortAnswer has 39 words
- **THEN** `npm run build` fails, naming `shortAnswer: must be 40–60 words`

#### Scenario: A glossary definition one word under the floor

- **WHEN** a glossary entry's definition has 99 words
- **THEN** `npm run build` fails, naming `definition: must be 100–200 words`

#### Scenario: An FAQ answer one word over the cap

- **WHEN** an faq entry's answer has 81 words
- **THEN** `npm run build` fails, naming `answer: must be 80 words or fewer`

### Requirement: Posts use the controlled tag vocabulary and one of four categories

A post's tags SHALL come from the slugs in `site/src/data/tags.mjs`, and its category MUST be governance, agentic-architecture, operating-model or executive. `site/src/data/tags.test.mjs` also fails when the vocabulary holds a tag that no post uses, and `npm run test:smoke` plants a post with an unknown tag.

#### Scenario: A tag outside the vocabulary

- **WHEN** `site/tests/guard-mutations/fixtures/post-unknown-tag.md` is copied into the post collection
- **THEN** `npm run build` fails, naming `tags.0: Invalid option` and listing the allowed slugs

#### Scenario: A vocabulary tag that no post uses

- **WHEN** a slug is added to `site/src/data/tags.mjs` and no post carries it
- **THEN** `npm run test` fails the test "the controlled vocabulary covers exactly the tags the posts use"

#### Scenario: An unknown category

- **WHEN** a post's category is "marketing"
- **THEN** `npm run build` fails, naming `category: Invalid option: expected one of "governance"|"agentic-architecture"|"operating-model"|"executive"`

### Requirement: Posts carry three to five takeaways and at most five FAQ items

A post SHALL list 3 to 5 keyTakeaways and MUST NOT list more than 5 faq items; an empty faq list is allowed. `site/src/content.config.ts` enforces both limits at `npm run build`.

#### Scenario: Two takeaways

- **WHEN** a post lists 2 keyTakeaways
- **THEN** `npm run build` fails, naming `keyTakeaways: Too small: expected array to have >=3 items`

#### Scenario: Six FAQ items

- **WHEN** a post lists 6 faq items
- **THEN** `npm run build` fails, naming `faq: Too big: expected array to have <=5 items`

### Requirement: Every post, service, resource and glossary entry cites a source with a valid URL

Post, service, resource and glossary entries SHALL each cite at least one source, and every source MUST carry a title and a url that parses as a URL. FAQ sources are optional. `site/src/content.config.ts` enforces this at `npm run build`.

#### Scenario: No sources

- **WHEN** a glossary entry's sources list is empty
- **THEN** `npm run build` fails, naming `sources: Too small: expected array to have >=1 items`

#### Scenario: A source url that is not a URL

- **WHEN** a post's first source has the url "not a url"
- **THEN** `npm run build` fails, naming `sources.0.url: Invalid URL`

### Requirement: Service entries carry a complete offer outline

A service entry SHALL carry name, tagline, feeShape, duration and a cta with label and href; at least one item each in forWhom, notForWhom, deliverables and process; 3 to 5 schedule rows; 3 to 8 faq items; and a positive integer order. Each process step number MUST be a positive integer. `site/src/content.config.ts` enforces this at `npm run build`.

#### Scenario: Two schedule rows

- **WHEN** a service lists 2 schedule rows
- **THEN** `npm run build` fails, naming `schedule: Too small: expected array to have >=3 items`

#### Scenario: No call to action

- **WHEN** a service omits cta
- **THEN** `npm run build` fails, naming `cta: Required`

### Requirement: Resource entries name a known type and what is inside

A resource entry SHALL carry name, version, license, status and howToUse, a type of template, kit, scorecard, repo or checklist, and at least one whatInside item. A repoUrl, when present, MUST parse as a URL. `site/src/content.config.ts` enforces this at `npm run build`.

#### Scenario: An unknown resource type

- **WHEN** a resource's type is "ebook"
- **THEN** `npm run build` fails, naming `type: Invalid option: expected one of "template"|"kit"|"scorecard"|"repo"|"checklist"`

#### Scenario: A repository link that is not a URL

- **WHEN** a resource's repoUrl is "github repo"
- **THEN** `npm run build` fails, naming `repoUrl: Invalid URL`

### Requirement: FAQ entries carry a category, an order and a short title that fits

An faq entry SHALL carry a category of governance, agentic-architecture, operating-model, executive or general, and a positive integer order. A shortTitle, when present, MUST be at most 70 characters minus the length of the title suffix, which `site/src/utils/faq-meta.mjs` builds from the site name in `site/src/config.yaml` (58 characters for the current name). `site/src/content.config.ts` enforces this at `npm run build`.

#### Scenario: An order of zero

- **WHEN** an faq entry's order is 0
- **THEN** `npm run build` fails, naming `order: Too small: expected number to be >0`

#### Scenario: A short title with no room for the suffix

- **WHEN** an faq entry's shortTitle has 60 characters
- **THEN** `npm run build` fails, naming `shortTitle: must be 58 characters or fewer`

### Requirement: Case-study entries carry the client, the work and the outcome

A case entry SHALL carry the client's industry and size, problem, approach, at least one stack item, an offer, and anonymized set to true or false, and its outcome metrics MUST number 3 or fewer. `site/src/content.config.ts` enforces this at `npm run build`.

#### Scenario: No anonymized flag

- **WHEN** a case entry omits anonymized
- **THEN** `npm run build` fails, naming `anonymized: Required`

#### Scenario: Four outcome metrics

- **WHEN** a case entry lists 4 outcome metrics
- **THEN** `npm run build` fails, naming `outcome.metrics: Too big: expected array to have <=3 items`

### Requirement: The author entry lists at least one profile URL

An author entry SHALL carry name, role and bio, and sameAs MUST list at least one value that parses as a URL. `site/src/content.config.ts` enforces this at `npm run build`.

#### Scenario: No profile URL

- **WHEN** the author entry's sameAs list is empty
- **THEN** `npm run build` fails, naming `sameAs: Too small: expected array to have >=1 items`

### Requirement: Each post category has a pillar of at least 300 words

`site/src/data/categories.mjs` SHALL hold a pillar for exactly governance, agentic-architecture, operating-model and executive. Each pillar body MUST be at least 300 words as `countWords` counts them, and each pillar description MUST be 155 characters or fewer. `site/src/data/categories.test.mjs` fails on any of the three, and `npm run test` runs it.

#### Scenario: A pillar one word short

- **WHEN** a pillar body drops to 299 words
- **THEN** `npm run test` fails the test "every category has pillar text of at least 300 words"
