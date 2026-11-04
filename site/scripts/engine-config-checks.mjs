export const TIME_OF_DAY = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

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

const WRITE_TIMES_FIELD = 'loop.writeTimesUtc';
const WRITE_TIMES_PATH = `$.${WRITE_TIMES_FIELD}`;
const NO_TIME =
  'lists no time, so the workflow would lose its schedule block. To pause the writer, disable the Write daily workflow or leave one of its required secrets unset';

const quoted = (value) => JSON.stringify(value);

function writeTimeProblems({ loop: { writeTimesUtc: times } }) {
  if (!Array.isArray(times)) {
    return [
      problem(
        WRITE_TIMES_PATH,
        `${quoted(times)} is not a list of times, which is an array such as ["03:17", "15:17"]`
      ),
    ];
  }
  if (times.length === 0) return [problem(WRITE_TIMES_PATH, NO_TIME)];
  return times.flatMap((time, at) => {
    const path = `${WRITE_TIMES_PATH}[${at}]`;
    if (typeof time !== 'string' || !TIME_OF_DAY.test(time)) {
      const text = `${quoted(time)} is not a time of day, which is HH:MM in 24 hours with two digits each, such as "03:17"`;
      return [problem(path, text)];
    }
    const first = times.indexOf(time);
    if (first === at) return [];
    return [problem(path, `${quoted(time)} is already at ${WRITE_TIMES_FIELD}[${first}], and a time may appear once`)];
  });
}

export const consistencyProblems = (config) => [
  ...patternProblems(config),
  ...overlapProblems(config),
  ...dataDirectoryProblems(config),
  ...ruleProblems(config),
  ...formatProblems(config),
  ...resourceProblems(config),
  ...bandProblems(config),
  ...writeTimeProblems(config),
];
