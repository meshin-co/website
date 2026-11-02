export const GENERATED_LAYER = [
  '<!-- semantic-core:begin generated -->',
  '### term (1)',
  '',
  '| Route          | Query   |',
  '| -------------- | ------- |',
  '| `/glossary/x`  | x       |',
  '<!-- semantic-core:end generated -->',
].join('\n');

export const REGISTERS = [
  '<!-- REGISTERS:BEGIN -->',
  '#### Entity register',
  '',
  '| Entity | Route          |',
  '| ------ | -------------- |',
  '| x      | `/glossary/x`  |',
  '<!-- REGISTERS:END -->',
].join('\n');

export const CORE_TEXT = `# Semantic core

${GENERATED_LAYER}

### The 30 buyer prompts (PRD §17.3)

Protocol: check each prompt in five assistants.

#### Entity and offer prompts

**1. first prompt**
Must win: \`/a\`, support \`/b\`.
Passage: "First passage." (\`/a\`)
Passage: "Second passage." (\`/b\`)
Why: because.

**2. second prompt**
Must win: \`/c\`.
Why: because.

**22. twenty-second prompt**
Must win: \`/z\`.
Passage: "Twenty-second passage." (\`/z\`)
Why: because.

**3. third prompt**
Why: no route yet.

**4. bare quote**
Must win: \`/blog/bare\`, support \`/glossary/bare\`.
Passage: "A passage written without a route." (article lead)
Why: because.

**5. wrapped must win**
Must win: \`/d\`, support \`/e\`
and a continuation line that names \`/f\`.
Why: because.

**6. six**
**7. seven**
Must win: nothing. Retired by a decision.
Why: because.

#### Engineering prompts

**8. eighth prompt**
Must win: \`/last\`.
Passage: "Last passage." (\`/last\`)
Why: because.

${REGISTERS}

### GAP register — closed

Every declared GAP is closed.
`;
