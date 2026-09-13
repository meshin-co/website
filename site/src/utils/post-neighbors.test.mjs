import assert from 'node:assert/strict';
import { test } from 'node:test';

import { neighbourPosts, relatedPosts } from './post-neighbors.mjs';

const post = (id, day) => ({ id, data: { publishDate: new Date(`2026-03-${day}`) } });

const category = [post('first', '01'), post('second', '10'), post('third', '20')];

test('previous is older and next is newer within the category', () => {
  const { previous, next } = neighbourPosts(category, 'second');
  assert.equal(previous.id, 'first');
  assert.equal(next.id, 'third');
});

test('the cycle wraps at both ends', () => {
  assert.equal(neighbourPosts(category, 'first').previous.id, 'third');
  assert.equal(neighbourPosts(category, 'third').next.id, 'first');
});

test('a lone post gets no self-referential neighbours', () => {
  assert.deepEqual(neighbourPosts([post('only', '01')], 'only'), { previous: null, next: null });
});

test('an id outside the category has no neighbours', () => {
  assert.deepEqual(neighbourPosts(category, 'stranger'), { previous: null, next: null });
});

test('related posts exclude the current post and cap at three, newest first', () => {
  const wide = ['01', '05', '09', '13', '17'].map((day, index) => post(`p${index}`, day));
  assert.deepEqual(
    relatedPosts(wide, 'p0').map((entry) => entry.id),
    ['p4', 'p3', 'p2']
  );
  assert.deepEqual(
    relatedPosts(category, 'second').map((entry) => entry.id),
    ['third', 'first']
  );
});

test('a lone post has no related posts', () => {
  assert.deepEqual(relatedPosts([post('only', '01')], 'only'), []);
});
