const WIDTH = 1200;
const HEIGHT = 630;
const INSET = 32;
const BACKGROUND = '#faf9f6';
const BORDER_COLOR = '#e6e3dc';
const INK = '#16181c';
const MUTED = '#6b665e';
const BRAND = '#0f5f5c';
const BRAND_TEXT = 'meshin.co';
const SERIF_FONT = 'Fraunces';
const SANS_FONT = 'IBM Plex Sans';

function div(style, children) {
  return { type: 'div', props: { style, children } };
}

export function buildOgTree({ title, eyebrow, footer }) {
  const heading = [];
  if (eyebrow) {
    heading.push(
      div(
        {
          fontFamily: SANS_FONT,
          fontSize: 22,
          textTransform: 'uppercase',
          letterSpacing: 3,
          color: MUTED,
        },
        eyebrow
      )
    );
  }
  heading.push(
    div(
      {
        display: 'block',
        marginTop: eyebrow ? 28 : 0,
        fontFamily: SERIF_FONT,
        fontSize: 64,
        fontWeight: 600,
        lineHeight: 1.15,
        color: INK,
        lineClamp: 3,
      },
      title
    )
  );

  const footerRow = [];
  if (footer) {
    footerRow.push(div({ display: 'flex', flex: 1, color: MUTED, lineHeight: 1.4, lineClamp: 2 }, footer));
  }
  footerRow.push(div({ display: 'flex', color: BRAND, marginLeft: 40 }, BRAND_TEXT));

  return div(
    {
      width: WIDTH,
      height: HEIGHT,
      display: 'flex',
      backgroundColor: BACKGROUND,
      padding: INSET,
    },
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
        div({ display: 'flex', flexDirection: 'column' }, heading),
        div(
          {
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            marginTop: 48,
            fontFamily: SANS_FONT,
            fontSize: 20,
          },
          footerRow
        ),
      ]
    )
  );
}

export function collectText(node) {
  if (node == null || typeof node === 'boolean') return [];
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(collectText);
  if (typeof node === 'object' && 'props' in node) return collectText(node.props.children);
  return [];
}
