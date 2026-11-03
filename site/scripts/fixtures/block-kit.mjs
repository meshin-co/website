const ALLOWED_BLOCKS = ['header', 'section', 'divider', 'context'];
const LIMITS = { blocks: 50, header: 150, text: 3000, fields: 10, field: 2000, elements: 10, fallback: 4000 };
const LINK = /<(https?:\/\/[^\s|<>]+)(?:\|[^<>]*)?>/g;
const BARE_AMPERSAND = /&(?!amp;|lt;|gt;)/;
const MARKUP = ['mrkdwn', 'plain_text'];

const listOf = (value) => (Array.isArray(value) ? value : []);

const keysProblem = (label, value, allowed) =>
  Object.keys(value)
    .filter((key) => !allowed.includes(key))
    .map((key) => `${label} has unknown key ${key}`);

const countProblem = (label, noun, list, max) =>
  Array.isArray(list) && list.length >= 1 && list.length <= max ? [] : [`${label} must hold 1 to ${max} ${noun}`];

function markupProblems(label, value) {
  const links = [...value.matchAll(LINK)].map(([, url]) => url);
  const rest = value.replace(LINK, '');
  const bareAmpersand = BARE_AMPERSAND.test(rest) || links.some((url) => BARE_AMPERSAND.test(url));
  return [
    ...(/[<>]/.test(rest) ? [`${label} holds an unescaped < or > that is not part of a link`] : []),
    ...(bareAmpersand ? [`${label} holds an unescaped &`] : []),
    ...((value.match(/```/g) ?? []).length % 2 === 1 ? [`${label} opens a code fence it never closes`] : []),
  ];
}

function textProblems(label, object, { limit, types }) {
  if (typeof object !== 'object' || object === null) return [`${label} is not a text object`];
  const problems = keysProblem(label, object, ['type', 'text', 'emoji', 'verbatim']);
  if (!types.includes(object.type))
    problems.push(`${label} has type ${object.type}, which is not ${types.join(' or ')}`);
  if (typeof object.text !== 'string' || object.text.trim() === '') return [...problems, `${label} is empty`];
  if (object.text.length > limit) problems.push(`${label} is ${object.text.length} characters, over ${limit}`);
  return object.type === 'mrkdwn' ? [...problems, ...markupProblems(label, object.text)] : problems;
}

const fieldProblems = (block, label) => [
  ...countProblem(label, 'fields', block.fields, LIMITS.fields),
  ...listOf(block.fields).flatMap((field, at) =>
    textProblems(`${label} field ${at + 1}`, field, { limit: LIMITS.field, types: MARKUP })
  ),
];

const BLOCK_CHECKS = {
  header: (block, label) => [
    ...keysProblem(label, block, ['type', 'text', 'block_id']),
    ...textProblems(`${label} text`, block.text, { limit: LIMITS.header, types: ['plain_text'] }),
  ],
  divider: (block, label) => keysProblem(label, block, ['type', 'block_id']),
  section: (block, label) => [
    ...(block.text === undefined && block.fields === undefined ? [`${label} needs text or fields`] : []),
    ...keysProblem(label, block, ['type', 'text', 'fields', 'block_id']),
    ...(block.text === undefined
      ? []
      : textProblems(`${label} text`, block.text, { limit: LIMITS.text, types: MARKUP })),
    ...(block.fields === undefined ? [] : fieldProblems(block, label)),
  ],
  context: (block, label) => [
    ...keysProblem(label, block, ['type', 'elements', 'block_id']),
    ...countProblem(label, 'elements', block.elements, LIMITS.elements),
    ...listOf(block.elements).flatMap((element, at) =>
      textProblems(`${label} element ${at + 1}`, element, { limit: LIMITS.text, types: MARKUP })
    ),
  ],
};

function blockProblems(block, at) {
  const position = `block ${at + 1}`;
  if (typeof block !== 'object' || block === null) return [`${position} is not an object`];
  if (!ALLOWED_BLOCKS.includes(block.type))
    return [`${position} has type ${block.type}, which this pipeline never sends`];
  return BLOCK_CHECKS[block.type](block, `${position} (${block.type})`);
}

export function blockKitProblems(message) {
  const { text, blocks } = message;
  const fallbackOk = typeof text === 'string' && text.trim() !== '' && text.length <= LIMITS.fallback;
  return [
    ...keysProblem('the message', message, ['text', 'blocks']),
    ...(fallbackOk ? [] : [`the fallback text must be 1 to ${LIMITS.fallback} characters`]),
    ...countProblem('the message', 'blocks', blocks, LIMITS.blocks),
    ...listOf(blocks).flatMap(blockProblems),
  ];
}
