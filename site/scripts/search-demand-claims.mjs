const FENCE = /^\s{0,3}(```|~~~)/;
const BLOCK_START = /^\s*(?:[-*+]\s|\d+[.)]\s|>|\||#)/;
const LEADING_MARKS = /^(?:>\s*)*(?:(?:[-*+]|\d+[.)])\s+)?(?:\[[ xX]\]\s+)?(?:#+\s+)?/;
const SENTENCE_GAP = /(?<=[.!?])\s+/g;
const NUMBER = String.raw`#?\d{1,3}(?:\s*(?:to|[\u2013-])\s*#?\d{1,3})?`;
const CLAIM = new RegExp(
  String.raw`^prompts?\s+(${NUMBER}(?:\s*(?:,|&|and|/)\s*(?:and\s+)?${NUMBER})*)\s*(?:\([^)]*\)\s*)?` +
    String.raw`(?:(?:is|are|was|were|has been|have been)\s+(?:(?:now|already|finally|fully)\s+)*won|[:\u2013\u2014-]\s*won)` +
    String.raw`\b(?!['\u2019])`,
  'i'
);

function withoutCode(text) {
  let fence = null;
  return text
    .split('\n')
    .map((line) => {
      const marker = FENCE.exec(line)?.[1];
      if (fence) {
        if (marker === fence) fence = null;
        return '';
      }
      if (marker) {
        fence = marker;
        return '';
      }
      return line.replace(/`[^`]*`/g, '');
    })
    .join('\n');
}

function blocksOf(text) {
  const blocks = [];
  let open = null;
  withoutCode(text)
    .split('\n')
    .forEach((raw, index) => {
      const piece = { line: index + 1, text: raw.trim() };
      if (piece.text === '') open = null;
      else if (open && !BLOCK_START.test(raw)) open.pieces.push(piece);
      else blocks.push((open = { pieces: [piece] }));
    });
  return blocks;
}

function expand(listed) {
  return [...listed.matchAll(/#?(\d{1,3})(?:\s*(?:to|[\u2013-])\s*#?(\d{1,3}))?/g)].flatMap(([, from, to]) => {
    const first = Number(from);
    const last = to === undefined ? first : Number(to);
    return last >= first ? Array.from({ length: last - first + 1 }, (_, step) => first + step) : [first, last];
  });
}

export function wonClaims(text) {
  return blocksOf(text).flatMap(({ pieces }) => {
    const body = pieces
      .map((piece) => piece.text)
      .join(' ')
      .replaceAll('|', '.');
    const lineStarts = [];
    let offset = 0;
    for (const { line, text: piece } of pieces) {
      lineStarts.push({ offset, line });
      offset += piece.length + 1;
    }
    const starts = [0, ...[...body.matchAll(SENTENCE_GAP)].map((gap) => gap.index + gap[0].length)];
    return starts.flatMap((start, order) => {
      const sentence = body.slice(start, starts[order + 1]);
      const plain = (order === 0 ? sentence.replace(LEADING_MARKS, '') : sentence).replace(/[*_]/g, '').trim();
      const listed = CLAIM.exec(plain)?.[1];
      if (!listed) return [];
      return [{ line: lineStarts.findLast((piece) => piece.offset <= start).line, numbers: expand(listed) }];
    });
  });
}
