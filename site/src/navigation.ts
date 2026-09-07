import { getPermalink } from './utils/permalinks';

// Nav entries are added in the phase that ships their target page: an internal
// link to a route that does not exist yet is a broken link, and the gate fails
// on it. Phase 1 has one page.
export const headerData = {
  links: [],
  actions: [{ text: 'Book a call', href: 'https://cal.com/meshin', target: '_blank' }],
};

export const footerData = {
  links: [],
  secondaryLinks: [],
  socialLinks: [
    { ariaLabel: 'LinkedIn', icon: 'tabler:brand-linkedin', href: 'https://www.linkedin.com/in/meshin/' },
    { ariaLabel: 'GitHub', icon: 'tabler:brand-github', href: 'https://github.com/meshin-dev' },
    { ariaLabel: 'Email', icon: 'tabler:mail', href: 'mailto:hello@meshin.co' },
  ],
  footNote: 'Built with Astro · 0 cookies',
};

export const homePermalink = getPermalink('/');
