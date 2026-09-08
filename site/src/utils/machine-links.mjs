const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

export function ogImagePath(collection, id) {
  return `/og/${collection}/${id}.png`;
}

export function markdownPath(pagePath) {
  return `${pagePath}.md`;
}

export function articleMetadata(site, entry) {
  const { title, description, collection, id, publishDate, updatedDate, section, tags } = entry;
  const images = [{ url: `${site}${ogImagePath(collection, id)}`, width: OG_WIDTH, height: OG_HEIGHT }];

  if (!publishDate) return { title, description, openGraph: { type: 'website', images } };

  return {
    title,
    description,
    openGraph: {
      type: 'article',
      images,
      article: {
        publishedTime: publishDate.toISOString(),
        modifiedTime: (updatedDate ?? publishDate).toISOString(),
        ...(section ? { section } : {}),
        ...(tags ? { tags } : {}),
      },
    },
  };
}
