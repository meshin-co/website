const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

export function ogImagePath(collection, id) {
  return `/og/${collection}/${id}.png`;
}

export function markdownPath(pagePath) {
  return `${pagePath}.md`;
}

export function routeOfPathname(pathname) {
  if (pathname === '/index.html') return '/';
  return pathname.endsWith('.html') ? pathname.slice(0, -'.html'.length) : pathname;
}

export function articleMetadata(site, entry) {
  const { title, description, collection, id, publishDate, updatedDate, section, tags, ogImage, canonical, noindex } =
    entry;
  const images = [
    ogImage ? { url: ogImage } : { url: `${site}${ogImagePath(collection, id)}`, width: OG_WIDTH, height: OG_HEIGHT },
  ];
  const base = {
    title,
    description,
    ...(canonical ? { canonical } : {}),
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };

  if (!publishDate) return { ...base, openGraph: { type: 'website', images } };

  return {
    ...base,
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
