import GithubSlugger from 'github-slugger';
import { h } from 'hastscript';
import { toString as hastToString } from 'hast-util-to-string';
import { brandFromDisk } from './brand.mjs';

const SITE_HOSTNAME = brandFromDisk().name;

const HEADING_TAG_PATTERN = /^h[1-6]$/;

function walkElements(node, visit) {
  if (node.type === 'element') visit(node);
  for (const child of node.children ?? []) walkElements(child, visit);
}

export const EXTERNAL_REL = ['nofollow', 'noopener', 'noreferrer'];

export function isExternalHref(href, siteHostname = SITE_HOSTNAME) {
  if (typeof href !== 'string' || href === '') return false;

  let url;
  try {
    url = new URL(href, `https://${siteHostname}/`);
  } catch {
    return false;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  return url.hostname !== siteHostname;
}

export function mergeRelTokens(existingRel, ...tokensToAdd) {
  const tokens = [];
  const seen = new Set();

  const add = (token) => {
    if (!token || seen.has(token)) return;
    seen.add(token);
    tokens.push(token);
  };

  const existing = Array.isArray(existingRel)
    ? existingRel
    : typeof existingRel === 'string'
      ? existingRel.split(/\s+/)
      : [];

  for (const token of existing) add(token);
  for (const token of tokensToAdd) add(token);

  return tokens;
}

export function rehypeHeadingAnchors() {
  return function (tree) {
    const slugger = new GithubSlugger();

    walkElements(tree, (node) => {
      if (!HEADING_TAG_PATTERN.test(node.tagName)) return;

      node.properties = node.properties ?? {};
      if (typeof node.properties.id !== 'string') {
        node.properties.id = slugger.slug(hastToString(node));
      }

      node.children.push(
        h(
          'a',
          {
            href: `#${node.properties.id}`,
            'aria-hidden': 'true',
            tabindex: -1,
            class: 'heading-anchor',
          },
          []
        )
      );
    });
  };
}

export function externalRelAttrs(href, siteHostname = SITE_HOSTNAME) {
  return isExternalHref(href, siteHostname) ? { rel: EXTERNAL_REL.join(' ') } : {};
}

export function rehypeExternalLinks(options = {}) {
  const siteHostname = options.siteHostname ?? SITE_HOSTNAME;

  return function (tree) {
    walkElements(tree, (node) => {
      if (node.tagName !== 'a') return;

      const href = node.properties?.href;
      if (!isExternalHref(href, siteHostname)) return;

      node.properties.rel = mergeRelTokens(node.properties.rel, ...EXTERNAL_REL);
      delete node.properties.target;
    });
  };
}

export function rehypeScrollableTables() {
  return (tree) => {
    if (!tree.children) return;

    tree.children = tree.children.map((node) =>
      node.type === 'element' && node.tagName === 'table'
        ? { type: 'element', tagName: 'div', properties: { className: 'table-scroll', tabIndex: 0 }, children: [node] }
        : node
    );
  };
}
