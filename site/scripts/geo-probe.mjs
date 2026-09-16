const OUR_HOSTS = ['meshin.co'];
const OUR_NAMES = [/\bmeshin\.co\b/i, /\bDmitri\s+Meshin\b/i];

const PROVIDERS = [
  { id: 'openai', keyName: 'OPENAI_API_KEY', model: 'gpt-5', retrieval: 'web_search tool' },
  { id: 'anthropic', keyName: 'ANTHROPIC_API_KEY', model: 'claude-sonnet-4-5-20250929', retrieval: 'web_search tool' },
  { id: 'gemini', keyName: 'GEMINI_API_KEY', model: 'gemini-flash-latest', retrieval: 'google_search grounding' },
  { id: 'sonar', keyName: 'OPENROUTER_API_KEY', model: 'perplexity/sonar', retrieval: 'native search' },
];

const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
};

const isOurs = (url) => {
  const host = hostOf(url);
  return OUR_HOSTS.some((ours) => host === ours || host.endsWith(`.${ours}`));
};

const REDIRECT_HOSTS = ['vertexaisearch.cloud.google.com'];

export function classify({ text, citations }) {
  const retrieved = (citations ?? []).length > 0;
  const ourCitations = (citations ?? []).filter(isOurs);
  if (ourCitations.length > 0) return { status: 'cited', ourCitations, retrieved };
  if (OUR_NAMES.some((pattern) => pattern.test(text ?? '')))
    return { status: 'mentioned', ourCitations: [], retrieved };
  return { status: 'absent', ourCitations: [], retrieved };
}

export async function resolveCitationHosts(citations, resolver) {
  return Promise.all(
    (citations ?? []).map(async (url) => {
      if (!REDIRECT_HOSTS.includes(hostOf(url))) return url;
      try {
        return (await resolver(url)) || url;
      } catch {
        return url;
      }
    })
  );
}

export function competitorHosts(citations) {
  const hosts = (citations ?? [])
    .filter((url) => !isOurs(url))
    .map(hostOf)
    .filter(Boolean);
  return [...new Set(hosts)];
}

export function providerRoster(env) {
  return PROVIDERS.map(({ id, keyName, model, retrieval }) => ({
    id,
    keyName,
    model,
    retrieval,
    available: Boolean(env[keyName]),
  }));
}

export function renderProbe(rows) {
  const providers = [...new Set(rows.map((row) => row.provider))].sort();
  const counts = providers.map((provider) => {
    const mine = rows.filter((row) => row.provider === provider);
    const tally = (status) => mine.filter((row) => row.status === status).length;
    const searched = mine.filter((row) => row.retrieved).length;
    return `| ${provider} | cited: ${tally('cited')} | mentioned: ${tally('mentioned')} | absent: ${tally('absent')} | searched the web: ${searched} of ${mine.length} |`;
  });

  const lost = rows.filter((row) => row.status === 'absent');

  return [
    '# GEO probe — measured answers from live engines',
    '',
    'Each row is one buyer prompt sent to one engine with retrieval enabled. `cited` means the',
    'engine returned a `meshin.co` URL among its sources. `mentioned` means the answer named the',
    'site or the owner without citing it. `absent` means neither.',
    '',
    '| Engine | | | | |',
    '|---|---|---|---|---|',
    ...counts,
    '',
    '## Who wins the prompts we lose',
    '',
    '| # | Prompt | Engine | Retrieved | Cited instead |',
    '|---|---|---|---|---|',
    ...lost.map(
      (row) =>
        `| ${row.number} | ${row.prompt} | ${row.provider} | ${row.retrieved ? 'yes' : 'no, answered from memory'} | ${row.detail || 'nothing'} |`
    ),
    '',
  ].join('\n');
}
