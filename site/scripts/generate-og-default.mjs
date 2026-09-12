import { readFileSync, statSync, writeFileSync } from 'node:fs';
import yaml from 'js-yaml';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

const WIDTH = 1200;
const HEIGHT = 630;
const INSET = 32;
const BACKGROUND = '#faf9f6';
const BORDER_COLOR = '#e6e3dc';
const INK = '#16181c';
const MUTED = '#6b665e';
const BRAND = '#0f5f5c';
const TITLE = 'meshin.co — Fractional Chief AI Officer';
const OUTPUT = 'src/assets/images/og-default.png';
const { metadata } = yaml.load(readFileSync('src/config.yaml', 'utf8'));

const description = metadata?.description;
if (!description) throw new Error('src/config.yaml has no metadata.description to render in the footer');

const div = (style, children) => ({ type: 'div', props: { style, children } });

const tree = div(
  { width: WIDTH, height: HEIGHT, display: 'flex', backgroundColor: BACKGROUND, padding: INSET },
  div(
    {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      border: `1px solid ${BORDER_COLOR}`,
      padding: INSET,
    },
    [
      div({ display: 'flex', flexDirection: 'column' }, [
        div(
          {
            fontFamily: 'Fraunces',
            fontSize: 68,
            fontWeight: 600,
            lineHeight: 1.15,
            color: INK,
          },
          TITLE
        ),
        div({ display: 'flex', width: 96, height: 6, backgroundColor: BRAND, marginTop: 36 }, ''),
      ]),
      div(
        { display: 'flex', marginTop: 48, fontFamily: 'IBM Plex Sans', fontSize: 20, color: MUTED, lineHeight: 1.4 },
        description
      ),
    ]
  )
);

const fonts = [
  { name: 'Fraunces', data: readFileSync('src/assets/fonts/Fraunces-SemiBold.ttf'), weight: 600, style: 'normal' },
  {
    name: 'IBM Plex Sans',
    data: readFileSync('src/assets/fonts/IBMPlexSans-Regular.ttf'),
    weight: 400,
    style: 'normal',
  },
];

const svg = await satori(tree, { width: WIDTH, height: HEIGHT, fonts });
const png = new Resvg(svg).render().asPng();
writeFileSync(OUTPUT, png);
console.log(`${OUTPUT} ${statSync(OUTPUT).size} bytes`);
