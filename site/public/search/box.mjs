import { excerptFor, rankEntries } from '/search/index-model.mjs';

const MAXIMUM_RESULTS = 20;
const PROMPT = 'Type a word and press Search.';

const form = document.querySelector('[data-search]');
const input = document.querySelector('#search-query');
const summary = document.querySelector('[data-search-summary]');
const list = document.querySelector('[data-search-results]');

let index;

async function load() {
  index ??= await fetch('/search-index.json').then((response) => response.json());
  return index;
}

function summarise(query, count) {
  if (count === 0) return `No pages match “${query}”.`;
  if (count === 1) return `1 page matches “${query}”.`;
  return `${count} pages match “${query}”.`;
}

function render(entries, query) {
  list.replaceChildren(
    ...entries.map((entry) => {
      const item = document.createElement('li');
      item.className = 'bg-page p-6';

      const kind = document.createElement('p');
      kind.className = 'eyebrow';
      kind.textContent = entry.kind;

      const link = document.createElement('a');
      link.className = 'text-link mt-3 block font-heading text-lg font-semibold';
      link.href = entry.href;
      link.textContent = entry.title;

      const text = document.createElement('p');
      text.className = 'mt-2 max-w-[68ch] text-muted';
      text.textContent = excerptFor(entry, query);

      item.append(kind, link, text);
      return item;
    })
  );
}

async function run(query) {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    list.replaceChildren();
    summary.textContent = PROMPT;
    return;
  }

  summary.textContent = `Searching for “${trimmed}”…`;

  try {
    const ranked = rankEntries(await load(), trimmed);
    render(ranked.slice(0, MAXIMUM_RESULTS), trimmed);
    summary.textContent = summarise(trimmed, ranked.length);
  } catch {
    list.replaceChildren();
    summary.textContent = 'Search is unavailable right now. The writing, glossary and resource pages list everything.';
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const url = new URL(window.location.href);
  url.searchParams.set('q', input.value);
  window.history.replaceState(null, '', url);
  run(input.value);
});

input.addEventListener('input', () => {
  if (input.value.trim().length === 0) run('');
});

const initial = new URL(window.location.href).searchParams.get('q');
if (initial) {
  input.value = initial;
  run(initial);
}
