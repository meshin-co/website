export const SCENE_PAGES = [
  { path: '/', title: 'Home', updatedDate: '2026-10-25', description: 'The home page of the synthetic site.' },
  { path: '/blog/tags', title: 'Tags', description: 'The tags used across the writing of the synthetic site.' },
  { path: '/about', title: 'About', updatedDate: '2026-10-02', description: 'Who writes the synthetic site.' },
  { path: '/guide', title: 'Guide', updatedDate: '2026-10-02', description: 'How the synthetic site works.' },
  { path: '/pricing', title: 'Pricing', updatedDate: '2026-10-02', description: 'What the synthetic site charges.' },
  { path: '/faq', title: 'Questions', description: 'The questions the synthetic site answers.' },
  {
    path: '/security',
    title: 'Security',
    updatedDate: '2026-10-02',
    description: 'How the synthetic site is kept safe.',
  },
  { path: '/now', title: 'Now', updatedDate: '2026-10-03', description: 'What the synthetic site is working on.' },
  { path: '/imprint', title: 'Imprint', updatedDate: '2026-10-17', description: 'Who answers for the synthetic site.' },
  { path: '/terms', title: 'Terms', updatedDate: '2026-10-25', description: 'The terms of the synthetic site.' },
  { path: '/search', title: 'Search', description: 'Search the synthetic site.' },
  { path: '/styleguide', title: 'Styleguide', description: 'Every component of the synthetic site.' },
  { path: '/404', title: 'Page not found', description: 'This page does not exist on the synthetic site.' },
];

export const SCENE_HUBS = [
  { base: '/blog', title: 'Writing', description: 'The writing of the synthetic site.' },
  { base: '/faq', title: 'Questions', description: 'The questions the synthetic site answers.' },
  { base: '/glossary', title: 'Glossary', description: 'The terms the synthetic site uses.' },
  { base: '/resources', title: 'Resources', description: 'The checklists of the synthetic site.' },
  { base: '/services', title: 'Services', description: 'The offers of the synthetic site.' },
  { base: '/case-studies', title: 'Case studies', description: 'The client work of the synthetic site.' },
];

export const SCENE_EMPTY_COLLECTIONS = [
  {
    collection: 'case',
    reason: 'The synthetic site has published no case study, so its hub stays withheld until the first one exists.',
  },
];
