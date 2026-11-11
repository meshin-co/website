import { brandFromDisk, contactEmail } from '../utils/brand.mjs';

const BRAND = brandFromDisk();

export const STATIC_PAGE_CATALOG = [
  {
    path: '/',
    title: 'Home',
    updatedDate: '2026-10-25',
    description:
      'Fractional Chief AI Officer for 30–300 person companies: governance that passes enterprise procurement, and agentic systems shipped to production with evals.',
  },
  {
    path: '/blog/tags',
    title: 'Tags',
    description: 'The tags used across the writing, with how many articles carry each one.',
  },
  {
    path: '/about',
    title: 'About Dmitri Meshin',
    updatedDate: '2026-10-02',
    description:
      'Dmitri Meshin is a platform engineer working as a Fractional Chief AI Officer for companies of 30 to 300 people. Remote worldwide.',
  },
  {
    path: '/approach',
    title: 'How a Fractional AI Officer works',
    updatedDate: '2026-10-02',
    description:
      'How a Fractional AI Officer works: the six things that decide whether an AI initiative reaches production, and the order I work through them.',
  },
  {
    path: '/pricing',
    title: 'Pricing: what a Fractional Chief AI Officer costs',
    updatedDate: '2026-10-02',
    description:
      'Fractional Chief AI Officer cost: two-week Assessment, 90-Day Sprint or monthly Retainer. Fixed, no hourly billing, every fee in writing before work starts.',
  },
  {
    path: '/faq',
    title: 'Fractional Chief AI Officer questions',
    description:
      'Fractional Chief AI Officer questions answered: what the role does, what each offer produces, and how AI risk gets recorded and signed off.',
  },
  {
    path: '/contact',
    title: 'Contact: book an AI leadership call',
    updatedDate: '2026-10-25',
    description: `Book an AI leadership call: a 30-minute fit call, or email ${contactEmail(BRAND)}. Remote worldwide, on site when the trip is worth it.`,
  },
  {
    path: '/ai-policy',
    title: 'AI acceptable use policy',
    updatedDate: '2026-10-25',
    description:
      'My own acceptable use policy for AI systems: what data may reach a vendor, what may not, and who decides.',
  },
  {
    path: '/security',
    title: 'Security practices',
    updatedDate: '2026-10-02',
    description: `Security practices for ${BRAND.name}: how this site is built and served, how client data is handled, and where to report a vulnerability.`,
  },
  {
    path: '/now',
    title: 'What I am working on now',
    updatedDate: '2026-10-03',
    description:
      'What I am working on now: a dated log of what I am building and studying, newest first. A line is added when something happens and never edited after.',
  },
  {
    path: '/imprint',
    title: 'Imprint',
    updatedDate: '2026-10-17',
    description: `Imprint for ${BRAND.name}: who is responsible for this site, how to reach them by email, where they work from, and what it is hosted on.`,
  },
  {
    path: '/privacy',
    title: 'Privacy policy',
    updatedDate: '2026-10-17',
    description: `Privacy policy for ${BRAND.name}: what this site collects, which is almost nothing, and what happens to an email you send me.`,
  },
  {
    path: '/terms',
    title: 'Terms',
    updatedDate: '2026-11-11',
    description: 'What this site is, why no price appears on it, and which terms actually govern an engagement.',
  },
  {
    path: '/search',
    title: 'Search',
    description: 'Search the writing, glossary, services and case studies on this site.',
  },
  {
    path: '/styleguide',
    title: 'Styleguide',
    description: 'Every component in every state, both themes. Internal reference page.',
  },
  {
    path: '/404',
    title: 'Page not found',
    description: `This page does not exist on ${BRAND.name}. Start from the home page.`,
  },
];

export const HUB_PAGES = [
  {
    base: '/blog',
    title: 'AI governance writing',
    description:
      'AI governance writing: notes on getting AI systems past security review and into production, written for founders and boards.',
  },
  {
    base: '/faq',
    title: 'Fractional Chief AI Officer questions',
    description:
      'Fractional Chief AI Officer questions answered: what the role does, what each offer produces, and how AI risk gets recorded and signed off.',
  },
  {
    base: '/glossary',
    title: 'AI governance glossary',
    description:
      'An AI governance glossary: plain definitions of the terms, standards and laws that come up in security reviews and board meetings.',
  },
  {
    base: '/resources',
    title: 'AI governance templates and checklists',
    description:
      'AI governance templates, each described on its own page: what is inside, how to use it and where its content comes from.',
  },
  {
    base: '/services',
    title: 'Fractional AI leadership services',
    description:
      'Fractional AI leadership services in three offers: a two-week assessment, a 90-day production sprint or a retainer, run by a Fractional Chief AI Officer.',
  },
  {
    base: '/case-studies',
    title: 'Fractional Chief AI Officer case study',
    description:
      'I have not published a Fractional Chief AI Officer case study yet. Client case studies appear here only once a client agrees in writing.',
  },
];
