import { readFileSync, writeFileSync } from 'node:fs';
import { invokedDirectly } from './invoked-directly.mjs';

export const geometry = JSON.parse(readFileSync(new URL('./logo-geometry.json', import.meta.url), 'utf8'));
const { centre, outerRadius, innerRadius, arcEnd, tailEnd, wedgeStep, viewBox, star, ramp } = geometry;

const paperGreyAt = (deg) => {
  if (deg >= arcEnd) {
    const start = ramp[arcEnd];
    const t = Math.min(1, (deg - arcEnd) / (tailEnd - arcEnd));
    return start + t * (255 - start);
  }
  const low = Math.floor(deg);
  const high = Math.min(arcEnd, Math.ceil(deg));
  return ramp[low] + (deg - low) * (ramp[high] - ramp[low]);
};

export const maskGreyAt = (deg) => Math.max(0, Math.min(255, Math.round(255 - paperGreyAt(deg))));

export function wedgeSpans(step = wedgeStep) {
  const spans = [];
  for (let from = 0; from < tailEnd; from += step) {
    const to = Math.min(from + step, tailEnd);
    const overlap = Math.min(0.35, step / 6);
    spans.push({
      from,
      to,
      paintedFrom: Math.max(-overlap, from - overlap),
      paintedTo: Math.min(tailEnd + overlap, to + overlap),
    });
  }
  return spans;
}

const hex = (grey) => `#${grey.toString(16).padStart(2, '0').repeat(3)}`;
const pointAt = (radius, deg) => {
  const rad = (deg * Math.PI) / 180;
  return [+(centre.x + radius * Math.cos(rad)).toFixed(2), +(centre.y + radius * Math.sin(rad)).toFixed(2)];
};

const sweptRing = () => {
  const [ox, oy] = pointAt(outerRadius, 0);
  const [ex, ey] = pointAt(outerRadius, tailEnd);
  const [ix, iy] = pointAt(innerRadius, tailEnd);
  const [sx, sy] = pointAt(innerRadius, 0);
  return `M${ox} ${oy}A${outerRadius} ${outerRadius} 0 1 1 ${ex} ${ey}L${ix} ${iy}A${innerRadius} ${innerRadius} 0 1 0 ${sx} ${sy}Z`;
};

export function renderMark({ ink, prefix, step = wedgeStep, indent = '', jsx = false }) {
  const id = (name) => (jsx ? `id={\`${prefix}${name}\`}` : `id="${prefix}${name}"`);
  const ref = (attribute, name) =>
    jsx ? `${attribute}={\`url(#${prefix}${name})\`}` : `${attribute}="url(#${prefix}${name})"`;
  const spans = wedgeSpans(step);
  const mid = (outerRadius + innerRadius) / 2;
  const gradients = spans.map((span, index) => {
    const [x1, y1] = pointAt(mid, span.from);
    const [x2, y2] = pointAt(mid, span.to);
    return `${indent}<linearGradient ${id(`w${index}`)} gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${hex(maskGreyAt(span.from))}"/><stop offset="1" stop-color="${hex(maskGreyAt(span.to))}"/></linearGradient>`;
  });
  const wedges = spans.map((span, index) => {
    const [x1, y1] = pointAt(outerRadius, span.paintedFrom);
    const [x2, y2] = pointAt(outerRadius, span.paintedTo);
    const [x3, y3] = pointAt(innerRadius, span.paintedTo);
    const [x4, y4] = pointAt(innerRadius, span.paintedFrom);
    return `${indent}<path d="M${x1} ${y1}A${outerRadius} ${outerRadius} 0 0 1 ${x2} ${y2}L${x3} ${y3}A${innerRadius} ${innerRadius} 0 0 0 ${x4} ${y4}Z" ${ref('fill', `w${index}`)}/>`;
  });
  const [x, y, width, height] = viewBox.split(' ');
  return [
    `${indent}<defs>`,
    gradients.join('\n'),
    `${indent}<mask ${id('ramp')} maskUnits="userSpaceOnUse" x="${x}" y="${y}" width="${width}" height="${height}">`,
    wedges.join('\n'),
    `${indent}</mask>`,
    `${indent}</defs>`,
    `${indent}<path d="${sweptRing()}" fill="${ink}" ${ref('mask', 'ramp')}/>`,
    `${indent}<path d="${star}" fill="${ink}"/>`,
  ].join('\n');
}

const standalone = (ink) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="610" height="610" role="img" aria-label="Fractional CAIO">
<title>Fractional CAIO</title>
${renderMark({ ink, prefix: 's-' })}
</svg>
`;

export const renderSymbol = () =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" class="logo-symbol" aria-hidden="true" focusable="false">
<symbol id="logo-mark" viewBox="${viewBox}">
${renderMark({ ink: 'currentColor', prefix: 'logo-' })}
</symbol>
</svg>
`;

export const renderUse = () => `<use href="#logo-mark" />`;

export const referenceViewBox = () => {
  const [, , width, height] = viewBox.split(' ');
  return `0 0 ${width} ${height}`;
};

const symbolComponent = () => `---
---

${renderSymbol()}`;

const component = () => `---
interface Props {
  class?: string;
}

const { class: className = 'h-8 w-8' } = Astro.props;
---

<svg class={className} viewBox="${referenceViewBox()}" role="img" aria-hidden="true" focusable="false">
  ${renderUse()}
</svg>
`;

function main() {
  writeFileSync('src/components/common/LogoMark.astro', component());
  writeFileSync('src/components/common/LogoSymbol.astro', symbolComponent());
  writeFileSync('public/logo.svg', standalone('#16181c'));
  writeFileSync('public/brand/logo-on-dark.svg', standalone('#f4f2ee'));
  console.log(`logo written: ${wedgeSpans().length} graduations at ${wedgeStep} degrees`);
}

if (invokedDirectly(import.meta.filename, process.argv[1])) main();
