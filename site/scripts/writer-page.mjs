import { entryRoute, termOf, writtenFormat } from './entry-files.mjs';
import { escapeHtml, renderMarkdown } from './writer-markdown.mjs';

export const PAGE_TEMPLATES = {
  article: {
    sections: {
      answer: 'The short answer',
      takeaways: 'What to remember',
      detail: 'The long version',
      faq: 'What people ask',
      provenance: 'Where this comes from',
    },
  },
  term: {
    sections: { definition: 'What it means', detail: 'In practice', provenance: 'Sources and neighbours' },
  },
};

const PARAGRAPH_BREAK = /\n{2,}/;

const paragraph = (text) => `<p>${escapeHtml(text)}</p>`;
const answerBlock = (question, answer) => `<div data-answer><h2>${escapeHtml(question)}</h2>${paragraph(answer)}</div>`;
const section = (title, inner) => `<section><h2>${title}</h2>${inner}</section>`;
const published = (day) =>
  `<p data-gate-ignore>Published <time datetime="${day}">${day}</time> · Updated <time datetime="${day}">${day}</time></p>`;

const sourceList = (sources) =>
  `<section><h2>Sources</h2><ol>${sources
    .map(
      ({ title, url, publisher }) =>
        `<li><a href="${escapeHtml(url)}">${escapeHtml(title)}</a><p data-gate-ignore>${escapeHtml(publisher)}</p></li>`
    )
    .join('')}</ol></section>`;

const takeaways = (points) =>
  `<aside><p>Key takeaways</p><ul data-takeaways>${points
    .map((point) => `<li><span></span><span>${escapeHtml(point)}</span></li>`)
    .join('')}</ul></aside>`;

const questions = (faq) =>
  faq.map(({ q, a }) => `<details><summary><h3>${escapeHtml(q)}</h3></summary>${paragraph(a)}</details>`).join('');

export const headingOf = (claim) => (claim.format === 'term' ? termOf(claim.title) : claim.title);

function articleBody({ claim, draft, runDate }) {
  const { sections } = PAGE_TEMPLATES.article;
  const { fields } = draft;
  const faq = fields.faq.length > 0 ? section(sections.faq, questions(fields.faq)) : '';
  return [
    `<section><h1>${escapeHtml(headingOf(claim))}</h1><p data-gate-lead>${escapeHtml(fields.description)}</p></section>`,
    section(
      sections.answer,
      `${answerBlock(claim.title, fields.shortAnswer)}<p data-gate-lead>${escapeHtml(fields.fullAnswer)}</p>${published(runDate)}`
    ),
    section(sections.takeaways, takeaways(fields.keyTakeaways)),
    section(sections.detail, `<div>${renderMarkdown(draft.body)}</div>`),
    faq,
    section(sections.provenance, sourceList(draft.sources)),
  ].join('');
}

function termBody({ claim, draft, runDate }) {
  const { sections } = PAGE_TEMPLATES.term;
  const { fields } = draft;
  const definition = fields.definition.split(PARAGRAPH_BREAK).map(paragraph).join('');
  return [
    `<section><h1>${escapeHtml(headingOf(claim))}</h1></section>`,
    section(
      sections.definition,
      `${answerBlock(claim.title, fields.shortDefinition)}${definition}${published(runDate)}`
    ),
    section(sections.detail, `<div>${renderMarkdown(draft.body)}</div>`),
    section(sections.provenance, sourceList(draft.sources)),
  ].join('');
}

const BODIES = { article: articleBody, term: termBody };

export function entryPage({ claim, draft, runDate }) {
  const profile = writtenFormat(claim.format);
  const main = BODIES[profile]({ claim, draft, runDate });
  return {
    route: entryRoute(claim),
    profile,
    html: `<html><body><main><article>${main}</article></main></body></html>`,
  };
}
