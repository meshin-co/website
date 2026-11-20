const RELATED_POSTS_LIMIT = 8;

const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const byOldestFirst = (a, b) => a.data.publishDate.getTime() - b.data.publishDate.getTime() || byId(a, b);
const byNewestFirst = (a, b) => byOldestFirst(b, a);

export function neighbourPosts(categoryPosts, id) {
  const ascending = [...categoryPosts].sort(byOldestFirst);
  const index = ascending.findIndex((post) => post.id === id);
  if (ascending.length < 2 || index === -1) return { previous: null, next: null };

  const closesCycle = ascending.length > 2;
  return {
    previous: ascending[index - 1] ?? (closesCycle ? ascending.at(-1) : null),
    next: ascending[index + 1] ?? (closesCycle ? ascending[0] : null),
  };
}

export function relatedPosts(categoryPosts, id, limit = RELATED_POSTS_LIMIT) {
  return categoryPosts
    .filter((post) => post.id !== id)
    .sort(byNewestFirst)
    .slice(0, limit);
}
