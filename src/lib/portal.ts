/**
 * Portal domain: acknowledgments, carrier links, personal state and rarity.
 *
 * Everything here is pure: no DOM, no storage. That keeps the rules testable
 * and lets the same payload travel through a URL, the clipboard, or — later —
 * a signed Worker response without changing shape.
 *
 * Sovereignty rule: an acknowledgment is held on the device that created it
 * until its owner chooses to carry it somewhere else. Nothing is uploaded.
 */

import { ACK_ROLES, ACK_ROLE_LABEL } from './schema.ts';
import type { AckRole, Entry } from './schema.ts';

export type SocialNetwork = 'x' | 'facebook';

export interface Acknowledgment {
  readonly entry: string;
  readonly name: string;
  readonly role: AckRole;
  readonly at: string;
  readonly source: 'local' | 'link';
  readonly x?: string;
  readonly facebook?: string;
  readonly note?: string;
}

export interface AckPayload {
  readonly v: 1;
  readonly entry: string;
  readonly name: string;
  readonly role: AckRole;
  readonly at: string;
  readonly x?: string;
  readonly facebook?: string;
  readonly note?: string;
}

export interface PortalState {
  readonly version: 1;
  readonly loved: readonly string[];
  readonly acknowledgments: readonly Acknowledgment[];
  readonly receptive: boolean;
}

export interface AckInput {
  readonly entry: string;
  readonly name: string;
  readonly role: AckRole;
  readonly x?: string;
  readonly facebook?: string;
  readonly note?: string;
  readonly at?: string;
}

export type SocialParse = { readonly url: string } | { readonly error: string } | null;

const MAX_NAME = 80;
const MAX_NOTE = 280;
const MAX_PAYLOAD = 4096;

const SOCIAL_LABEL: Record<SocialNetwork, string> = { x: 'X', facebook: 'Facebook' };

const SOCIAL_HOSTS: Record<SocialNetwork, ReadonlySet<string>> = {
  x: new Set(['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com', 'mobile.twitter.com']),
  facebook: new Set([
    'facebook.com',
    'www.facebook.com',
    'm.facebook.com',
    'web.facebook.com',
    'fb.com',
    'www.fb.com',
  ]),
};

export const RARITY_TIERS = [
  { id: 'very-common', label: 'Very Common', icon: 'seed', min: 0 },
  { id: 'common', label: 'Common', icon: 'leaf', min: 3 },
  { id: 'uncommon', label: 'Uncommon', icon: 'gem', min: 6 },
  { id: 'rare', label: 'Rare', icon: 'diamond', min: 10 },
  { id: 'unique', label: 'Unique', icon: 'starburst', min: 15 },
] as const;

export type RarityTier = (typeof RARITY_TIERS)[number];
export type RarityTierId = RarityTier['id'];

/**
 * Acknowledgment weight by role. Depth of witness, not raw popularity.
 * Membership is worth no more than speech: a claim of belonging must never
 * outrank an act, or the rarity scale would reward self-declaration.
 */
export const ACK_WEIGHT: Readonly<Record<AckRole, number>> = {
  observer: 1,
  aspirant: 1,
  communicator: 2,
  'active-member': 2,
  responder: 3,
};

/** Plural labels used in the witness breakdown. */
export const ACK_ROLE_PLURAL: Readonly<Record<AckRole, string>> = {
  observer: 'Observers',
  aspirant: 'Aspirants',
  communicator: 'Communicators',
  'active-member': 'Active members',
  responder: 'Responders',
};

export interface Rarity {
  readonly tier: RarityTier;
  readonly score: number;
  readonly intrinsic: number;
  readonly social: number;
  readonly counts: Readonly<Record<AckRole, number>>;
}

export const RARITY_SCALE_NOTE =
  'Rarity measures depth of witness, not worth, popularity, or money. Curation sets the floor; acknowledgment raises it.';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown, max: number, multiline = false): string {
  if (typeof value !== 'string') return '';
  const control = multiline
    ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g
    : /[\u0000-\u001f\u007f]/g;
  const normalised = value
    .replace(/\r\n?/g, '\n')
    .replace(control, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
  return normalised.slice(0, max).trim();
}

function normaliseDate(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 40) return null;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return null;
  return new Date(time).toISOString();
}

/**
 * Accept a profile link, with or without a scheme. Only the named network is
 * allowed; the scheme is upgraded to HTTPS. Returns null for an empty field,
 * `{ error }` for something present but unusable.
 */
export function parseSocialUrl(value: unknown, network: SocialNetwork): SocialParse {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return null;

  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return { error: `Enter a full ${SOCIAL_LABEL[network]} profile link.` };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { error: `${SOCIAL_LABEL[network]} links must use https://.` };
  }

  if (!SOCIAL_HOSTS[network].has(parsed.hostname.toLowerCase())) {
    const host = network === 'x' ? 'x.com' : 'facebook.com';
    return { error: `Use a ${SOCIAL_LABEL[network]} profile link on ${host}.` };
  }

  if (parsed.pathname.replace(/\/+$/, '').length < 2) {
    return { error: `That link points to the ${SOCIAL_LABEL[network]} homepage, not a profile.` };
  }

  parsed.protocol = 'https:';
  parsed.hash = '';
  return { url: parsed.href.replace(/\/$/, '') };
}

function optionalUrl(value: unknown, network: SocialNetwork): string | undefined {
  const parsed = parseSocialUrl(value, network);
  return parsed !== null && 'url' in parsed ? parsed.url : undefined;
}

export function createAckPayload(input: AckInput): AckPayload | null {
  const entry = cleanText(input.entry, MAX_NAME);
  const name = cleanText(input.name, MAX_NAME);
  if (!entry || !name) return null;
  if (!ACK_ROLES.includes(input.role)) return null;

  const at = normaliseDate(input.at ?? new Date().toISOString());
  if (at === null) return null;

  const x = parseSocialUrl(input.x, 'x');
  if (x !== null && 'error' in x) return null;
  const facebook = parseSocialUrl(input.facebook, 'facebook');
  if (facebook !== null && 'error' in facebook) return null;

  const note = cleanText(input.note, MAX_NOTE, true);

  return {
    v: 1,
    entry,
    name,
    role: input.role,
    at,
    ...(x !== null && 'url' in x ? { x: x.url } : {}),
    ...(facebook !== null && 'url' in facebook ? { facebook: facebook.url } : {}),
    ...(note ? { note } : {}),
  };
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(value: string): Uint8Array | null {
  if (value.length === 0 || value.length > MAX_PAYLOAD) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (padded.length % 4)) % 4);
  try {
    const binary = atob(padded + padding);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    return null;
  }
}

export function encodeAckPayload(payload: AckPayload): string {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
}

/**
 * Decode a carrier link. Unknown entries, bad roles and malformed dates are
 * rejected outright; unusable social links are dropped rather than blocking
 * the whole acknowledgment.
 */
export function decodeAck(raw: string, validEntryIds: ReadonlySet<string>): AckPayload | null {
  const bytes = base64UrlToBytes(raw);
  if (bytes === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
  if (!isRecord(parsed) || parsed['v'] !== 1) return null;

  const entry = cleanText(parsed['entry'], MAX_NAME);
  if (entry !== 'general' && !validEntryIds.has(entry)) return null;

  const name = cleanText(parsed['name'], MAX_NAME);
  if (!name) return null;

  const role = parsed['role'];
  if (typeof role !== 'string' || !ACK_ROLES.includes(role as AckRole)) return null;

  const at = normaliseDate(parsed['at']);
  if (at === null) return null;

  const note = cleanText(parsed['note'], MAX_NOTE, true);
  const x = optionalUrl(parsed['x'], 'x');
  const facebook = optionalUrl(parsed['facebook'], 'facebook');

  return {
    v: 1,
    entry,
    name,
    role: role as AckRole,
    at,
    ...(x ? { x } : {}),
    ...(facebook ? { facebook } : {}),
    ...(note ? { note } : {}),
  };
}

export function ackLink(origin: string, payload: AckPayload): string {
  return `${origin.replace(/\/+$/, '')}/#ack=${encodeAckPayload(payload)}`;
}

export function ackToPayload(ack: Acknowledgment): AckPayload {
  return {
    v: 1,
    entry: ack.entry,
    name: ack.name,
    role: ack.role,
    at: ack.at,
    ...(ack.x ? { x: ack.x } : {}),
    ...(ack.facebook ? { facebook: ack.facebook } : {}),
    ...(ack.note ? { note: ack.note } : {}),
  };
}

export function payloadToAck(payload: AckPayload, source: Acknowledgment['source']): Acknowledgment {
  return {
    entry: payload.entry,
    name: payload.name,
    role: payload.role,
    at: payload.at,
    source,
    ...(payload.x ? { x: payload.x } : {}),
    ...(payload.facebook ? { facebook: payload.facebook } : {}),
    ...(payload.note ? { note: payload.note } : {}),
  };
}

export function emptyState(): PortalState {
  return { version: 1, loved: [], acknowledgments: [], receptive: false };
}

function ackKey(ack: Acknowledgment): string {
  return `${ack.entry}\u0000${ack.name.toLowerCase()}\u0000${ack.at}`;
}

export function parseState(value: unknown): PortalState {
  if (!isRecord(value)) return emptyState();

  const loved = Array.isArray(value['loved'])
    ? [...new Set(value['loved'].filter((item): item is string => typeof item === 'string'))].slice(0, 200)
    : [];

  const acknowledgments: Acknowledgment[] = [];
  const seen = new Set<string>();
  if (Array.isArray(value['acknowledgments'])) {
    for (const item of value['acknowledgments'].slice(0, 500)) {
      if (!isRecord(item)) continue;
      const entry = cleanText(item['entry'], MAX_NAME);
      const name = cleanText(item['name'], MAX_NAME);
      const role = item['role'];
      const at = normaliseDate(item['at']);
      if (!entry || !name || at === null || typeof role !== 'string') continue;
      if (!ACK_ROLES.includes(role as AckRole)) continue;
      const source = item['source'] === 'link' ? 'link' : 'local';
      const x = optionalUrl(item['x'], 'x');
      const facebook = optionalUrl(item['facebook'], 'facebook');
      const note = cleanText(item['note'], MAX_NOTE, true);
      const ack: Acknowledgment = {
        entry,
        name,
        role: role as AckRole,
        at,
        source,
        ...(x ? { x } : {}),
        ...(facebook ? { facebook } : {}),
        ...(note ? { note } : {}),
      };
      const key = ackKey(ack);
      if (seen.has(key)) continue;
      seen.add(key);
      acknowledgments.push(ack);
    }
  }

  return {
    version: 1,
    loved,
    acknowledgments,
    receptive: value['receptive'] === true,
  };
}

export function addAcknowledgment(state: PortalState, ack: Acknowledgment): PortalState {
  const key = ackKey(ack);
  if (state.acknowledgments.some((item) => ackKey(item) === key)) return state;
  return { ...state, acknowledgments: [...state.acknowledgments, ack] };
}

export function toggleLove(state: PortalState, entryId: string): PortalState {
  const loved = state.loved.includes(entryId)
    ? state.loved.filter((id) => id !== entryId)
    : [...state.loved, entryId];
  return { ...state, loved };
}

export function setReceptive(state: PortalState, receptive: boolean): PortalState {
  return { ...state, receptive };
}

export function acknowledgmentsFor(
  state: PortalState,
  entryId: string,
): readonly Acknowledgment[] {
  return state.acknowledgments
    .filter((ack) => ack.entry === entryId)
    .slice()
    .sort((a, b) => a.at.localeCompare(b.at));
}

export function generalResponses(state: PortalState): readonly Acknowledgment[] {
  return acknowledgmentsFor(state, 'general');
}

export function computeRarity(entry: Entry, acknowledgments: readonly Acknowledgment[]): Rarity {
  const counts: Record<AckRole, number> = {
    observer: 0,
    aspirant: 0,
    communicator: 0,
    'active-member': 0,
    responder: 0,
  };
  for (const ack of acknowledgments) {
    if (ack.entry === entry.id) counts[ack.role] += 1;
  }

  let social = 0;
  for (const role of ACK_ROLES) social += counts[role] * ACK_WEIGHT[role];

  const intrinsic = Math.min(5, Math.max(0, Math.round(entry.weight)));
  const score = intrinsic + social;

  return { tier: tierFor(score), score, intrinsic, social, counts };
}

export function tierFor(score: number): RarityTier {
  const [veryCommon, common, uncommon, rare, unique] = RARITY_TIERS;
  if (score >= unique.min) return unique;
  if (score >= rare.min) return rare;
  if (score >= uncommon.min) return uncommon;
  if (score >= common.min) return common;
  return veryCommon;
}

export function rarityBreakdown(rarity: Rarity): readonly { label: string; value: string }[] {
  const rows = [{ label: 'Curation', value: `+${rarity.intrinsic}` }];
  for (const role of ACK_ROLES) {
    rows.push({
      label: `${ACK_ROLE_PLURAL[role]} · ${rarity.counts[role]}`,
      value: `+${rarity.counts[role] * ACK_WEIGHT[role]}`,
    });
  }
  return rows;
}

export function roleLabel(role: AckRole): string {
  return ACK_ROLE_LABEL[role];
}
