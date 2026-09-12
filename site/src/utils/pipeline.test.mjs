import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  isExternalHref,
  mergeRelTokens,
  rehypeHeadingAnchors,
  rehypeExternalLinks,
  rehypeScrollableTables,
} from './pipeline.mjs';

test('a relative path is never external', () => {
  assert.equal(isExternalHref('/blog/foo'), false);
  assert.equal(isExternalHref('#section'), false);
  assert.equal(isExternalHref(''), false);
  assert.equal(isExternalHref(undefined), false);
});

test('an absolute link to the site itself is internal', () => {
  assert.equal(isExternalHref('https://meshin.co/blog/foo'), false);
  assert.equal(isExternalHref('//meshin.co/blog/foo'), false);
});

test('an absolute link to another host is external, including subdomains', () => {
  assert.equal(isExternalHref('https://nist.gov/ai-rmf'), true);
  assert.equal(isExternalHref('http://example.com'), true);
  assert.equal(isExternalHref('//example.com/x'), true);
  assert.equal(isExternalHref('https://blog.meshin.co'), true);
});

test('non-http protocols are left alone regardless of host', () => {
  assert.equal(isExternalHref('mailto:hello@meshin.co'), false);
  assert.equal(isExternalHref('tel:+15555550100'), false);
});

test('a custom site hostname overrides the default', () => {
  assert.equal(isExternalHref('https://example.com', 'example.com'), false);
  assert.equal(isExternalHref('https://meshin.co', 'example.com'), true);
});

test('merging rel tokens adds new tokens and drops duplicates', () => {
  assert.deepEqual(mergeRelTokens(undefined, 'noopener'), ['noopener']);
  assert.deepEqual(mergeRelTokens('nofollow', 'noopener'), ['nofollow', 'noopener']);
  assert.deepEqual(mergeRelTokens(['nofollow', 'noopener'], 'noopener'), ['nofollow', 'noopener']);
  assert.deepEqual(mergeRelTokens('  nofollow   noopener  '.trim(), 'noopener'), ['nofollow', 'noopener']);
});

function textNode(value) {
  return { type: 'text', value };
}

function element(tagName, properties, children) {
  return { type: 'element', tagName, properties, children };
}

function heading(tagName, text, properties = {}) {
  return element(tagName, properties, [textNode(text)]);
}

function root(children) {
  return { type: 'root', children };
}

test('headings get a slug id and an aria-hidden anchor child, leaving their own text untouched', () => {
  const original = heading('h2', 'Overview');
  const tree = root([original]);

  rehypeHeadingAnchors()(tree);

  const [processed] = tree.children;
  assert.equal(processed.properties.id, 'overview');
  assert.equal(processed.children.length, 2);
  assert.deepEqual(processed.children[0], textNode('Overview'));

  const anchor = processed.children[1];
  assert.equal(anchor.tagName, 'a');
  assert.equal(anchor.properties.href, '#overview');
  assert.equal(anchor.properties.ariaHidden, 'true');
  assert.equal(anchor.properties.tabIndex, -1);
  assert.deepEqual(anchor.properties.className, ['heading-anchor']);
});

test('duplicate heading text gets deduplicated slugs within one document', () => {
  const tree = root([heading('h2', 'Overview'), heading('h2', 'Overview')]);

  rehypeHeadingAnchors()(tree);

  assert.equal(tree.children[0].properties.id, 'overview');
  assert.equal(tree.children[1].properties.id, 'overview-1');
});

test('a heading with a pre-existing id keeps it instead of slugging the text', () => {
  const tree = root([heading('h2', 'Custom Title', { id: 'already-set' })]);

  rehypeHeadingAnchors()(tree);

  assert.equal(tree.children[0].properties.id, 'already-set');
  assert.equal(tree.children[0].children[1].properties.href, '#already-set');
});

test('non-heading elements are never given an anchor child', () => {
  const paragraph = element('p', {}, [textNode('Just a paragraph')]);
  const tree = root([paragraph]);

  rehypeHeadingAnchors()(tree);

  assert.equal(tree.children[0].children.length, 1);
});

test('internal links are left completely untouched', () => {
  const relative = element('a', { href: '/blog/foo' }, [textNode('foo')]);
  const sameDomain = element('a', { href: 'https://meshin.co/blog/foo', target: '_blank' }, [textNode('foo')]);
  const tree = root([relative, sameDomain]);

  rehypeExternalLinks()(tree);

  assert.deepEqual(tree.children[0].properties, { href: '/blog/foo' });
  assert.deepEqual(tree.children[1].properties, { href: 'https://meshin.co/blog/foo', target: '_blank' });
});

test('external links get rel=noopener merged in and lose any target', () => {
  const bare = element('a', { href: 'https://nist.gov/ai-rmf' }, [textNode('NIST AI RMF')]);
  const withRelAndTarget = element('a', { href: 'https://iso.org/x', rel: ['nofollow'], target: '_blank' }, [
    textNode('ISO'),
  ]);
  const tree = root([bare, withRelAndTarget]);

  rehypeExternalLinks()(tree);

  assert.deepEqual(tree.children[0].properties.rel, ['noopener']);
  assert.equal('target' in tree.children[0].properties, false);

  assert.deepEqual(tree.children[1].properties.rel, ['nofollow', 'noopener']);
  assert.equal('target' in tree.children[1].properties, false);
});

test('running the external link pass twice does not duplicate rel tokens', () => {
  const link = element('a', { href: 'https://nist.gov/ai-rmf' }, [textNode('NIST AI RMF')]);
  const tree = root([link]);

  const plugin = rehypeExternalLinks();
  plugin(tree);
  plugin(tree);

  assert.deepEqual(tree.children[0].properties.rel, ['noopener']);
});

test('a table is wrapped for scrolling by class, never by an inline style', () => {
  const tree = { children: [{ type: 'element', tagName: 'table', children: [] }] };

  rehypeScrollableTables()(tree);

  const [wrapper] = tree.children;
  assert.equal(wrapper.tagName, 'div');
  assert.equal(wrapper.properties.className, 'table-scroll');
  assert.equal(wrapper.properties.style, undefined);
  assert.equal(wrapper.properties.tabIndex, 0);
  assert.equal(wrapper.children[0].tagName, 'table');
});

test('wrapping runs once per table and leaves other nodes in place', () => {
  const tree = {
    children: [
      { type: 'element', tagName: 'p', children: [] },
      { type: 'element', tagName: 'table', children: [] },
      { type: 'element', tagName: 'table', children: [] },
    ],
  };

  rehypeScrollableTables()(tree);

  assert.deepEqual(
    tree.children.map((node) => node.tagName),
    ['p', 'div', 'div']
  );
  assert.deepEqual(
    tree.children.slice(1).map((node) => node.children[0].tagName),
    ['table', 'table']
  );
});
