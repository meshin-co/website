import { ogImagePath } from './machine-links.mjs';

const PERSON_NAME = 'Dmitri Meshin';
const PERSON_ROLE = 'Fractional Chief AI Officer';
const ORG_NAME = 'meshin.co';
const PERSON_SAME_AS = ['https://www.linkedin.com/in/meshin/', 'https://github.com/meshin-dev'];
const ORG_SAME_AS = ['https://www.linkedin.com/company/144892973', 'https://github.com/meshin-co'];
const KNOWS_ABOUT = [
  'ISO/IEC 42001',
  'NIST AI Risk Management Framework',
  'EU AI Act',
  'AI governance',
  'agentic systems',
  'LLM evaluation',
];

const isoDay = (value) => new Date(value).toISOString().slice(0, 10);

const absolute = (site, path) => (path === '/' ? `${site}/` : `${site}${path}`);

export function graph(nodes) {
  return { '@context': 'https://schema.org', '@graph': nodes };
}

export function orgNode(site, { logoPath = '/og/default.png' } = {}) {
  const logo = `${site}${logoPath}`;
  return {
    '@type': 'Organization',
    '@id': `${site}/#org`,
    name: ORG_NAME,
    url: `${site}/`,
    logo,
    image: logo,
    founder: { '@id': `${site}/#person` },
    sameAs: ORG_SAME_AS,
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'sales',
      email: 'hello@meshin.co',
      availableLanguage: ['en', 'ru', 'he'],
    },
  };
}

export function personNode(site) {
  return {
    '@type': 'Person',
    '@id': `${site}/#person`,
    name: PERSON_NAME,
    jobTitle: PERSON_ROLE,
    url: `${site}/about`,
    worksFor: { '@id': `${site}/#org` },
    sameAs: PERSON_SAME_AS,
    knowsAbout: KNOWS_ABOUT,
  };
}

export function websiteNode(site) {
  return {
    '@type': 'WebSite',
    '@id': `${site}/#website`,
    url: `${site}/`,
    name: ORG_NAME,
    publisher: { '@id': `${site}/#org` },
    potentialAction: {
      '@type': 'SearchAction',
      target: `${site}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

export function serviceNode(site, service) {
  return {
    '@type': 'Service',
    '@id': `${site}/services/${service.id}#service`,
    name: service.name,
    description: service.description,
    serviceType: PERSON_ROLE,
    provider: { '@id': `${site}/#org` },
    areaServed: 'Worldwide',
    offers: {
      '@type': 'Offer',
      url: `${site}/services/${service.id}`,
      availability: 'https://schema.org/InStock',
    },
  };
}

export function postNode(site, post, { basePath = '/blog', ogCollection = 'post' } = {}) {
  const url = `${site}${basePath}/${post.id}`;
  return {
    '@type': 'BlogPosting',
    '@id': `${url}#post`,
    url,
    headline: post.title,
    description: post.description,
    datePublished: isoDay(post.publishDate),
    dateModified: isoDay(post.updatedDate),
    inLanguage: 'en',
    image: `${site}${ogImagePath(ogCollection, post.id)}`,
    ...(Number.isFinite(post.wordCount) ? { wordCount: post.wordCount } : {}),
    mainEntityOfPage: { '@id': `${url}#webpage` },
    author: { '@id': `${site}/#person` },
    publisher: { '@id': `${site}/#org` },
    ...(post.category ? { articleSection: post.category } : {}),
    ...(post.tags?.length ? { keywords: post.tags.join(', ') } : {}),
    citation: (post.sources ?? []).map((source) => ({
      '@type': 'CreativeWork',
      name: source.title,
      url: source.url,
    })),
  };
}

export function resourceNode(site, resource) {
  return {
    '@type': resource.repoUrl ? 'SoftwareSourceCode' : 'CreativeWork',
    '@id': `${site}/resources/${resource.id}#resource`,
    url: `${site}/resources/${resource.id}`,
    name: resource.name,
    description: resource.description,
    ...(resource.publishDate ? { datePublished: isoDay(resource.publishDate) } : {}),
    ...(resource.updatedDate ? { dateModified: isoDay(resource.updatedDate) } : {}),
    license: resource.license,
    version: resource.version,
    author: { '@id': `${site}/#person` },
    ...(resource.repoUrl ? { codeRepository: resource.repoUrl } : {}),
  };
}

export function faqNode(items) {
  return {
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
}

export function faqPageNode(site, faq) {
  const path = faq.url ?? `/faq/${faq.id}`;
  return {
    '@type': 'FAQPage',
    '@id': `${site}${path}#faqpage`,
    url: absolute(site, path),
    mainEntity: {
      '@type': 'Question',
      '@id': `${site}${path}#question`,
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        '@id': `${site}${path}#answer`,
        text: faq.answer,
      },
    },
  };
}

export function breadcrumbNode(site, crumbs) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: absolute(site, crumb.path),
    })),
  };
}

export function termSetNode(site, terms = []) {
  return {
    '@type': 'DefinedTermSet',
    '@id': `${site}/glossary#termset`,
    name: 'AI governance glossary',
    url: `${site}/glossary`,
    ...(terms.length > 0
      ? { hasDefinedTerm: terms.map((term) => ({ '@id': `${site}/glossary/${term.id}#term` })) }
      : {}),
  };
}

export function termNode(site, term) {
  return {
    '@type': 'DefinedTerm',
    '@id': `${site}/glossary/${term.id}#term`,
    name: term.term,
    description: term.shortDefinition,
    url: `${site}/glossary/${term.id}`,
    inDefinedTermSet: { '@id': `${site}/glossary#termset` },
  };
}

export function collectionNode(site, page) {
  return {
    '@type': 'CollectionPage',
    '@id': `${site}${page.path}#page`,
    url: absolute(site, page.path),
    name: page.name,
    description: page.description,
    isPartOf: { '@id': `${site}/#website` },
    ...(page.items?.length
      ? {
          itemListElement: page.items.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            url: absolute(site, item.url),
          })),
        }
      : {}),
  };
}

export function contactPageNode(site) {
  return {
    '@type': 'ContactPage',
    '@id': `${site}/contact#page`,
    url: `${site}/contact`,
    name: 'Contact',
    mainEntity: { '@id': `${site}/#org` },
    isPartOf: { '@id': `${site}/#website` },
  };
}

export function webPageNode(site, path, dateModified, name) {
  return {
    '@type': 'WebPage',
    '@id': `${site}${path}#webpage`,
    url: absolute(site, path),
    ...(name ? { name } : {}),
    isPartOf: { '@id': `${site}/#website` },
    ...(dateModified ? { dateModified: isoDay(dateModified) } : {}),
  };
}

export function profilePageNode(site) {
  return {
    '@type': 'ProfilePage',
    '@id': `${site}/about#page`,
    url: `${site}/about`,
    name: 'About',
    mainEntity: { '@id': `${site}/#person` },
    isPartOf: { '@id': `${site}/#website` },
  };
}
