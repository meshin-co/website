import { readFileSync, writeFileSync } from 'node:fs';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

const fonts = [
  {
    name: 'IBM Plex Sans',
    data: readFileSync('src/assets/fonts/IBMPlexSans-Regular.ttf'),
    weight: 400,
    style: 'normal',
  },
];

const chip = (color, bg) => ({
  type: 'div',
  props: {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
      backgroundColor: bg,
    },
    children: [
      {
        type: 'div',
        props: {
          style: {
            display: 'flex',
            width: 620,
            height: 620,
            position: 'relative',
          },
          children: [
            ...[
              [290, 0, 60, 130],
              [190, 20, 60, 110],
              [410, 20, 60, 110],
              [290, 690, 60, 130],
              [190, 760, 60, 110],
              [410, 760, 60, 110],
            ].map(([x, y, w, h]) => ({
              type: 'div',
              props: {
                style: {
                  position: 'absolute',
                  left: x,
                  top: y,
                  width: w,
                  height: h,
                  backgroundColor: color,
                  borderRadius: 30,
                },
              },
            })),
            ...[
              [0, 290, 120, 60],
              [50, 200, 80, 55],
              [50, 465, 80, 55],
              [750, 290, 120, 60],
              [790, 200, 80, 55],
              [790, 465, 80, 55],
            ].map(([x, y, w, h]) => ({
              type: 'div',
              props: {
                style: {
                  position: 'absolute',
                  left: x,
                  top: y,
                  width: w,
                  height: h,
                  backgroundColor: color,
                  borderRadius: 30,
                },
              },
            })),
            {
              type: 'div',
              props: {
                style: {
                  position: 'absolute',
                  left: 120,
                  top: 120,
                  width: 630,
                  height: 630,
                  backgroundColor: color,
                  borderRadius: 85,
                },
              },
            },
            {
              type: 'div',
              props: {
                style: {
                  position: 'absolute',
                  left: 160,
                  top: 160,
                  width: 550,
                  height: 550,
                  backgroundColor: bg,
                  borderRadius: 55,
                },
              },
            },
            {
              type: 'div',
              props: {
                style: {
                  position: 'absolute',
                  left: 330,
                  top: 205,
                  width: 55,
                  height: 460,
                  backgroundColor: color,
                  borderRadius: 28,
                },
              },
            },
            {
              type: 'div',
              props: {
                style: {
                  position: 'absolute',
                  left: 200,
                  top: 280,
                  width: 80,
                  height: 70,
                  backgroundColor: color,
                  borderRadius: 14,
                },
              },
            },
            {
              type: 'div',
              props: {
                style: {
                  position: 'absolute',
                  left: 200,
                  top: 500,
                  width: 80,
                  height: 80,
                  backgroundColor: color,
                  borderRadius: 14,
                },
              },
            },
          ],
        },
      },
    ],
  },
});

async function render(size, color, bg) {
  const svg = await satori(chip(color, bg), { width: 870, height: 870, fonts });
  return Buffer.from(new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng());
}

writeFileSync('src/assets/favicons/apple-touch-icon.png', await render(180, '#000000', '#f7f7f7'));

const png16 = await render(16, '#000000', 'rgba(0,0,0,0)');
const png32 = await render(32, '#000000', 'rgba(0,0,0,0)');
const png48 = await render(48, '#000000', 'rgba(0,0,0,0)');

function ico(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);
  let offset = 6 + entries.length * 16;
  const dir = entries.map(({ size, png }) => {
    const e = Buffer.alloc(16);
    e[0] = size >= 256 ? 0 : size;
    e[1] = size >= 256 ? 0 : size;
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += png.length;
    return e;
  });
  return Buffer.concat([header, ...dir, ...entries.map((e) => e.png)]);
}
writeFileSync(
  'src/assets/favicons/favicon.ico',
  ico([
    { size: 16, png: png16 },
    { size: 32, png: png32 },
    { size: 48, png: png48 },
  ])
);
console.log('icons written');
