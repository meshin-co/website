import { MAY } from './repair-guard.mjs';
import { buildPrompt } from './writer-prompt.mjs';
import { claimFacts, contextLists } from './writer-prompt-text.mjs';

export const ALLOWANCE_TEXT = {
  takeaways: 'The key takeaways may lose or change items, so that the list can meet the rule it fails.',
  faq: 'The FAQ may lose or change items, so that the list can meet the rule it fails.',
  sources: 'A source may be dropped from the source list when the finding is about that source.',
  claims: 'A claim row and the sentence it binds may be dropped when the finding is about that claim.',
  headings: 'A heading may be dropped or merged when the finding is about the headings.',
  'words-down':
    'The entry as a whole may shrink, down to three quarters of its words, never by dropping a sentence outright: every sentence stays, reworded.',
};

const bullets = (items) => items.map((item) => `- ${item}`).join('\n');

const findingText = ({ gate, rule, subjects, detail, excerpt }, index) =>
  [
    `${index + 1}. gate: ${gate}`,
    `   rule: ${rule}`,
    subjects.length > 0 && `   where: ${subjects.join(', ')}`,
    detail !== '' && `   detail: ${detail}`,
    excerpt !== '' && `   text: ${excerpt}`,
  ]
    .filter(Boolean)
    .join('\n');

const neverText = (before) =>
  bullets([
    'It never deletes. A sentence is reworded, never removed to make a finding go away, and the checks that run after you compare the words you return with the words the entry had and refuse a rewrite that lost any.',
    'It keeps every heading, FAQ item, key takeaway, source and claim row.',
    `It leaves the passage exactly as it is, word for word: ${before.passage}`,
    'It adds no fact it cannot source.',
  ]);

const allowanceText = (allowances) => {
  const unknown = allowances.filter((name) => !MAY.includes(name));
  if (unknown.length > 0) throw new RangeError(`there is no allowance named ${unknown.join(', ')}`);
  return [
    '# What the failing rules allow',
    'Each allowance below applies only to the finding that names it and to no other part of the entry.',
    bullets(allowances.map((name) => `${name}: ${ALLOWANCE_TEXT[name]}`)),
  ].join('\n\n');
};

const userOfRepair =
  ({ claim, before, findings, allowances, attempt }) =>
  (read) =>
    [
      'Repair this entry.',
      bullets([
        ...claimFacts(claim),
        `Attempt: ${attempt.number} of ${attempt.of}.`,
        'The published date and the updated date are not yours to change: the pipeline keeps them.',
      ]),
      'The entry below failed the checks of its pull request. A repair rewrites the words that cause the findings and returns the whole entry. It changes only what the findings name and what the claim table and the passage need to stay true to the changed words.',
      `# What CI found\n\n${findings.map(findingText).join('\n\n')}`,
      `# What a repair never does\n\n${neverText(before)}`,
      ...(allowances.length > 0 ? [allowanceText(allowances)] : []),
      [
        '# The entry as it stands',
        `The block of docs/SEMANTIC-CORE.md for this buyer prompt, copied from the file:\n${read.data.promptBlock}`,
        `The entry as it stands, as the output of the same shape you return now:\n\n\`\`\`json\n${JSON.stringify(before, null, 2)}\n\`\`\``,
      ].join('\n\n'),
      ...contextLists(read),
      'Return the complete corrected output: every member, in the same JSON shape.',
    ].join('\n\n');

export const buildRepairPrompt = ({ repoRoot, claim, before, findings, allowances, attempt }) =>
  buildPrompt({ repoRoot, claim, userOf: userOfRepair({ claim, before, findings, allowances, attempt }) });

export function repairCorrectionMessage(problems) {
  if (problems.length === 0) throw new RangeError('there is no problem to correct');
  return [
    'The entry you returned fails the checks that run before the build.',
    'Fix every problem below and return the complete corrected output: the same JSON shape with every member, not only the members you changed.',
    'Reword instead of removing: never delete a sentence, heading, FAQ item, key takeaway, source or claim row to make a problem go away, and add no fact.',
    '',
    ...problems.map(({ rule, detail }, index) => `${index + 1}. ${rule}: ${detail}`),
  ].join('\n');
}
