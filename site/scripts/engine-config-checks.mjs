export const compilePattern = (source) => new RegExp(source);

export function matchRoute({ rules, fallback }, route) {
  return rules.find(({ prefix }) => route.startsWith(prefix)) ?? fallback;
}

const problem = (path, text) => ({ path, problem: text });

function patternProblems({ diff }) {
  return ['testFilePattern', 'testDirectoryPattern'].flatMap((key) => {
    try {
      compilePattern(diff[key]);
      return [];
    } catch (error) {
      return [problem(`$.diff.${key}`, `is not a regular expression (${error.message})`)];
    }
  });
}

function ruleProblems({ routeFamilies: { rules } }) {
  return rules.flatMap(({ prefix }, at) => {
    const claimedBy = rules.slice(0, at).find((earlier) => prefix.startsWith(earlier.prefix));
    if (!claimedBy) return [];
    const text = `"${prefix}" is unreachable: "${claimedBy.prefix}" above it already claims every route it matches`;
    return [problem(`$.routeFamilies.rules[${at}].prefix`, text)];
  });
}

function formatProblems({ content, routeFamilies }) {
  const formats = Object.entries(content.formats);
  return formats.flatMap(([format, { collection, routePrefix }]) => {
    const where = `$.content.formats.${format}`;
    const rival = formats.find(([other, entry]) => other !== format && entry.collection === collection);
    const family = matchRoute(routeFamilies, `${routePrefix}a-slug`).family;
    return [
      ...(rival
        ? [problem(`${where}.collection`, `"${collection}" already holds the entries of format "${rival[0]}"`)]
        : []),
      ...(routePrefix.endsWith('/') ? [] : [problem(`${where}.routePrefix`, `"${routePrefix}" must end with a slash`)]),
      ...(family === format
        ? []
        : [
            problem(
              `${where}.routePrefix`,
              `"${routePrefix}" belongs to family "${family}", and the writer needs "${format}"`
            ),
          ]),
    ];
  });
}

function resourceProblems({ content: { formats } }) {
  const { resourceCollection } = formats.article;
  const holder = Object.entries(formats).find(([, entry]) => entry.collection === resourceCollection);
  if (!holder) return [];
  const text = `"${resourceCollection}" already holds the entries of format "${holder[0]}"`;
  return [problem('$.content.formats.article.resourceCollection', text)];
}

const DIRECTORY_LISTS = ['proseDirectories', 'shippedDirectories', 'automationDirectories'];

function overlapProblems({ diff }) {
  return DIRECTORY_LISTS.flatMap((list, listAt) =>
    diff[list].flatMap((directory, at) =>
      DIRECTORY_LISTS.slice(listAt + 1).flatMap((otherList) => {
        const clash = diff[otherList].find((other) => other.startsWith(directory) || directory.startsWith(other));
        if (!clash) return [];
        const text = `"${directory}" overlaps "${clash}" in diff.${otherList}, so a path under both would have two classes`;
        return [problem(`$.diff.${list}[${at}]`, text)];
      })
    )
  );
}

function dataDirectoryProblems({ diff, content }) {
  if (diff.shippedDirectories.some((directory) => `${content.dataDirectory}/`.startsWith(directory))) return [];
  const text = `"${content.dataDirectory}" is not inside a diff.shippedDirectories entry, so the entries the writer commits would classify as prose and skip the gates`;
  return [problem('$.content.dataDirectory', text)];
}

function bandProblems({ demand: { strengthenBand } }) {
  if (strengthenBand.min <= strengthenBand.max) return [];
  const text = `${strengthenBand.min} is above demand.strengthenBand.max ${strengthenBand.max}`;
  return [problem('$.demand.strengthenBand.min', text)];
}

export const consistencyProblems = (config) => [
  ...patternProblems(config),
  ...overlapProblems(config),
  ...dataDirectoryProblems(config),
  ...ruleProblems(config),
  ...formatProblems(config),
  ...resourceProblems(config),
  ...bandProblems(config),
];
