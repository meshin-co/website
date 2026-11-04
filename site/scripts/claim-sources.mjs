export const PRIMARY_DOMAINS = ['nist.gov', 'iso.org', 'eur-lex.europa.eu', 'europa.eu', 'owasp.org', 'iec.ch'];

const GENERAL_FACT =
  /\d|\b[Pp]er ?cent\b|\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\b/;

const STANDARD_REFERENCES = [
  /\b(?:ISO|IEC|IEEE|NIST|OWASP|ENISA|EDPB)\b/,
  /\b(?:GDPR|CCPA|CPRA|HIPAA|FedRAMP|NIS2|DORA)\b/,
  /\bSOC [123]\b|\bPCI DSS\b/,
  /\bAI Act\b/,
  /\b(?:Regulation|Directive)\s+(?:\(\w+\)|\d)/,
  /\b(?:Articles?|Annex(?:es)?)\s+(?:\d|[IVX]+\b)/,
];

const isStandardSentence = (sentence) => STANDARD_REFERENCES.some((pattern) => pattern.test(sentence));

const isFactual = (sentence) => GENERAL_FACT.test(sentence) || isStandardSentence(sentence);

export const factualSentences = (sentences) => sentences.filter(isFactual);

const present = (value) => typeof value === 'string' && value.trim() !== '';

const sourceIdOf = (claim) => claim.sourceId ?? claim.source?.id;

export const citedAddress = (source) => source.original ?? source.url;

const hostOf = (url) => (URL.canParse(url) ? new URL(url).hostname : null);

const onPrimaryDomain = (url) => {
  const host = hostOf(url);
  return host !== null && PRIMARY_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
};

const hostsOf = (sources) => sources.map((source) => hostOf(citedAddress(source)) ?? citedAddress(source)).join(', ');

const sourceMap = (sources) => new Map(sources.map((source) => [source.id, source]));

function rowProblems(claim, { known, sentences }) {
  const found = [];
  const add = (rule, detail) => found.push({ rule, sentence: claim.sentence, detail });
  const sourceId = sourceIdOf(claim);

  if (!sentences.includes(claim.sentence))
    add('sentence-not-in-entry', 'the row quotes a sentence that does not occur verbatim in the entry');

  if (claim.marker === 'own-reading' && (present(claim.sourceId) || claim.source != null || present(claim.span)))
    add('own-reading-with-source', 'an own-reading row carries no source and no span');

  if (claim.marker === 'sourced') {
    if (!present(sourceId)) add('sourced-without-source', 'a sourced row must name exactly one source');
    else if (!known.has(sourceId))
      add('source-unresolved', `source ${sourceId} is not among the entry's sources (${[...known.keys()].join(', ')})`);
    if (!present(claim.span)) add('span-missing', 'a sourced row must quote the span of the source it rests on');
  }
  return found;
}

function standardProblem(sentence, resolved) {
  if (!isStandardSentence(sentence) || resolved.length === 0) return null;
  if (resolved.some((source) => onPrimaryDomain(citedAddress(source)))) return null;
  return (
    `the sentence is about a standard or regulation and its source (${hostsOf(resolved)}) ` +
    `is not on a primary domain (${PRIMARY_DOMAINS.join(', ')})`
  );
}

function factProblems({ claims, known, sentences }) {
  const found = [];
  for (const sentence of new Set(factualSentences(sentences))) {
    const rows = claims.filter((claim) => claim.sentence === sentence);
    const add = (rule, detail) => found.push({ rule, sentence, detail });

    if (rows.length === 0) add('fact-unbound', 'the sentence asserts a fact and the table binds it to nothing');
    else if (rows.some((row) => row.marker !== 'sourced'))
      add('fact-unbound', "the sentence asserts a fact and the table marks it as the author's own reading");
    else {
      const detail = standardProblem(sentence, rows.map((row) => known.get(sourceIdOf(row))).filter(Boolean));
      if (detail !== null) add('standard-without-primary-source', detail);
    }
  }
  return found;
}

export function claimTableProblems({ claims, sources, sentences }) {
  const known = sourceMap(sources);
  return [
    ...claims.flatMap((claim) => rowProblems(claim, { known, sentences })),
    ...factProblems({ claims, known, sentences }),
  ];
}

function resolvedSource(known, id) {
  const source = known.get(id);
  if (!source) throw new Error(`source ${id} is not among the entry's sources`);
  return { id, title: source.title, url: source.url };
}

export function resolveClaimTable({ claims, sources }) {
  const known = sourceMap(sources);
  return claims.map(({ sentence, marker, sourceId, span }) =>
    marker === 'sourced'
      ? { sentence, marker, source: resolvedSource(known, sourceId), span }
      : { sentence, marker, source: null, span: null }
  );
}
