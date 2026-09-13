const byOldestFirst = (a, b) => a.data.publishDate.getTime() - b.data.publishDate.getTime();
const byNewestFirst = (a, b) => b.data.publishDate.getTime() - a.data.publishDate.getTime();

export function neighbourPosts(categoryPosts, id) {
  if (categoryPosts.length < 2) return { previous: null, next: null };

  const ascending = [...categoryPosts].sort(byOldestFirst);
  const index = ascending.findIndex((post) => post.id === id);
  if (index === -1) return { previous: null, next: null };

  const at = (position) => ascending[(position + ascending.length) % ascending.length];
  return { previous: at(index - 1), next: at(index + 1) };
}

export function relatedPosts(categoryPosts, id, limit = 3) {
  return categoryPosts
    .filter((post) => post.id !== id)
    .sort(byNewestFirst)
    .slice(0, limit);
}
