export const LINK_TAG = /<link\b[^>]*>/gi;
export const META_TAG = /<meta\b[^>]*>/gi;

export const attributeOf = (tag, name) => new RegExp(`(?<![\\w-])${name}=["']([^"']*)["']`).exec(tag)?.[1];

export const linkTags = (html) => [...html.matchAll(LINK_TAG)].map(([tag]) => tag);

export const metaTags = (html) => [...html.matchAll(META_TAG)].map(([tag]) => tag);

export function declaredUrl(html, pattern, identifyingAttribute, identity, valueAttribute) {
  const tag = [...html.matchAll(pattern)].find(([found]) => attributeOf(found, identifyingAttribute) === identity);
  return tag === undefined ? undefined : attributeOf(tag[0], valueAttribute);
}
