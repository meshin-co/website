import { lastmod } from './lastmod.mjs';
import { teaser } from './faq-meta.mjs';

export const LLMS_COLLECTIONS = [
  { name: 'service', base: '/services', title: 'Offers', file: '/llms/service.txt' },
  { name: 'post', base: '/blog', title: 'Writing', file: '/llms/post.txt' },
  { name: 'resource', base: '/resources', title: 'Resources', file: '/llms/resource.txt' },
  { name: 'glossary', base: '/glossary', title: 'Glossary', file: '/llms/glossary.txt' },
  { name: 'case', base: '/case-studies', title: 'Case studies', file: '/llms/case.txt' },
  { name: 'faq', base: '/faq', title: 'Questions and answers', file: '/llms/faq.txt' },
];

export function toLlmsEntry() {
  return (entry) => {
    const isFaq = 'answer' in entry.data;
    return {
      id: entry.id,
      title: isFaq ? entry.data.question : entry.data.title,
      description: isFaq ? teaser(entry.data.answer) : (entry.data.shortAnswer ?? entry.data.description),
      body: isFaq ? entry.data.answer : (entry.body ?? ''),
      updated: lastmod(entry.data),
      draft: Boolean(entry.data.draft),
      noindex: Boolean(entry.data.noindex),
    };
  };
}

export function latestUpdated(entries) {
  const stamps = entries.map((entry) => entry.updated).filter(Boolean);
  return stamps.length === 0 ? null : stamps.reduce((a, b) => (a < b ? b : a));
}

export function llmsFeedPointers() {
  return [
    {
      url: '/rss.xml',
      title: 'All updates',
      description: 'Merged full-text feed of every live entry, newest first.',
    },
    ...LLMS_COLLECTIONS.map(({ base, title }) => ({
      url: `${base}/rss.xml`,
      title: `${title} feed`,
      description: `Full-text feed of every live entry in ${title.toLowerCase()}.`,
    })),
  ];
}
