/**
 * Machine-readable identity graph.
 *
 * Public surface is JSON-LD (schema.org). The same builder feeds the
 * CBOR-LD encoder later, so both representations stay in a single source.
 *
 * The portrait was removed by instruction; the brand emblem is the only image
 * asset. Person.image is therefore intentionally absent — an emblem is not a
 * depiction of the person.
 */

export const SITE_ORIGIN = 'https://sircollins.coreconcept1.net';

export const SITE_NAME = 'Sir Collins Chris';

export const SITE_TAGLINE = 'The living portal of the Life and unique realities of Sir Collins.';

export const LOGO_PATH = '/brand/logo.png';

export const LOGO_URL = `${SITE_ORIGIN}${LOGO_PATH}`;

export const LOGO_SIZE = { width: 696, height: 587 } as const;

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

/**
 * The five ways a person can meet the work. Order runs from the lightest
 * claim to the deepest: witness, intent to belong, speech, membership, action.
 */
export const ACK_ROLES = [
  'observer',
  'aspirant',
  'communicator',
  'active-member',
  'responder',
] as const;

export type AckRole = (typeof ACK_ROLES)[number];

export const ACK_ROLE_LABEL: Record<AckRole, string> = {
  observer: 'Observer',
  aspirant: 'Membership Aspirant',
  communicator: 'Communicator',
  'active-member': 'Community Active Member',
  responder: 'Responder',
};

export const ACK_ROLE_DESCRIPTION: Record<AckRole, string> = {
  observer: 'I have read and held this.',
  aspirant: 'A potential member who is willing to be recognized as a honorable member of Sir Collins Community.',
  communicator: 'I have shared or spoken this.',
  'active-member': 'A honorable member active within Sir Collins Community.',
  responder: 'I have acted on this or created from it.',
};

export const ACK_ROLE_ICON: Record<
  AckRole,
  'eye' | 'badge' | 'broadcast' | 'users' | 'pen'
> = {
  observer: 'eye',
  aspirant: 'badge',
  communicator: 'broadcast',
  'active-member': 'users',
  responder: 'pen',
};

export type EntryKind = 'inspiration' | 'reflection';

export interface Entry {
  readonly id: string;
  readonly kind: EntryKind;
  readonly theme: string;
  readonly text: string;
  readonly attribution?: string;
  /** Intrinsic curation weight, 0–5. Sets the floor of the rarity scale. */
  readonly weight: number;
}

export interface PersonGraph {
  '@context': 'https://schema.org';
  '@type': 'Person';
  name: string;
  url: string;
  description: string;
  jobTitle: readonly string[];
  email: string;
  sameAs: readonly string[];
  /** Skills declared in the interface, mirrored into the graph at boot. */
  knowsAbout?: readonly string[];
}

export interface WebSiteGraph {
  '@context': 'https://schema.org';
  '@type': 'WebSite';
  name: string;
  url: string;
  inLanguage: 'en';
  about: { '@type': 'Person'; name: string };
}

interface QuotationGraph {
  '@type': 'Quotation';
  name: string;
  text: string;
  url: string;
  identifier: string;
  keywords: string;
  spokenByCharacter: { '@type': 'Person'; name: string };
}

interface QuestionGraph {
  '@type': 'Question';
  name: string;
  text: string;
  url: string;
  identifier: string;
  keywords: string;
  about: { '@type': 'Person'; name: string };
}

export interface CollectionGraph {
  '@context': 'https://schema.org';
  '@type': 'CollectionPage';
  name: string;
  url: string;
  inLanguage: 'en';
  isPartOf: { '@type': 'WebSite'; name: string; url: string };
  hasPart: readonly (QuotationGraph | QuestionGraph)[];
}

export function entryUrl(id: string): string {
  return `${SITE_ORIGIN}/#entry-${id}`;
}

export function buildPersonGraph(knowsAbout: readonly string[] = []): PersonGraph {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: SITE_NAME,
    url: `${SITE_ORIGIN}/`,
    description: SITE_TAGLINE,
    jobTitle: ROLES,
    email: CONTACT.professionalEmail,
    sameAs: [CONTACT.telegram],
    ...(knowsAbout.length > 0 ? { knowsAbout } : {}),
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

export function buildCollectionGraph(entries: readonly Entry[]): CollectionGraph {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Inspirations & Reflections',
    url: `${SITE_ORIGIN}/#inspirations`,
    inLanguage: 'en',
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: `${SITE_ORIGIN}/` },
    hasPart: entries.map((entry) => {
      const common = {
        name: entry.theme,
        text: entry.text,
        url: entryUrl(entry.id),
        identifier: entry.id,
        keywords: `${entry.kind}, ${entry.theme.toLowerCase()}`,
      } as const;
      if (entry.kind === 'inspiration') {
        return {
          '@type': 'Quotation',
          ...common,
          spokenByCharacter: {
            '@type': 'Person',
            name: entry.attribution ?? SITE_NAME,
          },
        };
      }
      return {
        '@type': 'Question',
        ...common,
        about: { '@type': 'Person', name: SITE_NAME },
      };
    }),
  };
}
