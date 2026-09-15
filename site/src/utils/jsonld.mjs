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
const DEFAULT_IMAGE_WIDTH = 1200;
const DEFAULT_IMAGE_HEIGHT = 630;
const LANGUAGE = 'en';

const isoInstant = (value) => new Date(value).toISOString();

const absolute = (site, path) => (path === '/' ? `${site}/` : `${site}${path}`);

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const citationOf = (sources) =>
  (sources ?? []).map((source) => ({ '@type': 'CreativeWork', name: source.title, url: source.url }));

/** @typedef {{ url: string, width?: number, height?: number }} JsonLdImage */

/** @param {JsonLdImage} image */
export function imageObject({ url, width, height }) {
  return { '@type': 'ImageObject', url, ...(width ? { width } : {}), ...(height ? { height } : {}) };
}

export function glossaryRef(site, id) {
  return { '@id': `${site}/glossary/${id}#term` };
}

export function glossaryStub(site, term) {
  return {
    '@type': 'DefinedTerm',
    '@id': `${site}/glossary/${term.id}#term`,
    name: term.term,
    url: `${site}/glossary/${term.id}`,
  };
}

/**
 * @param {string} text
 * @param {{ id: string, term: string }[]} terms
 * @param {string} [excludeId]
 * @returns {string[]}
 */
export function findGlossaryMentions(text, terms, excludeId) {
  if (!text || !terms?.length) return [];
  return terms
    .filter((term) => term.id !== excludeId)
    .filter((term) => new RegExp(`(?<![\\w])${escapeRegExp(term.term)}(?![\\w])`, 'iu').test(text))
    .map((term) => term.id);
}

/**
 * @param {string} site
 * @param {{ about?: string[], mentions?: string[] }} links
 * @returns {Record<string, unknown>}
 */
function entityGraphLinks(site, { about = [], mentions = [] }) {
  const unique = (ids) => [...new Set(ids)];
  const aboutIds = unique(about);
  const mentionIds = unique(mentions).filter((id) => !aboutIds.includes(id));
  const out = {};
  if (aboutIds.length) out.about = aboutIds.map((id) => glossaryRef(site, id));
  if (mentionIds.length) out.mentions = mentionIds.map((id) => glossaryRef(site, id));
  return out;
}

export function graph(nodes) {
  return { '@context': 'https://schema.org', '@graph': nodes };
}

export function orgNode(
  site,
  { logoPath = '/og/default.png', width = DEFAULT_IMAGE_WIDTH, height = DEFAULT_IMAGE_HEIGHT } = {}
) {
  const logo = imageObject({ url: `${site}${logoPath}`, width, height });
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
      availableLanguage: 'en',
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

export function serviceEntityLinks(service, terms = []) {
  const aboutText = [service.name, service.tagline, service.shortAnswer, service.description]
    .filter(Boolean)
    .join('\n');
  const mentionText = [
    aboutText,
    ...(service.forWhom ?? []),
    ...(service.notForWhom ?? []),
    ...(service.deliverables ?? []),
    ...(service.process ?? []).flatMap((step) => [step.title, step.detail]),
    ...(service.schedule ?? []).flatMap((row) => [row.stage, row.work, row.output]),
    ...(service.faq ?? []).flatMap((item) => [item.q, item.a]),
    service.body,
  ]
    .filter(Boolean)
    .join('\n');
  const about = findGlossaryMentions(aboutText, terms, service.id);
  const mentions = findGlossaryMentions(mentionText, terms, service.id).filter((id) => !about.includes(id));
  return { about, mentions };
}

/** @param {string} site @param {any} entry @param {{ about?: string[], mentions?: string[] }} [links] */
export function serviceNode(site, service, { about = [], mentions = [] } = {}) {
  return {
    '@type': 'Service',
    '@id': `${site}/services/${service.id}#service`,
    name: service.name,
    description: service.description,
    serviceType: PERSON_ROLE,
    provider: { '@id': `${site}/#org` },
    areaServed: 'Worldwide',
    inLanguage: LANGUAGE,
    offers: {
      '@type': 'Offer',
      url: `${site}/services/${service.id}`,
      availability: 'https://schema.org/InStock',
    },
    citation: citationOf(service.sources),
    ...entityGraphLinks(site, { about, mentions }),
  };
}

export function postEntityLinks(post, terms = []) {
  const aboutText = [post.title, post.description, post.shortAnswer, post.fullAnswer].filter(Boolean).join('\n');
  const about = (post.tags ?? []).filter((tag) => terms.some((term) => term.id === tag));
  const mentions = findGlossaryMentions([aboutText, post.body].filter(Boolean).join('\n'), terms, post.id).filter(
    (id) => !about.includes(id)
  );
  return { about, mentions };
}

/** @param {string} site @param {any} post @param {{ basePath?: string, ogCollection?: string, about?: string[], mentions?: string[] }} [links] */
export function postNode(site, post, { basePath = '/blog', ogCollection = 'post', about = [], mentions = [] } = {}) {
  const url = `${site}${basePath}/${post.id}`;
  return {
    '@type': 'BlogPosting',
    '@id': `${url}#post`,
    url,
    headline: post.title,
    description: post.description,
    datePublished: isoInstant(post.publishDate),
    dateModified: isoInstant(post.updatedDate),
    inLanguage: LANGUAGE,
    image: `${site}${ogImagePath(ogCollection, post.id)}`,
    ...(Number.isFinite(post.wordCount) ? { wordCount: post.wordCount } : {}),
    mainEntityOfPage: { '@id': `${url}#webpage` },
    author: { '@id': `${site}/#person` },
    publisher: { '@id': `${site}/#org` },
    ...(post.category ? { articleSection: post.category } : {}),
    ...(post.tags?.length ? { keywords: post.tags.join(', ') } : {}),
    citation: citationOf(post.sources),
    ...entityGraphLinks(site, { about, mentions }),
  };
}

export function resourceEntityLinks(resource, terms = []) {
  const aboutText = [resource.name, resource.description].filter(Boolean).join('\n');
  const mentionText = [aboutText, ...(resource.whatInside ?? []), resource.howToUse, resource.body]
    .filter(Boolean)
    .join('\n');
  const about = findGlossaryMentions(aboutText, terms, resource.id);
  const mentions = findGlossaryMentions(mentionText, terms, resource.id).filter((id) => !about.includes(id));
  return { about, mentions };
}

/** @param {{ about?: string[], mentions?: string[], image?: JsonLdImage }} [options] */
/** @param {string} site @param {any} entry @param {{ about?: string[], mentions?: string[], image?: unknown }} [links] */
export function resourceNode(site, resource, options = {}) {
  const { about = [], mentions = [], image } = options;
  return {
    '@type': resource.repoUrl ? 'SoftwareSourceCode' : 'CreativeWork',
    '@id': `${site}/resources/${resource.id}#resource`,
    url: `${site}/resources/${resource.id}`,
    name: resource.name,
    description: resource.description,
    ...(resource.publishDate ? { datePublished: isoInstant(resource.publishDate) } : {}),
    ...(resource.updatedDate ? { dateModified: isoInstant(resource.updatedDate) } : {}),
    license: resource.license,
    version: resource.version,
    author: { '@id': `${site}/#person` },
    inLanguage: LANGUAGE,
    isPartOf: { '@id': `${site}/#website` },
    ...(resource.repoUrl ? { codeRepository: resource.repoUrl } : {}),
    ...(image ? { primaryImageOfPage: image } : {}),
    citation: citationOf(resource.sources),
    ...entityGraphLinks(site, { about, mentions }),
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

export function faqPageNode(
  site,
  faq,
  options = /** @type {{ image?: JsonLdImage, speakableSelectors?: string[] }} */ ({})
) {
  const { image, speakableSelectors = [] } = options;
  const path = faq.url ?? `/faq/${faq.id}`;
  return {
    '@type': 'FAQPage',
    '@id': `${site}${path}#faqpage`,
    url: absolute(site, path),
    isPartOf: { '@id': `${site}/#website` },
    inLanguage: LANGUAGE,
    ...(faq.sources?.length ? { citation: citationOf(faq.sources) } : {}),
    ...(image ? { primaryImageOfPage: image } : {}),
    ...(speakableSelectors.length
      ? { speakable: { '@type': 'SpeakableSpecification', cssSelector: speakableSelectors } }
      : {}),
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

/** @param {string} site @param {any} entry @param {{ about?: string[], mentions?: string[] }} [links] */
export function termNode(site, term) {
  const mentionIds = (term.relatedTerms ?? []).map((ref) => ref.id).filter((id) => id !== term.id);
  return {
    '@type': 'DefinedTerm',
    '@id': `${site}/glossary/${term.id}#term`,
    name: term.term,
    description: term.shortDefinition,
    url: `${site}/glossary/${term.id}`,
    inDefinedTermSet: { '@id': `${site}/glossary#termset` },
    inLanguage: LANGUAGE,
    citation: citationOf(term.sources),
    ...entityGraphLinks(site, { mentions: mentionIds }),
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

/**
 * @param {{
 *   image?: { url: string, width?: number, height?: number },
 *   mainEntity?: string,
 *   speakableSelectors?: string[]
 * }} [options]
 */
export function webPageNode(
  site,
  path,
  dateModified,
  name,
  options = /** @type {{ image?: JsonLdImage, mainEntity?: string, speakableSelectors?: string[] }} */ ({})
) {
  const { image, mainEntity, speakableSelectors = [] } = options;
  return {
    '@type': 'WebPage',
    '@id': `${site}${path}#webpage`,
    url: absolute(site, path),
    ...(name ? { name } : {}),
    isPartOf: { '@id': `${site}/#website` },
    inLanguage: LANGUAGE,
    ...(dateModified ? { dateModified: isoInstant(dateModified) } : {}),
    ...(image ? { primaryImageOfPage: image } : {}),
    ...(mainEntity ? { mainEntity: { '@id': mainEntity } } : {}),
    ...(speakableSelectors.length
      ? { speakable: { '@type': 'SpeakableSpecification', cssSelector: speakableSelectors } }
      : {}),
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
