import { WriterError } from './writer-error.mjs';

const variantsOf = (secrets) => {
  const variants = new Map();
  for (const { name, value } of secrets) {
    if (typeof value !== 'string' || value.trim() === '') continue;
    for (const variant of new Set([value, value.trim()])) if (!variants.has(variant)) variants.set(variant, name);
  }
  return [...variants].sort((left, right) => right[0].length - left[0].length);
};

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const secretsOf = (vendors) =>
  vendors
    .filter((vendor) => typeof vendor.apiKey === 'string' && vendor.apiKey.trim() !== '')
    .map((vendor) => ({ name: vendor.keyName, value: vendor.apiKey }));

export function redact(text, secrets) {
  const variants = variantsOf(secrets);
  if (variants.length === 0) return String(text);
  const names = new Map(variants);
  const pattern = new RegExp(variants.map(([variant]) => escapeRegExp(variant)).join('|'), 'g');
  return String(text).replace(pattern, (match) => `[redacted:${names.get(match)}]`);
}

const nameInText = (text, variants) => variants.find(([variant]) => text.includes(variant))?.[1] ?? null;

const walk = (value, path, variants, seen) => {
  if (typeof value === 'string') {
    const name = nameInText(value, variants);
    return name === null ? null : { name, path };
  }
  if (value === null || typeof value !== 'object' || seen.has(value)) return null;
  seen.add(value);
  const entries = Array.isArray(value)
    ? value.map((item, index) => [`[${index}]`, item])
    : Object.entries(value).map(([key, item]) => [`.${key}`, item]);
  for (const [step, item] of entries) {
    if (!Array.isArray(value)) {
      const keyName = nameInText(step.slice(1), variants);
      if (keyName !== null) return { name: keyName, path: `${path}#key` };
    }
    const found = walk(item, path + step, variants, seen);
    if (found) return found;
  }
  return null;
};

export const findSecret = (value, secrets) => walk(value, '$', variantsOf(secrets), new WeakSet());

export function assertNoSecrets(value, secrets, label) {
  const found = findSecret(value, secrets);
  if (found === null) return;
  throw new WriterError('config', `${label} carries the value of ${found.name}`, { variables: [found.name] });
}
