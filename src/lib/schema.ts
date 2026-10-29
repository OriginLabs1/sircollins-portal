/**
 * Machine-readable identity graph.
 *
 * Public surface is JSON-LD (schema.org). The same builder feeds the
 * CBOR-LD encoder later, so both representations stay in a single source.
 */

export const SITE_ORIGIN = 'https://sircollins.concept1.net';

export const SITE_NAME = 'Sir Collins Chris';

export const CONTACT = {
  professionalEmail: 'access1@tutamail.com',
  personalEmail: 'sircollins1@protonmail.com',
  telegram: 'https://t.me/CollinsRoyalMedium',
} as const;

export const ROLES = [
  'Unique Pioneer',
  'Leadership Consultant',
  'Royal Tutor',
  'ICT Strategist',
  'Creative Genius',
] as const;

export type Role = (typeof ROLES)[number];

export interface Teaser {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly theme: string;
  readonly publishedAt: string;
  readonly tags: readonly string[];
}

export interface PersonGraph {
  '@context': 'https://schema.org';
  '@type': 'Person';
  name: string;
  url: string;
  jobTitle: readonly string[];
  email: string;
  sameAs: readonly string[];
}

export interface WebSiteGraph {
  '@context': 'https://schema.org';
  '@type': 'WebSite';
  name: string;
  url: string;
  inLanguage: 'en';
  about: { '@type': 'Person'; name: string };
}

export interface BlogGraph {
  '@context': 'https://schema.org';
  '@type': 'Blog';
  name: string;
  url: string;
  blogPost: readonly {
    '@type': 'BlogPosting';
    headline: string;
    abstract: string;
    datePublished: string;
    keywords: string;
  }[];
}

export function buildPersonGraph(): PersonGraph {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: SITE_NAME,
    url: `${SITE_ORIGIN}/`,
    jobTitle: ROLES,
    email: CONTACT.professionalEmail,
    sameAs: [CONTACT.telegram],
  };
}

export function buildWebSiteGraph(): WebSiteGraph {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: `${SITE_ORIGIN}/`,
    inLanguage: 'en',
    about: { '@type': 'Person', name: SITE_NAME },
  };
}

export function buildBlogGraph(teasers: readonly Teaser[]): BlogGraph {
  return {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'Inspirations & Reflections',
    url: `${SITE_ORIGIN}/#reflections`,
    blogPost: teasers.map((teaser) => ({
      '@type': 'BlogPosting',
      headline: teaser.title,
      abstract: teaser.summary,
      datePublished: teaser.publishedAt,
      keywords: teaser.tags.join(', '),
    })),
  };
}
