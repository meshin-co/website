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

const ids = (posts) => posts.map((entry) => entry.id);

const crowded = (size) =>
  Array.from({ length: size }, (_, index) => post(`p${index}`, String(index + 1).padStart(2, '0')));

test('related posts exclude the current post and cap at eight, newest first', () => {
  assert.deepEqual(ids(relatedPosts(crowded(12), 'p0')), ['p11', 'p10', 'p9', 'p8', 'p7', 'p6', 'p5', 'p4']);
  assert.deepEqual(ids(relatedPosts(crowded(12), 'p11')), ['p10', 'p9', 'p8', 'p7', 'p6', 'p5', 'p4', 'p3']);
});

test('in a category of nine every block lists every other post, and a tenth pushes the oldest out of all of them', () => {
  const nine = crowded(9);
  for (const { id } of nine) assert.equal(relatedPosts(nine, id).length, 8, id);
  for (const { id } of nine.slice(1)) assert.ok(ids(relatedPosts(nine, id)).includes('p0'), id);

  const ten = crowded(10);
  for (const { id } of ten) assert.equal(ids(relatedPosts(ten, id)).includes('p0'), false, id);
});

test('a category with fewer than eight other posts lists all of them and pads nothing', () => {
  assert.deepEqual(ids(relatedPosts(category, 'second')), ['third', 'first']);
  assert.deepEqual(ids(relatedPosts(crowded(8), 'p3')), ['p7', 'p6', 'p5', 'p4', 'p2', 'p1', 'p0']);

  const pair = [post('older', '01'), post('newer', '10')];
  assert.deepEqual(ids(relatedPosts(pair, 'older')), ['newer']);
  assert.deepEqual(ids(relatedPosts(pair, 'newer')), ['older']);
});

test('related posts published on the same day come in the reverse of the neighbour order, whatever order they arrive in', () => {
  const alpha = post('alpha', '08');
  const bravo = post('bravo', '08');
  const earlier = post('earlier', '01');

  for (const arrival of [
    [alpha, bravo, earlier],
    [earlier, bravo, alpha],
  ]) {
    assert.deepEqual(ids(relatedPosts(arrival, 'earlier')), ['bravo', 'alpha']);
    assert.deepEqual(ids(relatedPosts(arrival, 'earlier', 1)), ['bravo']);
  }
});

test('a lone post has no related posts', () => {
  assert.deepEqual(relatedPosts([post('only', '01')], 'only'), []);
});
