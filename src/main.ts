import './styles/base.css';
import './styles/glass.css';
import entryData from './data/entries.json';
import { createSovereignStore } from './lib/storage.ts';
import type { SovereignStore, StorageEngine } from './lib/storage.ts';
import { hydrateIcons, iconNode } from './lib/icons.ts';
import type { IconName } from './lib/icons.ts';
import {
  ACK_ROLE_DESCRIPTION,
  ACK_ROLE_ICON,
  ACK_ROLE_LABEL,
  ACK_ROLES,
  CONTACT,
  GIVING_HANDSHAKE,
  ROLES,
  SITE_NAME,
  SITE_ORIGIN,
  SITE_TAGLINE,
  buildCollectionGraph,
  buildPersonGraph,
  buildWebSiteGraph,
} from './lib/schema.ts';
import type { AckRole, Entry, EntryKind } from './lib/schema.ts';
import {
  RARITY_SCALE_NOTE,
  RARITY_TIERS,
  acknowledgmentsFor,
  ackLink,
  ackToPayload,
  addAcknowledgment,
  computeRarity,
  createAckPayload,
  decodeAck,
  emptyState,
  generalResponses,
  parseSocialUrl,
  parseState,
  payloadToAck,
  rarityBreakdown,
  roleLabel,
  setReceptive,
  toggleLove,
} from './lib/portal.ts';
import type {
  AckPayload,
  Acknowledgment,
  PortalState,
  Rarity,
  SocialNetwork,
} from './lib/portal.ts';
import { downloadCanvas, paintQr } from './lib/qr.ts';
import { isBundledApp, nativeBridge } from './lib/native.ts';

const STATE_KEY = 'portal-state';
const LEGACY_TEASERS_KEY = 'teasers';

const ROLE_ICONS: readonly IconName[] = ['compass', 'route', 'book', 'cpu', 'sparkles'];

function query<T extends Element>(selector: string): T {
  const node = document.querySelector<T>(selector);
  if (node === null) throw new Error(`Missing required element: ${selector}`);
  return node;
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className !== undefined) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readEntries(): readonly Entry[] {
  const raw: unknown = entryData;
  if (!isRecord(raw) || !Array.isArray(raw['items'])) return [];

  const entries: Entry[] = [];
  for (const item of raw['items']) {
    if (!isRecord(item)) continue;
    const id = item['id'];
    const kind = item['kind'];
    const theme = item['theme'];
    const text = item['text'];
    const weight = item['weight'];
    const attribution = item['attribution'];
    if (
      typeof id !== 'string'
      || !/^[a-z0-9-]{2,80}$/.test(id)
      || (kind !== 'inspiration' && kind !== 'reflection')
      || typeof theme !== 'string'
      || typeof text !== 'string'
      || typeof weight !== 'number'
      || !Number.isFinite(weight)
    ) {
      continue;
    }
    entries.push({
      id,
      kind: kind as EntryKind,
      theme,
      text,
      weight,
      ...(typeof attribution === 'string' ? { attribution } : {}),
    });
  }
  return entries;
}

function readSkills(): readonly string[] {
  return [...document.querySelectorAll<HTMLElement>('.skill__title')]
    .map((node) => node.textContent?.trim() ?? '')
    .filter((name) => name.length > 0);
}

function writeJsonLd(entries: readonly Entry[], skills: readonly string[]): void {
  const graphs: readonly unknown[] = [
    buildPersonGraph(skills),
    buildWebSiteGraph(),
    buildCollectionGraph(entries),
  ];
  for (const graph of graphs) {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(graph);
    document.head.append(script);
  }
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function shareOrigin(): string {
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || isBundledApp()) {
    return SITE_ORIGIN;
  }
  return window.location.origin;
}

function entryShareUrl(id: string): string {
  return `${shareOrigin()}/#entry-${id}`;
}

function toast(message: string): void {
  const node = query<HTMLDivElement>('#toast');
  query<HTMLSpanElement>('#toast-text').textContent = message;
  node.classList.add('is-visible');
  if (toastTimer !== null) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    node.classList.remove('is-visible');
    toastTimer = null;
  }, 3_200);
}

let toastTimer: number | null = null;

async function copyText(value: string): Promise<boolean> {
  const bridge = nativeBridge();
  if (bridge?.copyText !== undefined) {
    try {
      if (bridge.copyText(value)) return true;
    } catch {
      // Fall through to the web clipboard path.
    }
  }

  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = value;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.inset = '0 auto auto -9999px';
    document.body.append(area);
    area.select();
    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch {
      copied = false;
    }
    area.remove();
    return copied;
  }
}

/* ------------------------------------------------------------------ state */

let store: SovereignStore | null = null;
let state: PortalState = emptyState();
let saveChain: Promise<void> = Promise.resolve();
const views = new Map<string, EntryView>();

function commit(next: PortalState): Promise<void> {
  state = next;
  refreshAll();
  saveChain = saveChain
    .then(() => {
      if (store === null) return;
      return store.set(STATE_KEY, state);
    })
    .catch(() => {
      toast('This device could not save the change.');
    });
  return saveChain;
}

/* ------------------------------------------------------------------ icons */

function actionButton(className: string, name: IconName, label: string): HTMLButtonElement {
  const button = element('button', className);
  button.type = 'button';
  button.append(iconNode(name), element('span', 'action__label', label));
  return button;
}

/* ------------------------------------------------------------------ rarity */

interface RarityView {
  readonly wrap: HTMLDivElement;
  readonly trigger: HTMLButtonElement;
  readonly iconHost: HTMLSpanElement;
  readonly label: HTMLSpanElement;
  readonly panel: HTMLDivElement;
}

function createRarityView(entryId: string): RarityView {
  const wrap = element('div', 'rarity');
  const trigger = element('button', 'rarity__trigger');
  trigger.type = 'button';
  const panel = element('div', 'rarity__panel');
  panel.id = `rarity-${entryId}`;
  panel.setAttribute('role', 'tooltip');
  trigger.setAttribute('aria-describedby', panel.id);
  trigger.setAttribute('aria-expanded', 'false');

  const iconHost = element('span', 'rarity__icon');
  const label = element('span', 'rarity__label');
  trigger.append(iconHost, label);
  wrap.append(trigger, panel);

  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    const open = wrap.classList.toggle('is-open');
    trigger.setAttribute('aria-expanded', String(open));
  });

  return { wrap, trigger, iconHost, label, panel };
}

function updateRarity(view: RarityView, rarity: Rarity): void {
  view.wrap.dataset['tier'] = rarity.tier.id;
  view.iconHost.replaceChildren(iconNode(rarity.tier.icon as IconName));
  view.label.textContent = rarity.tier.label;
  view.trigger.setAttribute(
    'aria-label',
    `Rarity: ${rarity.tier.label}. Show the witness breakdown.`,
  );

  const title = element('p', 'rarity__panel-title', 'Witness breakdown');
  const list = element('dl', 'rarity__rows');
  for (const row of rarityBreakdown(rarity)) {
    list.append(element('dt', undefined, row.label), element('dd', undefined, row.value));
  }

  const total = element('p', 'rarity__total');
  total.append(element('span', undefined, 'Witness score'), element('strong', undefined, String(rarity.score)));

  const note = element('p', 'rarity__note', RARITY_SCALE_NOTE);
  view.panel.replaceChildren(title, list, total, note);
}

/* ------------------------------------------------------------------ people */

function acknowledgmentItem(ack: Acknowledgment, withLink = false): HTMLLIElement {
  const item = element('li', 'acknowledger');

  const avatar = element('span', 'acknowledger__avatar', ack.name.slice(0, 1).toUpperCase());
  avatar.setAttribute('aria-hidden', 'true');

  const body = element('div', 'acknowledger__body');
  const top = element('div', 'acknowledger__top');
  const name = element('span', 'acknowledger__name', ack.name);

  const role = element('span', `role-chip role-chip--${ack.role}`);
  role.append(iconNode(ACK_ROLE_ICON[ack.role], 'icon role-chip__icon'), element('span', undefined, ACK_ROLE_LABEL[ack.role]));

  const time = element('time', 'acknowledger__time', formatDate(ack.at));
  time.dateTime = ack.at;
  time.title = formatDateTime(ack.at);

  top.append(name, role, time);

  if (ack.note !== undefined) {
    body.append(top, element('p', 'acknowledger__note', `“${ack.note}”`));
  } else {
    body.append(top);
  }

  const links = element('div', 'acknowledger__links');
  if (ack.x !== undefined) {
    const anchor = element('a', 'icon-link');
    anchor.href = ack.x;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer me';
    anchor.setAttribute('aria-label', `${ack.name} on X`);
    anchor.append(iconNode('x-social', 'icon icon--brand'));
    links.append(anchor);
  }
  if (ack.facebook !== undefined) {
    const anchor = element('a', 'icon-link');
    anchor.href = ack.facebook;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer me';
    anchor.setAttribute('aria-label', `${ack.name} on Facebook`);
    anchor.append(iconNode('facebook', 'icon icon--brand'));
    links.append(anchor);
  }
  if (withLink) {
    const copy = element('button', 'icon-link');
    copy.type = 'button';
    copy.setAttribute('aria-label', `Copy ${ack.name}'s carrier link`);
    copy.append(iconNode('link'));
    copy.addEventListener('click', () => {
      void copyText(ackLink(shareOrigin(), ackToPayload(ack))).then((copied) => {
        toast(copied ? 'Carrier link copied.' : 'Could not copy the link.');
      });
    });
    links.append(copy);
  }
  if (links.childElementCount > 0) body.append(links);

  item.append(avatar, body);
  return item;
}

/* ------------------------------------------------------------------- cards */

interface EntryView {
  readonly entry: Entry;
  readonly article: HTMLElement;
  readonly love: HTMLButtonElement;
  readonly rarity: RarityView;
  readonly acknowledgers: HTMLDivElement;
  readonly acknowledgerList: HTMLUListElement;
}

function buildEntryCard(entry: Entry, index: number): EntryView {
  const article = element('article', 'entry glass');
  article.id = `entry-${entry.id}`;
  article.dataset['kind'] = entry.kind;
  article.style.setProperty('--index', String(index));

  const head = element('header', 'entry__head');
  const theme = element('p', 'entry__theme');
  theme.append(
    iconNode(entry.kind === 'inspiration' ? 'spark' : 'question', 'icon entry__theme-icon'),
    element('span', undefined, entry.theme),
  );
  const rarity = createRarityView(entry.id);
  head.append(theme, rarity.wrap);

  const quote = element('blockquote', 'entry__quote');
  const text = element('p', 'entry__text', entry.text);
  quote.append(iconNode('quote', 'icon entry__mark'), text);

  const actions = element('div', 'entry__actions');
  const love = actionButton('action action--love', 'heart', 'Love');
  love.setAttribute('aria-pressed', 'false');
  love.addEventListener('click', () => {
    const active = !state.loved.includes(entry.id);
    void commit(toggleLove(state, entry.id));
    if (active) {
      love.classList.remove('is-bursting');
      // Restart the ring without forcing a reflow of the card.
      void love.offsetWidth;
      love.classList.add('is-bursting');
      navigator.vibrate?.(8);
    }
  });
  love.addEventListener('animationend', () => love.classList.remove('is-bursting'));

  const acknowledge = actionButton('action action--ack', 'seal', 'Acknowledge');
  acknowledge.addEventListener('click', () => openAckDialog(entry));

  const share = actionButton('action action--share', 'share', 'Share');
  share.addEventListener('click', () => {
    openShare({
      title: `Share · ${entry.theme}`,
      text: entry.text.replace(/\n/g, ' '),
      url: entryShareUrl(entry.id),
      qr: true,
    });
  });

  actions.append(love, acknowledge, share);

  const acknowledgers = element('div', 'acknowledgers');
  acknowledgers.hidden = true;
  const label = element('p', 'acknowledgers__label');
  label.append(iconNode('seal', 'icon'), element('span', undefined, 'Acknowledged by'));
  const acknowledgerList = element('ul', 'acknowledgers__list');
  acknowledgers.append(label, acknowledgerList);

  article.append(head, quote);
  if (entry.attribution !== undefined) {
    article.append(element('p', 'entry__attribution', `— ${entry.attribution}`));
  }
  article.append(actions, acknowledgers);

  return { entry, article, love, rarity, acknowledgers, acknowledgerList };
}

function refreshCard(view: EntryView): void {
  const loved = state.loved.includes(view.entry.id);
  view.love.setAttribute('aria-pressed', String(loved));
  view.love.classList.toggle('is-loved', loved);
  const label = view.love.querySelector<HTMLSpanElement>('.action__label');
  if (label !== null) label.textContent = loved ? 'Loved' : 'Love';

  updateRarity(view.rarity, computeRarity(view.entry, state.acknowledgments));

  const acknowledgments = acknowledgmentsFor(state, view.entry.id);
  view.acknowledgers.hidden = acknowledgments.length === 0;
  view.acknowledgerList.replaceChildren(...acknowledgments.map((ack) => acknowledgmentItem(ack)));
}

function renderEntries(entries: readonly Entry[]): void {
  const inspirationGrid = query<HTMLDivElement>('#inspiration-grid');
  const reflectionGrid = query<HTMLDivElement>('#reflection-grid');
  const inspirationFragment = document.createDocumentFragment();
  const reflectionFragment = document.createDocumentFragment();

  entries.forEach((entry, index) => {
    const view = buildEntryCard(entry, index);
    views.set(entry.id, view);
    if (entry.kind === 'inspiration') inspirationFragment.append(view.article);
    else reflectionFragment.append(view.article);
  });

  inspirationGrid.replaceChildren(inspirationFragment);
  reflectionGrid.replaceChildren(reflectionFragment);
}

function refreshAll(): void {
  for (const view of views.values()) refreshCard(view);
  renderVoices();
  applyReceptive();
}

/* ------------------------------------------------------------------ voices */

function renderVoices(): void {
  const voices = query<HTMLDivElement>('#voices');
  const list = query<HTMLUListElement>('#voices-list');
  const responses = generalResponses(state);
  voices.hidden = responses.length === 0;
  list.replaceChildren(...responses.map((ack) => acknowledgmentItem(ack, true)));
}

/* ------------------------------------------------------------------ dialog */

const dialog = query<HTMLDialogElement>('#ack-dialog');
const ackForm = query<HTMLFormElement>('#ack-form');
const ackFormView = query<HTMLDivElement>('#ack-form-view');
const ackSuccess = query<HTMLDivElement>('#ack-success');
let activeEntry: Entry | null = null;
let activePayload: AckPayload | null = null;

interface Identity {
  readonly name: string;
  readonly role: AckRole;
  readonly x: string;
  readonly facebook: string;
}

let lastIdentity: Identity | null = null;

function socialInputs(prefix: 'ack' | 'respond'): {
  readonly x: HTMLInputElement;
  readonly facebook: HTMLInputElement;
  readonly note: HTMLTextAreaElement;
  readonly name: HTMLInputElement;
} {
  return {
    x: query<HTMLInputElement>(`#${prefix}-x`),
    facebook: query<HTMLInputElement>(`#${prefix}-fb`),
    note: query<HTMLTextAreaElement>(`#${prefix}-note`),
    name: query<HTMLInputElement>(`#${prefix}-name`),
  };
}

function checkSocial(input: HTMLInputElement, network: SocialNetwork): boolean {
  const result = parseSocialUrl(input.value, network);
  if (result !== null && 'error' in result) {
    input.setCustomValidity(result.error);
    return false;
  }
  input.setCustomValidity('');
  return true;
}

function selectedRole(form: HTMLFormElement, name: string): AckRole {
  const checked = form.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`);
  const value = checked?.value;
  return value !== undefined && (ACK_ROLES as readonly string[]).includes(value)
    ? (value as AckRole)
    : 'observer';
}

function openAckDialog(entry: Entry): void {
  activeEntry = entry;
  activePayload = null;
  ackForm.reset();
  query<HTMLInputElement>('#ack-entry').value = entry.id;
  query<HTMLElement>('#ack-title').textContent = `Acknowledge this ${entry.kind}`;
  query<HTMLElement>('#ack-quote').textContent = `“${entry.text.replace(/\n/g, ' ')}”`;
  query<HTMLSpanElement>('#ack-count').textContent = '0';

  if (lastIdentity !== null) {
    query<HTMLInputElement>('#ack-name').value = lastIdentity.name;
    const role = ackForm.querySelector<HTMLInputElement>(
      `input[name="ack-role"][value="${lastIdentity.role}"]`,
    );
    if (role !== null) role.checked = true;
    query<HTMLInputElement>('#ack-x').value = lastIdentity.x;
    query<HTMLInputElement>('#ack-fb').value = lastIdentity.facebook;
  }

  ackFormView.hidden = false;
  ackSuccess.hidden = true;
  dialog.setAttribute('aria-labelledby', 'ack-title');
  if (!dialog.open) dialog.showModal();
  query<HTMLInputElement>('#ack-name').focus();
}

function closeAckDialog(): void {
  if (dialog.open) dialog.close();
  activeEntry = null;
  activePayload = null;
}

function ackSuccessCopy(payload: AckPayload, entry: Entry): string {
  return `Thank you, ${payload.name}. Your ${roleLabel(payload.role)} acknowledgment of “${entry.theme}” is held on this device. Carry it to Sir Collins and others you trust with a link.`;
}

function mailtoFor(payload: AckPayload): string {
  const entry = entries.find((item) => item.id === payload.entry);
  const subject = entry === undefined
    ? `Response from ${payload.name}`
    : `Acknowledgment from ${payload.name}`;
  const lines = [
    'Hello Sir Collins,',
    '',
    `Name: ${payload.name}`,
    `Role: ${roleLabel(payload.role)}`,
    ...(payload.x !== undefined ? [`X: ${payload.x}`] : []),
    ...(payload.facebook !== undefined ? [`Facebook: ${payload.facebook}`] : []),
    ...(entry !== undefined ? ['', `Acknowledging: “${entry.text.replace(/\n/g, ' ')}”`] : []),
    ...(payload.note !== undefined ? ['', `What I share or post: ${payload.note}`] : []),
    '',
    `Carrier link: ${ackLink(shareOrigin(), payload)}`,
  ];
  return `mailto:${CONTACT.professionalEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
}

/* ------------------------------------------------------------------- share */

interface ShareContent {
  readonly title: string;
  readonly text: string;
  readonly url: string;
  readonly qr: boolean;
}

const shareDialog = query<HTMLDialogElement>('#share-dialog');
const shareCanvas = query<HTMLCanvasElement>('#share-qr');
let shareContent: ShareContent | null = null;

function openShare(content: ShareContent): void {
  shareContent = content;
  query<HTMLElement>('#share-title').textContent = content.title;
  query<HTMLElement>('#share-text').textContent = content.text;
  query<HTMLElement>('#share-url').textContent = content.url;

  const qrWrap = query<HTMLDivElement>('#share-qr-wrap');
  const download = query<HTMLButtonElement>('#share-download');
  qrWrap.hidden = !content.qr;
  download.hidden = !content.qr;
  if (content.qr) {
    try {
      paintQr(shareCanvas, content.url, { pixels: 640 });
    } catch {
      qrWrap.hidden = true;
      download.hidden = true;
    }
  }

  if (!shareDialog.open) shareDialog.showModal();
}

/* ------------------------------------------------------------ token/giving */

let givingQrPainted = false;

function applyReceptive(): void {
  const active = state.receptive;
  document.documentElement.dataset['receptive'] = String(active);
  const card = query<HTMLElement>('#receptive');
  card.dataset['active'] = String(active);
  const toggle = query<HTMLButtonElement>('#receptive-toggle');
  toggle.setAttribute('aria-pressed', String(active));
  query<HTMLElement>('#receptive-status').textContent = active
    ? 'Open · Token/Giving Mode is active on this device.'
    : 'Closed · open the door when you are ready.';
  query<HTMLElement>('#receptive-badge').hidden = !active;

  const handshake = query<HTMLDivElement>('#receptive-handshake');
  handshake.hidden = !active;
  const telegram = query<HTMLAnchorElement>('#giving-telegram');
  telegram.href = GIVING_HANDSHAKE;
  query<HTMLElement>('#giving-url').textContent = GIVING_HANDSHAKE;

  if (active && !givingQrPainted) {
    const qrWrap = query<HTMLDivElement>('.receptive__qr');
    qrWrap.hidden = false;
    try {
      paintQr(query<HTMLCanvasElement>('#giving-qr'), GIVING_HANDSHAKE, { pixels: 640 });
      givingQrPainted = true;
    } catch {
      // A missing encoder must not hide the written handshake.
      qrWrap.hidden = true;
    }
  }
}

/* ------------------------------------------------------------------ surface */

type Screen = 'home' | 'work' | 'words' | 'give' | 'respond';
type WordsKind = 'inspirations' | 'reflections';

const SCREEN_HASH: Readonly<Record<string, Screen>> = {
  home: 'home',
  main: 'home',
  realities: 'work',
  skills: 'work',
  'skills-title': 'work',
  'creative-title': 'work',
  concepts: 'work',
  'concepts-title': 'work',
  stage: 'work',
  'stage-title': 'work',
  'stage-more': 'work',
  inspirations: 'words',
  'inspirations-title': 'words',
  reflections: 'words',
  'reflections-title': 'words',
  rarity: 'words',
  receptive: 'give',
  'receptive-title': 'give',
  respond: 'respond',
  'respond-title': 'respond',
  voices: 'respond',
  'contact-title': 'respond',
};

const mobileQuery = window.matchMedia('(max-width: 48rem)');

/** True when the five-screen app surface should replace the long page. */
function isMobileSurface(): boolean {
  return isBundledApp() || mobileQuery.matches;
}

function hashKey(hash: string): string {
  return hash.replace(/^#/, '');
}

function screenForHash(hash: string): Screen {
  if (hash.startsWith('#entry-')) return 'words';
  if (hash.startsWith('#ack=')) return 'home';
  return SCREEN_HASH[hashKey(hash)] ?? 'home';
}

function wordsForHash(hash: string): WordsKind | null {
  const key = hashKey(hash);
  if (key === 'reflections' || key === 'reflections-title' || key === 'reflection-grid') {
    return 'reflections';
  }
  if (key === 'inspirations' || key === 'inspirations-title' || key === 'inspiration-grid') {
    return 'inspirations';
  }
  if (key.startsWith('entry-')) {
    const id = key.slice('entry-'.length);
    const entry = entries.find((item) => item.id === id);
    if (entry !== undefined) {
      return entry.kind === 'reflection' ? 'reflections' : 'inspirations';
    }
  }
  return null;
}

function setWords(kind: WordsKind, replaceHash = false): void {
  document.documentElement.dataset['words'] = kind;
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-words-btn]')) {
    button.setAttribute('aria-pressed', String(button.dataset['wordsBtn'] === kind));
  }
  if (!replaceHash || !isMobileSurface()) return;
  const hash = kind === 'reflections' ? '#reflections' : '#inspirations';
  if (window.location.hash !== hash) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`);
  }
}

function showScreen(screen: Screen, scroll = true): void {
  if (!isMobileSurface()) return;
  document.documentElement.dataset['screen'] = screen;
  for (const node of document.querySelectorAll<HTMLElement>('.app-screen')) {
    const active = node.dataset['screen'] === screen;
    node.classList.toggle('is-active', active);
    if (active) node.removeAttribute('aria-hidden');
    else node.setAttribute('aria-hidden', 'true');
  }
  for (const item of document.querySelectorAll<HTMLAnchorElement>('.app-nav__item')) {
    if (item.dataset['screenLink'] === screen) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  }
  if (scroll) window.scrollTo({ top: 0, behavior: 'auto' });
}

function revealTarget(hash: string): void {
  if (hash === '' || hash === '#' || hash.startsWith('#ack=')) return;
  const id = hashKey(hash);
  if (id.startsWith('entry-')) {
    scrollToEntry(id.slice('entry-'.length));
    return;
  }
  const target = document.getElementById(id);
  if (target === null) return;
  target.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'start',
  });
}

function navigate(hash: string, reveal = true): void {
  if (window.location.hash !== hash) {
    window.history.pushState(null, '', hash);
  }
  const words = wordsForHash(hash);
  if (words !== null) setWords(words);
  showScreen(screenForHash(hash));
  if (reveal) window.setTimeout(() => revealTarget(hash), 40);
}

function applySurface(): void {
  const mobile = isMobileSurface();
  const root = document.documentElement;
  root.dataset['mobileApp'] = String(mobile);

  for (const node of document.querySelectorAll<HTMLDetailsElement>(
    '.stage__more, .concept__hint, .form-more',
  )) {
    node.open = !mobile;
  }

  if (mobile) {
    const hash = window.location.hash;
    setWords(wordsForHash(hash) ?? 'inspirations');
    showScreen(screenForHash(hash), false);
    return;
  }

  for (const node of document.querySelectorAll<HTMLElement>('.app-screen')) {
    node.classList.remove('is-active');
    node.removeAttribute('aria-hidden');
  }
  for (const item of document.querySelectorAll<HTMLAnchorElement>('.app-nav__item')) {
    item.removeAttribute('aria-current');
  }
  delete root.dataset['screen'];
  delete root.dataset['words'];
}

function renderWordsCounts(): void {
  const counts: Record<WordsKind, number> = { inspirations: 0, reflections: 0 };
  for (const entry of entries) {
    const kind: WordsKind = entry.kind === 'inspiration' ? 'inspirations' : 'reflections';
    counts[kind] += 1;
  }
  for (const kind of ['inspirations', 'reflections'] as const) {
    const node = document.getElementById(`words-count-${kind}`);
    if (node !== null) node.textContent = String(counts[kind]);
  }
}

function renderCarrierFromHash(): void {
  const hash = window.location.hash;
  if (!hash.startsWith('#ack=')) return;
  const payload = decodeAck(hash.slice('#ack='.length), validEntryIds);
  if (payload !== null) renderCarrier(payload);
}

/* ------------------------------------------------------------------- boot */

/**
 * Both role fieldsets are generated from `ACK_ROLES`, so a new role cannot be
 * added in one form and forgotten in the other.
 */
function renderRoleOptions(): void {
  for (const group of document.querySelectorAll<HTMLDivElement>('[data-role-options]')) {
    const name = group.dataset['roleOptions'];
    if (name === undefined) continue;
    const defaultRole = group.dataset['defaultRole'] ?? 'observer';
    const fragment = document.createDocumentFragment();

    for (const role of ACK_ROLES) {
      const label = element('label', 'role-option');
      const input = element('input');
      input.type = 'radio';
      input.name = name;
      input.value = role;
      input.checked = role === defaultRole;

      const body = element('span', 'role-option__body');
      const icon = element('span', 'role-option__icon');
      icon.append(iconNode(ACK_ROLE_ICON[role]));

      body.append(
        icon,
        element('span', 'role-option__title', ACK_ROLE_LABEL[role]),
        element('span', 'role-option__desc', ACK_ROLE_DESCRIPTION[role]),
      );
      label.append(input, body);
      fragment.append(label);
    }

    group.replaceChildren(fragment);
  }
}

function renderRoles(): void {
  const list = query<HTMLUListElement>('#role-list');
  const fragment = document.createDocumentFragment();
  ROLES.forEach((role, index) => {
    const item = element('li');
    item.append(iconNode(ROLE_ICONS[index] ?? 'spark'), element('span', undefined, role));
    fragment.append(item);
  });
  list.replaceChildren(fragment);
}

function renderContacts(): void {
  const email = query<HTMLAnchorElement>('#contact-email');
  email.href = `mailto:${CONTACT.professionalEmail}`;
  const personal = query<HTMLAnchorElement>('#contact-personal');
  personal.href = `mailto:${CONTACT.personalEmail}`;
  const telegram = query<HTMLAnchorElement>('#contact-telegram');
  telegram.href = CONTACT.telegram;
}

function renderRarityLegend(): void {
  const host = query<HTMLDivElement>('#rarity-tiers');
  const fragment = document.createDocumentFragment();
  for (const tier of RARITY_TIERS) {
    const chip = element('span', `tier tier--${tier.id}`);
    chip.append(iconNode(tier.icon as IconName), element('span', undefined, tier.label));
    fragment.append(chip);
  }
  host.replaceChildren(fragment);
  query<HTMLParagraphElement>('#rarity-note').textContent = RARITY_SCALE_NOTE;
}

function renderYear(): void {
  const year = String(new Date().getFullYear());
  for (const id of ['year', 'year-mobile']) {
    const node = document.getElementById(id);
    if (node !== null) node.textContent = year;
  }
}

const ENGINE_LABEL: Record<StorageEngine, string> = {
  opfs: 'Sovereign storage: OPFS',
  localstorage: 'Storage: on this device',
  memory: 'Storage: volatile (not saved)',
};

function reportStorage(engine: StorageEngine): void {
  const badge = query<HTMLSpanElement>('#storage-status');
  badge.textContent = ENGINE_LABEL[engine];
  badge.dataset['engine'] = engine;
  badge.hidden = engine === 'opfs';
}

function initReveal(): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!('IntersectionObserver' in window)) return;

  const targets = [...document.querySelectorAll<HTMLElement>('.section, .legend, .contact')];
  const observer = new IntersectionObserver(
    (items) => {
      for (const item of items) {
        if (!item.isIntersecting) continue;
        item.target.classList.add('is-visible');
        observer.unobserve(item.target);
      }
    },
    { rootMargin: '0px 0px -7% 0px', threshold: 0.05 },
  );

  for (const target of targets) {
    if (target.getBoundingClientRect().top > window.innerHeight * 0.94) {
      target.classList.add('will-reveal');
      observer.observe(target);
    }
  }
}

function scrollToEntry(entryId: string): void {
  const node = document.getElementById(`entry-${entryId}`);
  if (node === null) return;
  node.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'center',
  });
  node.classList.add('is-target');
  window.setTimeout(() => node.classList.remove('is-target'), 2_800);
}

function carrierLinkText(payload: AckPayload): string {
  if (payload.entry === 'general') return `A response from ${payload.name}`;
  const entry = entries.find((item) => item.id === payload.entry);
  return entry === undefined
    ? `An acknowledgment from ${payload.name}`
    : `An acknowledgment of “${entry.theme}” from ${payload.name}`;
}

function renderCarrier(payload: AckPayload): void {
  const mount = query<HTMLDivElement>('#carrier');
  const entry = entries.find((item) => item.id === payload.entry);
  const card = element('aside', 'carrier glass');
  card.setAttribute('role', 'region');
  card.setAttribute('aria-label', 'Acknowledgment carried by link');

  const head = element('div', 'carrier__head');
  const icon = element('span', 'tile');
  icon.append(iconNode('gift', 'icon icon--tile'));
  const copy = element('div', 'carrier__copy');
  copy.append(
    element('p', 'eyebrow', payload.entry === 'general' ? 'A response carried by link' : 'An acknowledgment carried by link'),
    element(
      'p',
      'carrier__line',
      entry === undefined
        ? `${payload.name} · ${roleLabel(payload.role)}`
        : `${payload.name} · ${roleLabel(payload.role)} · “${entry.theme}”`,
    ),
  );
  if (payload.note !== undefined) {
    copy.append(element('p', 'carrier__note', `“${payload.note}”`));
  }
  head.append(icon, copy);

  const actions = element('div', 'carrier__actions');
  const accept = element('button', 'btn btn--primary');
  accept.type = 'button';
  accept.append(iconNode('seal'), element('span', undefined, 'Add to this device'));
  const dismiss = element('button', 'btn btn--ghost', 'Dismiss');
  dismiss.type = 'button';
  actions.append(accept, dismiss);

  accept.addEventListener('click', () => {
    const ack = payloadToAck(payload, 'link');
    const duplicate = addAcknowledgment(state, ack) === state;
    void commit(addAcknowledgment(state, ack)).then(() => {
      card.remove();
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
      toast(duplicate ? 'Already held on this device.' : 'Acknowledgment added to this device.');
      if (entry !== undefined) {
        if (isMobileSurface()) {
          setWords(entry.kind === 'reflection' ? 'reflections' : 'inspirations');
          showScreen('words');
        }
        scrollToEntry(entry.id);
      } else {
        if (isMobileSurface()) showScreen('respond');
        query<HTMLElement>('#voices').scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  });

  dismiss.addEventListener('click', () => {
    card.remove();
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    toast('Carrier link dismissed.');
  });

  card.append(head, actions);
  mount.replaceChildren(card);
}

/* ------------------------------------------------------------------ events */

const entries = readEntries();
const validEntryIds = new Set(entries.map((entry) => entry.id));

query<HTMLButtonElement>('#receptive-toggle').addEventListener('click', () => {
  const next = !state.receptive;
  void commit(setReceptive(state, next));
  toast(next ? 'Token/Giving Mode open.' : 'Token/Giving Mode closed.');
});

for (const input of [
  query<HTMLInputElement>('#respond-x'),
  query<HTMLInputElement>('#respond-fb'),
  query<HTMLInputElement>('#ack-x'),
  query<HTMLInputElement>('#ack-fb'),
]) {
  input.addEventListener('input', () => input.setCustomValidity(''));
}

for (const [noteId, countId] of [
  ['respond-note', 'respond-count'],
  ['ack-note', 'ack-count'],
] as const) {
  const note = query<HTMLTextAreaElement>(`#${noteId}`);
  const count = query<HTMLSpanElement>(`#${countId}`);
  note.addEventListener('input', () => {
    count.textContent = String(note.value.length);
  });
}

ackForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (activeEntry === null) return;
  const entry = activeEntry;
  const fields = socialInputs('ack');
  if (!checkSocial(fields.x, 'x') || !checkSocial(fields.facebook, 'facebook')) {
    ackForm.reportValidity();
    return;
  }

  const payload = createAckPayload({
    entry: entry.id,
    name: fields.name.value,
    role: selectedRole(ackForm, 'ack-role'),
    x: fields.x.value,
    facebook: fields.facebook.value,
    note: fields.note.value,
  });
  if (payload === null) {
    toast('Add your name to continue.');
    fields.name.focus();
    return;
  }

  activePayload = payload;
  void commit(addAcknowledgment(state, payloadToAck(payload, 'local')));
  lastIdentity = {
    name: payload.name,
    role: payload.role,
    x: payload.x ?? '',
    facebook: payload.facebook ?? '',
  };

  query<HTMLElement>('#ack-success-title').textContent = 'Thank you';
  query<HTMLElement>('#ack-success-copy').textContent = ackSuccessCopy(payload, entry);
  ackFormView.hidden = true;
  ackSuccess.hidden = false;
  dialog.setAttribute('aria-labelledby', 'ack-success-title');
  toast('Acknowledgment held on this device.');
});

query<HTMLButtonElement>('#ack-copy-link').addEventListener('click', () => {
  if (activePayload === null) return;
  void copyText(ackLink(shareOrigin(), activePayload)).then((copied) => {
    toast(copied ? 'Acknowledgment link copied.' : 'Could not copy the link.');
  });
});

query<HTMLButtonElement>('#ack-share-link').addEventListener('click', () => {
  if (activePayload === null) return;
  openShare({
    title: 'An acknowledgment for Sir Collins',
    text: carrierLinkText(activePayload),
    url: ackLink(shareOrigin(), activePayload),
    qr: false,
  });
});

query<HTMLButtonElement>('#ack-email-link').addEventListener('click', () => {
  if (activePayload === null) return;
  window.location.href = mailtoFor(activePayload);
});

for (const id of ['#ack-close', '#ack-cancel', '#ack-done']) {
  query<HTMLButtonElement>(id).addEventListener('click', closeAckDialog);
}

const respondForm = query<HTMLFormElement>('#respond-form');
let responsePayload: AckPayload | null = null;

respondForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const fields = socialInputs('respond');
  if (!checkSocial(fields.x, 'x') || !checkSocial(fields.facebook, 'facebook')) {
    respondForm.reportValidity();
    return;
  }

  const payload = createAckPayload({
    entry: 'general',
    name: fields.name.value,
    role: selectedRole(respondForm, 'respond-role'),
    x: fields.x.value,
    facebook: fields.facebook.value,
    note: fields.note.value,
  });
  if (payload === null) {
    toast('Add your name to continue.');
    fields.name.focus();
    return;
  }

  responsePayload = payload;
  void commit(addAcknowledgment(state, payloadToAck(payload, 'local')));

  const result = query<HTMLDivElement>('#response-result');
  query<HTMLElement>('#response-result-copy').textContent =
    `Thank you, ${payload.name}. Your ${roleLabel(payload.role)} response is sealed on this device.`;
  result.hidden = false;
  respondForm.reset();
  query<HTMLSpanElement>('#respond-count').textContent = '0';
  result.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'center',
  });
  toast('Response held on this device.');
});

query<HTMLButtonElement>('#response-copy').addEventListener('click', () => {
  if (responsePayload === null) return;
  void copyText(ackLink(shareOrigin(), responsePayload)).then((copied) => {
    toast(copied ? 'Response link copied.' : 'Could not copy the link.');
  });
});

query<HTMLButtonElement>('#response-email').addEventListener('click', () => {
  if (responsePayload === null) return;
  window.location.href = mailtoFor(responsePayload);
});

query<HTMLButtonElement>('#response-telegram').addEventListener('click', () => {
  if (responsePayload === null) return;
  const url = ackLink(shareOrigin(), responsePayload);
  const text = `A response for Sir Collins from ${responsePayload.name}`;
  window.open(
    `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
    '_blank',
    'noopener,noreferrer',
  );
});

query<HTMLButtonElement>('#response-clear').addEventListener('click', () => {
  responsePayload = null;
  query<HTMLDivElement>('#response-result').hidden = true;
});

query<HTMLButtonElement>('#share-copy').addEventListener('click', () => {
  if (shareContent === null) return;
  void copyText(shareContent.url).then((copied) => {
    toast(copied ? 'Link copied.' : 'Could not copy the link.');
  });
});

query<HTMLButtonElement>('#share-native').addEventListener('click', () => {
  if (shareContent === null) return;
  const bridge = nativeBridge();
  if (bridge?.shareText !== undefined) {
    try {
      if (bridge.shareText(shareContent.title, shareContent.text, shareContent.url)) return;
    } catch {
      // Fall through to the web share API.
    }
  }
  if (!('share' in navigator)) {
    void copyText(shareContent.url).then(() => toast('Link copied instead.'));
    return;
  }
  void navigator
    .share({ title: shareContent.title, text: shareContent.text, url: shareContent.url })
    .catch(() => {
      /* The user dismissed the sheet; nothing to report. */
    });
});

query<HTMLButtonElement>('#share-download').addEventListener('click', () => {
  if (shareContent === null || !shareContent.qr) return;
  downloadCanvas(shareCanvas, 'sir-collins-portal-qr.png');
  toast('QR saved.');
});

for (const id of ['#share-close', '#share-done']) {
  query<HTMLButtonElement>(id).addEventListener('click', () => shareDialog.close());
}

query<HTMLButtonElement>('#portal-qr').addEventListener('click', () => {
  openShare({
    title: 'Carry the portal',
    text: SITE_TAGLINE,
    url: `${shareOrigin()}/`,
    qr: true,
  });
});

query<HTMLButtonElement>('#home-qr').addEventListener('click', () => {
  openShare({
    title: 'Carry the portal',
    text: SITE_TAGLINE,
    url: `${shareOrigin()}/`,
    qr: true,
  });
});

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-words-btn]')) {
  button.addEventListener('click', () => {
    const kind: WordsKind = button.dataset['wordsBtn'] === 'reflections'
      ? 'reflections'
      : 'inspirations';
    setWords(kind, true);
    window.scrollTo({ top: 0, behavior: 'auto' });
  });
}

document.addEventListener('click', (event) => {
  if (!isMobileSurface()) return;
  const target = event.target;
  if (!(target instanceof Element)) return;

  const anchor = target.closest<HTMLAnchorElement>('a[href^="#"]');
  if (anchor === null) return;
  const href = anchor.getAttribute('href');
  if (href === null) return;
  if (href === '#main') return;

  event.preventDefault();
  navigate(href, !anchor.classList.contains('app-nav__item'));
});

const brandHome = document.querySelector<HTMLAnchorElement>('.brand');
brandHome?.addEventListener('click', (event) => {
  if (!isMobileSurface()) return;
  event.preventDefault();
  navigate('#home');
});

window.addEventListener('hashchange', () => {
  if (!isMobileSurface()) return;
  const hash = window.location.hash;
  const words = wordsForHash(hash);
  if (words !== null) setWords(words);
  showScreen(screenForHash(hash));
  renderCarrierFromHash();
  window.setTimeout(() => revealTarget(hash), 40);
});

window.addEventListener('popstate', () => {
  if (!isMobileSurface()) return;
  const hash = window.location.hash;
  const words = wordsForHash(hash);
  if (words !== null) setWords(words);
  showScreen(screenForHash(hash));
  renderCarrierFromHash();
  window.setTimeout(() => revealTarget(hash), 40);
});

mobileQuery.addEventListener('change', applySurface);

query<HTMLButtonElement>('#giving-download').addEventListener('click', () => {
  downloadCanvas(query<HTMLCanvasElement>('#giving-qr'), 'sir-collins-giving-plan-qr.png');
  toast('Giving QR saved.');
});

for (const node of document.querySelectorAll<HTMLDialogElement>('dialog')) {
  node.addEventListener('click', (event) => {
    if (event.target === node) node.close();
  });
}

document.addEventListener('click', (event) => {
  for (const wrap of document.querySelectorAll<HTMLDivElement>('.rarity.is-open')) {
    if (event.target instanceof Node && wrap.contains(event.target)) continue;
    wrap.classList.remove('is-open');
    const trigger = wrap.querySelector<HTMLButtonElement>('.rarity__trigger');
    trigger?.setAttribute('aria-expanded', 'false');
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  for (const wrap of document.querySelectorAll<HTMLDivElement>('.rarity.is-open')) {
    wrap.classList.remove('is-open');
    const trigger = wrap.querySelector<HTMLButtonElement>('.rarity__trigger');
    trigger?.setAttribute('aria-expanded', 'false');
  }
});

async function registerServiceWorker(): Promise<void> {
  // Every asset already ships inside the APK; a worker would only add a
  // second cache that can go stale between releases.
  if (isBundledApp()) return;
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch {
    // Offline support is an enhancement; never block the page on it.
  }
}

async function boot(): Promise<void> {
  hydrateIcons();
  renderRoleOptions();
  renderRoles();
  renderContacts();
  renderRarityLegend();
  renderYear();
  writeJsonLd(entries, readSkills());
  renderEntries(entries);
  renderWordsCounts();

  store = await createSovereignStore();
  reportStorage(store.engine);
  state = parseState(await store.get<unknown>(STATE_KEY));
  await store.remove(LEGACY_TEASERS_KEY);
  refreshAll();
  applySurface();
  document.documentElement.dataset['appReady'] = 'true';
  if (!isMobileSurface()) initReveal();

  const rawCarrier = window.location.hash.startsWith('#ack=')
    ? window.location.hash.slice('#ack='.length)
    : null;
  if (rawCarrier !== null) {
    const payload = decodeAck(rawCarrier, validEntryIds);
    if (payload !== null) {
      renderCarrier(payload);
    } else {
      toast('That carrier link could not be read.');
    }
  } else if (window.location.hash.startsWith('#entry-')) {
    const entryId = window.location.hash.slice('#entry-'.length);
    window.setTimeout(() => scrollToEntry(entryId), 120);
  } else if (window.location.hash !== '') {
    window.setTimeout(() => revealTarget(window.location.hash), 120);
  }

  document.documentElement.dataset['ready'] = 'true';
  document.title = `${SITE_NAME} — The Living Portal`;

  await registerServiceWorker();
}

void boot().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  const banner = document.querySelector<HTMLParagraphElement>('#fatal');
  if (banner !== null) {
    banner.textContent = `Interface degraded: ${message}`;
    banner.hidden = false;
  }
});
