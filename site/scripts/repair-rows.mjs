const RULE_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const BUILT = new WeakSet();

function reasonOf(why) {
  if (typeof why !== 'string' || why.trim() === '') throw new TypeError('a row needs a reason written as text');
  return why;
}

function allowancesOf(names) {
  for (const name of names)
    if (typeof name !== 'string' || name === '') throw new TypeError(`an allowance is a name, not ${String(name)}`);
  return Object.freeze([...names]);
}

function row(fields) {
  const built = Object.freeze(fields);
  BUILT.add(built);
  return built;
}

export const rewrite = (why, ...may) =>
  row({ repairable: true, how: 'rewrite', may: allowancesOf(may), why: reasonOf(why) });

export const sharedRewrite = (why, ...may) =>
  row({ repairable: true, how: 'rewrite', may: allowancesOf(may), why: reasonOf(why), shared: true });

export const restate = (why, needs) =>
  row({
    repairable: true,
    how: 'restate',
    may: allowancesOf([]),
    why: reasonOf(why),
    ...(needs === undefined ? {} : { needs }),
  });

export const refuse = (why) => row({ repairable: false, how: null, may: allowancesOf([]), why: reasonOf(why) });

export function tableOf(rows) {
  for (const [name, value] of Object.entries(rows)) {
    if (!RULE_NAME.test(name)) throw new TypeError(`"${name}" is not a lowercase hyphenated rule name`);
    if (!BUILT.has(value)) throw new TypeError(`${name} is not a row made by rewrite, restate or refuse`);
  }
  return Object.freeze({ ...rows });
}
