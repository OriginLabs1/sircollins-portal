/**
 * Copy and identity contracts.
 *
 * These tests protect the words, not the layout. A failure here means the
 * published surface no longer matches the approved copy or the Giving
 * handshake, which is a release blocker.
 */

import { describe, expect, it } from 'vitest';
import indexHtml from '../index.html?raw';
import manifest from '../public/manifest.webmanifest?raw';
import {
  ACK_ROLE_DESCRIPTION,
  ACK_ROLE_LABEL,
  ATTRIBUTION,
  GIVING_HANDSHAKE,
  GIVING_MESSAGE,
} from '../src/lib/schema.ts';
import { RARITY_SCALE_NOTE } from '../src/lib/portal.ts';

const collapsed = (value: string): string =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
const page = collapsed(indexHtml);

describe('role copy', () => {
  it('uses the approved labels', () => {
    expect(ACK_ROLE_LABEL).toEqual({
      observer: 'Observer',
      aspirant: 'Membership Aspirant',
      communicator: 'Communicator',
      'active-member': 'Active Member',
      responder: 'Responder',
    });
  });

  it('uses the approved descriptions verbatim', () => {
    expect(ACK_ROLE_DESCRIPTION).toEqual({
      observer: 'I read and observed.',
      aspirant:
        'A potential member willing to be a recognized member of Sir Collins Community.',
      communicator: 'I spoke or reshared this.',
      'active-member': 'A honorable member active within Sir Collins Community.',
      responder: 'I acted on this or created from it.',
    });
  });
});

describe('rarity copy', () => {
  it('measures witness and worth, not popularity or money', () => {
    expect(RARITY_SCALE_NOTE).toBe(
      'Rarity measures both depth of witness and worth, not popularity or money.',
    );
    expect(page).toContain(RARITY_SCALE_NOTE);
  });
});

describe('giving handshake', () => {
  it('carries the one-word message to the Telegram inbox', () => {
    expect(GIVING_MESSAGE).toBe('Giver');
    expect(GIVING_HANDSHAKE).toBe('https://t.me/CollinsRoyalMedium?text=Giver');
    expect(page).toContain(`id="giving-url">${GIVING_HANDSHAKE}</code>`);
  });

  it('renders the hint verbatim', () => {
    expect(page).toContain(
      "HINT: Toggling the Token/Giving Mode or turning it on simply means choosing to give or choosing to request for a 'Giving Plan' by typing 'Giver' to Sir Collins Telegram inbox.",
    );
  });
});

describe('attribution', () => {
  it('is visible in the app, word for word', () => {
    expect(ATTRIBUTION.madeWithLove).toBe('Made with love from OneOrigin.');
    expect(ATTRIBUTION.poweredBy).toBe(
      "Powered by: 'Sir Collins Tech-Agency' - A leading universal entity pioneering unique concepts beyond tech and shaping the future of sustainable civilization with integrity and mastery.",
    );
    expect(page).toContain(ATTRIBUTION.madeWithLove);
    expect(page).toContain(ATTRIBUTION.poweredBy);
  });
});

describe('stage copy', () => {
  it('publishes the credit, role context, and impact statement', () => {
    for (const line of [
      'A living Inspiration by Sir Collins',
      'Occasion: TEDx Jalingo',
      "Theme: 'A New Wave'",
      'Role: Strategist & Creative Facilitator',
      'Role Context: Former active member of the first TEDx Organizers, Jalingo.',
      'My impact was not on stage.',
      'My impact was behind the stage.',
    ]) {
      expect(page).toContain(line);
    }
  });

  it('retires the old stage framing', () => {
    expect(page).toContain('The Voice');
    expect(page).not.toContain('From the Stage');
    expect(page).not.toContain('On stage');
    expect(page).not.toContain('Aphorisms to live by');
  });
});

describe('editorial inflation', () => {
  it('does not feature or over-title the collection', () => {
    expect(page).toContain('id="inspirations-title">Inspirations</h2>');
    expect(page).not.toContain('Featured Inspirations');
    expect(manifest).not.toContain('featured inspirations');
  });
});
