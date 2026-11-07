# Interview the Owner of a New Site

A copied engine still lacks what only its owner knows: the business, the buyer, the words, the accounts.
This skill is the procedure. The questions are in `docs/plan/reference/new-site-interview.md`, each with
its options, a recommendation and what breaks when the answer is wrong. Copying is in
`extract-the-engine-from-a-site.md`. The order of the adoption is in `adapt-the-engine-to-a-new-site.md`.

## 1. Before the first question

- Run `cd site && npm run gate:engine`. Each finding is a value or a file the interview must produce. A run
  with findings ends by pointing at the question bank.
- `gate:engine` also fails with `ENGINE interview-gap <name>` (`scripts/interview-coverage.mjs`) when the bank
  misses a config value, a secret or a variable. Add the name to the question it belongs to first.
- Read the repository. A question the tree answers is not asked. A value the owner already gave is
  confirmed, not asked again.
- Ask in the language the owner reads. Write each answer in English where it lands.

## 2. How to ask

Follow `grill-me`.

- One question at a time, in the order of the bank. Give the recommended option first, with its reason.
- Show the options as written, each with its cost. Do not add an option the bank lacks. If the owner wants
  one, the bank is wrong: fix the bank.
- When the owner hesitates, read out the question's `If wrong` line. It says what breaks.
- Write the answer where its `Lands in` line says, before the next question. Keep no side notes.
- Never fill a value because the first site had it. A name, a price, a number or a claim the owner did not
  give is an invented fact. Leave it open and say it is open.

## 3. The order

The bank has three parts. Each opens with its own order and dependencies; follow them.

1. **The site,** S1 to S51: whether the loop runs, the layout, identity, pages and navigation, the loop's
   limits (S30 asks the times an article is wanted and the categories the writer takes when demand is empty, S49 and S50 what the writer may spend on fixing and retrying its own stopped run, S51 how many minutes before those times the cron entries are set), Search Console demand, hosting and the performance bar. The answers land in
   `site/engine.config.json` and `site/src/config.yaml`.
2. **The semantic core,** K1 to K34: section 4.
3. **The platform,** P1 to P15: the accounts, the secrets and the settings. Section 5.

## 4. The semantic core and the buyer prompts

This is the heart. A weak core makes every later article off target, thin or unprovable.

- Before Part 2, read `docs/SEMANTIC-CORE.md`. It shows what a complete answer looks like: one block per
  prompt, with its families, its route and its terms.
- Part 2 ends with the contract of a complete core. Walk it line by line with the owner. A line with no
  answer stays open; the core is not called complete.
- A buyer prompt is a question the owner's buyer types into an assistant or a search box. Ask for the
  words buyers use, from the owner's own conversations with them, not from a keyword tool.
- Run `cd site && npm run pick:topic` to see how the selector reads each prompt. A prompt it sets aside
  names the reason. With an empty report the preview lists the category rotation and calls no model.
- S30 lists the categories the writer takes turns on. Each gets articles nobody searched for, a cost the first
  owner accepted (`write-on-a-category.md`): read it out, and say that an empty list turns the fallback off.

## 5. Secrets and repository settings

Keep them apart from the answers. A secret value is never typed into a chat, a file or a commit. The owner
creates it in the repository settings and tells you only that it exists.

- **Secrets:** `AUTOWRITER_PAT`, `AUTOWRITER_OPENAI_API_KEY`, `GSC_SERVICE_ACCOUNT_JSON`,
  `SLACK_WEBHOOK_URL`. The Cloudflare variables are named in `site/.env.example`.
- **Settings:** the four writer variables, the `autowriter-tick` environment and its wait timer, and the
  required status check on `main`.
- For each, Part 3 says what fails when it is absent, and how: loud or silent, at which step. Read that
  line to the owner before they skip one.

## 6. Done

- `cd site && npm run gate:engine` reports 0 findings.
- Every question has an answer, or is written down as open with what it blocks.
- The interview did not ask what does not transfer. That list is section 6 of
  `extract-the-engine-from-a-site.md`.
