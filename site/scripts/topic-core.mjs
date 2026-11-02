const PROMPT_HEADING = /^\*\*(\d+)\.\s+[^*]+\*\*$/;
const ROUTE_TOKEN = /`(\/[a-z0-9/-]*)`/g;
const RETIRED = /\bRetired\b|Must win: nothing/;

const cleanRoute = (route) => (route.length > 1 ? route.replace(/\/$/, '') : route);

const routesIn = (text) => [...new Set([...text.matchAll(ROUTE_TOKEN)].map((match) => cleanRoute(match[1])))];

const sourceOf = (bodyLines) => {
  const text = bodyLines.join('\n');
  return { routes: routesIn(text), retired: RETIRED.test(text) };
};

export function readPromptSources(coreDoc) {
  const sources = new Map();
  let numbers = [];
  let body = [];

  const closeBlock = () => {
    for (const number of numbers) sources.set(number, sourceOf(body));
    numbers = [];
    body = [];
  };

  for (const line of coreDoc.split('\n')) {
    const heading = PROMPT_HEADING.exec(line);
    if (line.startsWith('#')) closeBlock();
    else if (heading) {
      if (body.length > 0) closeBlock();
      numbers.push(Number(heading[1]));
    } else if (line.trim() !== '' && numbers.length > 0) body.push(line);
  }
  closeBlock();
  return sources;
}
