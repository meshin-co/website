const TEASER_MAX_CHARS = 140;
const DUPLICATE_SENTENCE_FLOOR_WORDS = 12;

export function firstSentence(text) {
  const trimmed = text.trim();
  const match = /^[\s\S]*?[.!?](?=\s|$)/.exec(trimmed);
  return match ? match[0] : trimmed;
}

export function teaser(answer) {
  const sentence = firstSentence(answer);
  const words = sentence.split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';

  if (words.length < DUPLICATE_SENTENCE_FLOOR_WORDS && sentence.length <= TEASER_MAX_CHARS) return sentence;

  const kept = [];
  for (const word of words) {
    if (kept.length === DUPLICATE_SENTENCE_FLOOR_WORDS - 1) break;
    if (kept.length > 0 && `${kept.join(' ')} ${word}.`.length > TEASER_MAX_CHARS) break;
    kept.push(word);
  }
  return `${kept.join(' ').replace(/[,;:.!?]+$/, '')}.`;
}

const TITLE_SUFFIX = ' — meshin.co';
const TITLE_MAX_CHARS = 70;

export function pageTitle(question) {
  const room = TITLE_MAX_CHARS - TITLE_SUFFIX.length;
  if (question.length <= room) return question;
  const kept = question.slice(0, room).split(' ').slice(0, -1);
  return `${kept.join(' ').replace(/[,;:.!?]+$/, '')}…`;
}

export function faqMetadata({ question, answer, publishDate, updatedDate }) {
  return {
    title: pageTitle(question),
    description: teaser(answer),
    openGraph: {
      type: 'article',
      article: {
        publishedTime: publishDate.toISOString(),
        modifiedTime: updatedDate.toISOString(),
      },
    },
  };
}
