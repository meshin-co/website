import { readFileSync, writeFileSync } from 'node:fs';

import { Resvg } from '@resvg/resvg-js';

const mark = readFileSync('public/logo.svg', 'utf8');

const framed = (ink, background) => {
  const pad = 46;
  const box = 610 + pad * 2;
  const art = mark
    .replace(/<\?xml[^>]*\?>/, '')
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replaceAll('#16181c', ink);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${95 - pad} ${105 - pad} ${box} ${box}" width="${box}" height="${box}">${
    background ? `<rect x="${95 - pad}" y="${105 - pad}" width="${box}" height="${box}" fill="${background}"/>` : ''
  }${art}</svg>`;
};

const render = (size, ink, background) =>
  Buffer.from(new Resvg(framed(ink, background), { fitTo: { mode: 'width', value: size } }).render().asPng());

writeFileSync('src/assets/favicons/favicon.svg', framed('#16181c', null));
writeFileSync('src/assets/favicons/apple-touch-icon.png', render(180, '#16181c', '#fbfaf7'));

const ico = (entries) => {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);
  let offset = 6 + entries.length * 16;
  const dir = entries.map(({ size, png }) => {
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size;
    entry[1] = size >= 256 ? 0 : size;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });
  return Buffer.concat([header, ...dir, ...entries.map((e) => e.png)]);
};

writeFileSync(
  'src/assets/favicons/favicon.ico',
  ico([16, 32, 48].map((size) => ({ size, png: render(size, '#16181c', null) })))
);

for (const [name, ink] of [
  ['logo-dark', '#16181c'],
  ['logo-light', '#f4f2ee'],
]) {
  writeFileSync(`public/brand/${name}-1024.png`, render(1024, ink, null));
  writeFileSync(`public/brand/${name}-512.png`, render(512, ink, null));
}

console.log('icons and social marks written from public/logo.svg');
