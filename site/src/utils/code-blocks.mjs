import { toString } from 'hast-util-to-string';
import { h } from 'hastscript';

export const COPY_LABEL = 'Copy';
export const COPY_ARIA_LABEL = 'Copy code';
export const COPIED_LABEL = 'Copied';
export const COPY_FAILED_LABEL = 'Failed';

export const COPY_BUTTON = Object.freeze({
  type: 'button',
  class: 'code-copy',
  'aria-label': COPY_ARIA_LABEL,
  'data-done': COPIED_LABEL,
  'data-failed': COPY_FAILED_LABEL,
  hidden: true,
});

export const COPY_STATUS = Object.freeze({ class: 'sr-only', role: 'status' });

const isPre = (node) => node.type === 'element' && node.tagName === 'pre';

const codeBlock = (pre) =>
  h('div', { class: 'code-block' }, [pre, h('button', COPY_BUTTON, COPY_LABEL), h('span', COPY_STATUS)]);

function wrapPres(parent) {
  parent.children = parent.children.map((child) => {
    if (isPre(child)) return codeBlock(child);
    if (child.children) wrapPres(child);
    return child;
  });
}

export function rehypeCodeBlocks() {
  return wrapPres;
}

const LANGUAGE_PREFIX = 'language-';

const isCode = (node) => node.type === 'element' && node.tagName === 'code';

const classesOf = (code) => code.properties?.className ?? [];

const isLabelled = (code) => classesOf(code).some((name) => name.startsWith(LANGUAGE_PREFIX));

function holdsJsonDocument(text) {
  try {
    const value = JSON.parse(text);
    return typeof value === 'object' && value !== null;
  } catch {
    return false;
  }
}

function labelIfJson(code) {
  if (code === undefined || isLabelled(code) || !holdsJsonDocument(toString(code))) return;
  code.properties = { ...code.properties, className: [...classesOf(code), `${LANGUAGE_PREFIX}json`] };
}

function labelJsonBlocks(parent) {
  for (const child of parent.children ?? []) {
    if (isPre(child)) labelIfJson(child.children.find(isCode));
    else labelJsonBlocks(child);
  }
}

export function rehypeJsonBlocks() {
  return labelJsonBlocks;
}
