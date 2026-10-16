export const REGISTERS_BEGIN = '<!-- REGISTERS:BEGIN -->';
export const REGISTERS_END = '<!-- REGISTERS:END -->';

const escape = (term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const mentions = (text, term) => new RegExp(`(^|[^\\w-])${escape(term)}(?![\\w-])`, 'i').test(text ?? '');

export function prosePassages(html) {
  const withoutCode = html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]>/gi, ' ');
  return [...withoutCode.matchAll(/<(p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map((match) => match[2].replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, ' '))
    .map((passage) =>
      passage
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .join(' ');
}

export function entityRegister(terms, pages) {
  return terms.map((entry) => ({
    entity: entry.term,
    ownedBy: entry.route,
    mentionedBy: pages
      .filter((page) => page.route !== entry.route && mentions(page.text, entry.term))
      .map((page) => page.route),
  }));
}

export function conceptRegister(terms) {
  return terms.map((entry) => ({
    concept: entry.term,
    definedBy: entry.route,
    definition: entry.shortDefinition,
  }));
}

export function relationshipPairs(terms) {
  const bySlug = new Map(terms.map((entry) => [entry.slug, entry.term]));
  return terms.flatMap((entry) =>
    (entry.relatedTerms ?? []).map((slug) => {
      const target = bySlug.get(slug);
      if (!target) throw new Error(`relatedTerms names a term that does not exist: ${slug} (in ${entry.route})`);
      return { from: entry.term, kind: 'related-concept', to: target };
    })
  );
}

export function undefinedConceptFindings(concepts, pages) {
  return concepts.flatMap((concept) =>
    pages
      .filter(
        (page) =>
          page.route !== concept.definedBy &&
          mentions(page.prose, concept.concept) &&
          !page.hrefs.includes(concept.definedBy)
      )
      .map((page) => ({ route: page.route, concept: concept.concept, definedBy: concept.definedBy }))
  );
}

const cells = (row) => row.replace(/^\| ?/, '').replace(/ ?\|$/, '').split(' | ');

const table = (header, rows) => {
  const grid = [header, ...rows.map(cells)];
  const widths = header.map((_, column) => Math.max(3, ...grid.map((row) => row[column].length)));
  const line = (row) => `| ${row.map((cell, column) => cell.padEnd(widths[column])).join(' | ')} |`;
  return [line(header), `| ${widths.map((width) => '-'.repeat(width)).join(' | ')} |`, ...grid.slice(1).map(line)].join(
    '\n'
  );
};

export function renderRegisters({ entities, concepts, relationships }) {
  const entityRows = entities.map(
    (entry) => `| ${entry.entity} | \`${entry.ownedBy}\` | ${entry.mentionedBy.length} |`
  );
  const conceptRows = concepts.map((entry) => `| ${entry.concept} | \`${entry.definedBy}\` | ${entry.definition} |`);
  const relationshipRows = relationships.map((entry) => `| ${entry.from} | ${entry.kind} | ${entry.to} |`);

  return [
    `#### Entity register (${entities.length})`,
    '',
    'One owning route per entity. The mention count is inbound references from other routes.',
    '',
    table(['Entity', 'Owned by', 'Mentioned by'], entityRows),
    '',
    `#### Concept register (${concepts.length})`,
    '',
    'A concept is defined on exactly one page. Every other page links to it rather than redefining it.',
    '',
    table(['Concept', 'Defined by', 'Definition'], conceptRows),
    '',
    `#### Topic relationships (${relationships.length})`,
    '',
    'Declared in the content, never inferred here.',
    '',
    table(['From', 'Kind', 'To'], relationshipRows),
  ].join('\n');
}

export function registerDriftFindings(committedDoc, freshBlock) {
  const begin = committedDoc.indexOf(REGISTERS_BEGIN);
  const end = committedDoc.indexOf(REGISTERS_END);
  if (begin === -1 || end === -1) return [{ rule: 'registers-markers-missing', detail: 'docs/SEMANTIC-CORE.md' }];

  const committed = committedDoc.slice(begin + REGISTERS_BEGIN.length, end).trim();
  return committed === freshBlock.trim()
    ? []
    : [{ rule: 'registers-drift', detail: 'run npm run assets:registers and commit the result' }];
}

export function spliceRegisters(doc, block) {
  const begin = doc.indexOf(REGISTERS_BEGIN);
  const end = doc.indexOf(REGISTERS_END);
  if (begin === -1 || end === -1) throw new Error('registers markers missing from docs/SEMANTIC-CORE.md');
  return `${doc.slice(0, begin + REGISTERS_BEGIN.length)}\n${block}\n${doc.slice(end)}`;
}
