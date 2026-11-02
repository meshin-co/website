export const CARRY_SHARE = 0.5;
export const CARRY_SHARE_WHOLE_ENTRY = 0.34;

const SMALLEST_WORD = 3;
const WORD = /[\p{L}\p{N}]+/gu;
const HAS_DIGIT = /\d/;
const SUFFIXES = [
  ['ies', 'y'],
  ['ing', ''],
  ['ed', ''],
  ['es', ''],
  ['s', ''],
];
const SMALL_WORDS = new Set(
  `about above after again all also and any are because been before being below between both but can could did
  does doing down during each few for from further had has have her here him his how into its just more most nor
  not now once only other our out over own same she should some such than that the their them then there these
  they this those through too under until very was were what when where which while who why will with would you
  your`.split(/\s+/)
);

function baseOf(word) {
  const [suffix, replacement] = SUFFIXES.find(
    ([ending]) => word.length > ending.length + 2 && word.endsWith(ending)
  ) ?? ['', ''];
  const stripped = suffix === '' ? word : `${word.slice(0, -suffix.length)}${replacement}`;
  return stripped.length > SMALLEST_WORD && stripped.endsWith('e') ? stripped.slice(0, -1) : stripped;
}

const isContent = (word) => (word.length >= SMALLEST_WORD || HAS_DIGIT.test(word)) && !SMALL_WORDS.has(word);

export const contentWords = (sentence) =>
  new Set(
    (sentence.toLowerCase().match(WORD) ?? [])
      .filter(isContent)
      .map((word) => (HAS_DIGIT.test(word) ? word : baseOf(word)))
  );

const shared = (left, right) => [...left].filter((word) => right.has(word)).length;

function windowsOf(blocks) {
  return blocks.flatMap((block) => {
    const sets = block.map(contentWords);
    const pairs = sets.slice(1).map((set, at) => new Set([...sets[at], ...set]));
    return [...sets, ...pairs];
  });
}

const isCarried = (needed, windows, share) =>
  needed.size === 0 || windows.some((window) => shared(needed, window) / needed.size >= share);

export function uncarried({ before, after, share }) {
  const windows = windowsOf(after);
  return before.filter((sentence) => !isCarried(contentWords(sentence), windows, share));
}
