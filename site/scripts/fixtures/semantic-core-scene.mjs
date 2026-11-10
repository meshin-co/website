import { titleSuffix } from '../../src/utils/brand.mjs';
import { GENERATED_BEGIN, GENERATED_END } from '../autowriter-claims.mjs';
import { REGISTERS_BEGIN, REGISTERS_END, renderRegisters, spliceRegisters } from '../registers.mjs';
import { renderFamilies, spliceGenerated } from '../semantic-core.mjs';
import { siteBrand } from '../site-brand.mjs';

const SUFFIX = titleSuffix(siteBrand());

const rowOf = (family, route, query, name, description) => ({
  family,
  route,
  query,
  title: `${name}${SUFFIX}`,
  description,
  h1: name,
  links: 20,
  opening: '✓',
});

export const SCENE_ROWS = [
  rowOf('static', '/', 'scene home', 'Scene home', 'The home page of an invented scene.'),
  rowOf(
    'article',
    '/blog/how-to-stage-a-scene',
    'how to stage a scene',
    'How to stage a scene',
    'Stage a scene by naming its terms before anyone plays it.'
  ),
  rowOf(
    'term',
    '/glossary/scene-term',
    'scene term',
    'What is a scene term?',
    'A scene term is a word that only an invented scene defines.'
  ),
  rowOf(
    'term',
    '/glossary/scene-register',
    'scene register',
    'What is a scene register?',
    'A scene register lists every scene term with the route that defines it.'
  ),
];

export const SCENE_PROMPTS = [
  {
    number: 1,
    text: 'how to stage a scene',
    mustWin: '/blog/how-to-stage-a-scene',
    support: '/glossary/scene-term',
    passage: 'Stage a scene by naming its terms before anyone plays it.',
  },
  {
    number: 2,
    text: 'what is a scene term',
    mustWin: '/glossary/scene-term',
    support: '/blog/how-to-stage-a-scene',
    passage: 'A scene term is a word that only an invented scene defines.',
  },
  {
    number: 3,
    text: 'what is a scene register',
    mustWin: '/glossary/scene-register',
    support: '/glossary/scene-term',
    passage: 'A scene register lists every scene term with the route that defines it.',
  },
];

const promptBlock = ({ number, text, mustWin, support, passage }) =>
  [
    `**${number}. ${text}**`,
    `Must win: \`${mustWin}\`, support \`${support}\`.`,
    `Passage: "${passage}" (\`${mustWin}\`)`,
    'Why: an invented prompt, so a test has a buyer prompt to read.',
  ].join('\n');

const capitalised = (text) => `${text[0].toUpperCase()}${text.slice(1)}`;

const registersOf = (rows) => {
  const terms = rows.filter(({ family }) => family === 'term');
  return renderRegisters({
    entities: terms.map(({ query, route }) => ({ entity: capitalised(query), ownedBy: route, mentionedBy: [] })),
    concepts: terms.map(({ query, route, description }) => ({
      concept: capitalised(query),
      definedBy: route,
      definition: description,
    })),
    relationships: [],
  });
};

const skeleton = (prompts) => `# Semantic core

## Generated layer — the facts

${GENERATED_BEGIN}
${GENERATED_END}

## Hand-authored layer — the why

### The 30 buyer prompts (an invented set)

Protocol: check each prompt in the answer engines the owner names.

#### Starter prompts

${prompts.map(promptBlock).join('\n\n')}

### Registers — entities, concepts, relationships

${REGISTERS_BEGIN}
${REGISTERS_END}

### GAP register

No prompt is declared a gap yet.
`;

export const sceneCore = ({ rows = SCENE_ROWS, prompts = SCENE_PROMPTS } = {}) =>
  spliceRegisters(spliceGenerated(skeleton(prompts), renderFamilies(rows)), registersOf(rows));

export const SCENE_CORE = sceneCore();
