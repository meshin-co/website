import { createSearch } from '/search/index-model.mjs';
import { summaryLine } from '/search/shards.mjs';

const PROMPT = 'Type a word and press Search.';

const form = document.querySelector('[data-search]');
const input = document.querySelector('#search-query');
const summary = document.querySelector('[data-search-summary]');
const list = document.querySelector('[data-search-results]');

const search = createSearch(async (path) => {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path} ${response.status}`);
  return response.json();
});

function render(rows) {
  list.replaceChildren(
    ...rows.map((row) => {
      const item = document.createElement('li');
      item.className = 'bg-page p-6';

      const kind = document.createElement('p');
      kind.className = 'eyebrow';
      kind.textContent = row.kind;

      const link = document.createElement('a');
      link.className = 'text-link mt-3 block font-heading text-lg font-semibold';
      link.href = row.href;
      link.textContent = row.title;

      const text = document.createElement('p');
      text.className = 'mt-2 max-w-[68ch] text-muted';
      text.textContent = row.description;

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
    const { kinds, rows } = await search(trimmed);
    render(rows);
    summary.textContent = summaryLine(kinds, trimmed);
  } catch {
    list.replaceChildren();
    summary.textContent = 'Search is unavailable right now. The FAQ, writing and glossary pages list everything.';
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
