import { getPermalink } from './utils/permalinks';

export const headerData = {
  links: [
    { text: 'Services', href: getPermalink('/services') },
    { text: 'Approach', href: getPermalink('/approach') },
    { text: 'Pricing', href: getPermalink('/pricing') },
    { text: 'Writing', href: getPermalink('/blog') },
    { text: 'Resources', href: getPermalink('/resources') },
    { text: 'About', href: getPermalink('/about') },
  ],
  actions: [{ text: 'Book a call', href: 'https://cal.com/meshin', target: '_blank' }],
};

export const footerData = {
  links: [
    {
      title: 'Work',
      links: [
        { text: 'Services', href: getPermalink('/services') },
        { text: 'Pricing', href: getPermalink('/pricing') },
        { text: 'Approach', href: getPermalink('/approach') },
        { text: 'Case studies', href: getPermalink('/case-studies') },
      ],
    },
    {
      title: 'Reading',
      links: [
        { text: 'Writing', href: getPermalink('/blog') },
        { text: 'Glossary', href: getPermalink('/glossary') },
        { text: 'Resources', href: getPermalink('/resources') },
        { text: 'Questions', href: getPermalink('/faq') },
      ],
    },
    {
      title: 'Practice',
      links: [
        { text: 'About', href: getPermalink('/about') },
        { text: 'Now', href: getPermalink('/now') },
        { text: 'Contact', href: getPermalink('/contact') },
      ],
    },
    {
      title: 'Trust',
      links: [
        { text: 'AI policy', href: getPermalink('/ai-policy') },
        { text: 'Security', href: getPermalink('/security') },
        { text: 'Privacy', href: getPermalink('/privacy') },
        { text: 'Terms', href: getPermalink('/terms') },
      ],
    },
  ],
  secondaryLinks: [{ text: 'Imprint', href: getPermalink('/imprint') }],
  socialLinks: [
    { ariaLabel: 'LinkedIn', icon: 'tabler:brand-linkedin', href: 'https://www.linkedin.com/in/meshin/' },
    { ariaLabel: 'GitHub', icon: 'tabler:brand-github', href: 'https://github.com/meshin-dev' },
    { ariaLabel: 'Email', icon: 'tabler:mail', href: 'mailto:hello@meshin.co' },
  ],
  footNote: `© ${new Date().getFullYear()} meshin.co`,
};

export const homePermalink = getPermalink('/');
