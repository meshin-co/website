export const canonicalHref = (html) => /<link[^>]*canonical[^>]*>/.exec(html)?.[0]?.match(/href="([^"]+)"/)?.[1] ?? '';
export const robotsMeta = (html) => /<meta[^>]*robots[^>]*>/.exec(html)?.[0] ?? '';
export const robotsContent = (html) => /content="([^"]*)"/.exec(robotsMeta(html))?.[1];

const pathOf = (url) => url.replace(/^https?:\/\/[^/]+/, '');

export function paginationControl(html) {
  const nav = /<nav[^>]*aria-label="Pagination"[^>]*>([\s\S]*?)<\/nav>/.exec(html)?.[1] ?? '';
  const anchors = [...nav.matchAll(/<a\b[^>]*>/g)].map(([tag]) => [
    /aria-label="([^"]*)"/.exec(tag)?.[1],
    /href="([^"]*)"/.exec(tag)?.[1],
  ]);
  return {
    current: /<span[^>]*aria-current="page"[^>]*>\s*(\d+)\s*<\/span>/.exec(nav)?.[1],
    hrefOf: (label) => anchors.find(([name]) => name === label)?.[1],
  };
}

export function tagArchiveFindings({ route, page1Html, page2Html, hasPage3, sitemap }) {
  if (!page2Html) return [`${route}/page/2 was not built`];
  const first = paginationControl(page1Html);
  const second = paginationControl(page2Html);
  return [
    ['page 2 robots', robotsContent(page2Html), 'noindex, follow'],
    ['page 2 canonical', pathOf(canonicalHref(page2Html)), `${route}/page/2`],
    ['page 1 robots contain noindex', /noindex/.test(robotsMeta(page1Html)), false],
    ['page 1 canonical', pathOf(canonicalHref(page1Html)), route],
    ['page 1 current page', first.current, '1'],
    ['page 1 previous link', first.hrefOf('Previous page'), undefined],
    ['page 1 next link', first.hrefOf('Next page'), `${route}/page/2`],
    ['page 2 current page', second.current, '2'],
    ['page 2 previous link', second.hrefOf('Previous page'), route],
    ['page 2 next link', second.hrefOf('Next page'), hasPage3 ? `${route}/page/3` : undefined],
    ['sitemap lists a paginated route', sitemap.includes('/page/'), false],
    ['sitemap lists the archive', sitemap.includes(`${route}</loc>`), true],
  ]
    .filter(([, actual, wanted]) => actual !== wanted)
    .map(([what, actual, wanted]) => `tag ${what}: got ${actual}, want ${wanted}`);
}
