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

test('two posts give each other as the only neighbour, never as previous and next at once', () => {
  const pair = [post('older', '01'), post('newer', '10')];

  const first = neighbourPosts(pair, 'older');
  assert.equal(first.previous, null);
  assert.equal(first.next.id, 'newer');

  const second = neighbourPosts(pair, 'newer');
  assert.equal(second.previous.id, 'older');
  assert.equal(second.next, null);
});

test('previous and next are never the same post, at any category size', () => {
  for (const size of [2, 3, 4, 7]) {
    const posts = Array.from({ length: size }, (_, index) => post(`post-${index}`, String(index + 1).padStart(2, '0')));
    for (const { id } of posts) {
      const { previous, next } = neighbourPosts(posts, id);
      assert.ok(previous === null || next === null || previous.id !== next.id, `${id} of ${size}`);
      assert.notEqual(previous?.id, id);
      assert.notEqual(next?.id, id);
    }
  }
});

test('posts published on the same day are ordered by id, whatever order they arrive in', () => {
  const alpha = post('alpha', '08');
  const bravo = post('bravo', '08');

  for (const arrival of [
    [alpha, bravo],
    [bravo, alpha],
  ]) {
    const first = neighbourPosts(arrival, 'alpha');
    assert.equal(first.previous, null);
    assert.equal(first.next.id, 'bravo');

    const second = neighbourPosts(arrival, 'bravo');
    assert.equal(second.previous.id, 'alpha');
    assert.equal(second.next, null);
  }
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
