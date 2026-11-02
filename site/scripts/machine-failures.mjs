const RULE_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

const isStringList = (value) => Array.isArray(value) && value.every((item) => typeof item === 'string');

function entryOf(rule, text, subjects) {
  if (typeof rule !== 'string' || !RULE_ID.test(rule)) {
    throw new TypeError(`a failure needs a lowercase-hyphenated rule id, not ${JSON.stringify(rule)}`);
  }
  if (typeof text !== 'string') throw new TypeError(`the failure ${rule} needs its text as a string`);
  if (!isStringList(subjects)) throw new TypeError(`the failure ${rule} needs its subjects as a list of strings`);
  return { rule, text, subjects: [...subjects] };
}

export function createFailureLog() {
  const entries = [];

  return {
    add(rule, text, subjects = []) {
      entries.push(entryOf(rule, text, subjects));
    },
    addAll(rule, texts, subjects = []) {
      if (!Array.isArray(texts)) throw new TypeError(`the failures of ${rule} need their texts as a list`);
      for (const entry of texts.map((text) => entryOf(rule, text, subjects))) entries.push(entry);
    },
    texts: () => entries.map(({ text }) => text),
    records: () =>
      entries.map(({ rule, text, subjects }) => ({ rule, subjects: [...subjects], detail: text, excerpt: '' })),
    get size() {
      return entries.length;
    },
  };
}
