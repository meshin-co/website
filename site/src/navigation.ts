import { SITE } from 'astrowind:config';
import { BOOKING_URL } from './utils/booking.mjs';
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
  actions: [{ text: 'Book a call', href: BOOKING_URL, target: '_blank' }],
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
      title: 'Topics',
      links: [
        { text: 'AI governance', href: getPermalink('/blog/category/governance') },
        { text: 'Agentic architecture', href: getPermalink('/blog/category/agentic-architecture') },
        { text: 'AI operating model', href: getPermalink('/blog/category/operating-model') },
        { text: 'AI for boards', href: getPermalink('/blog/category/executive') },
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
    {
      ariaLabel: 'View my LinkedIn profile',
      icon: 'tabler:brand-linkedin',
      href: 'https://www.linkedin.com/in/meshin/',
    },
    { ariaLabel: 'View my GitHub profile', icon: 'tabler:brand-github', href: 'https://github.com/meshin-dev' },
    { ariaLabel: 'Email me', icon: 'tabler:mail', href: `mailto:hello@${SITE.name}` },
  ],
  footNote: `© ${new Date().getFullYear()} ${SITE.name}`,
};
