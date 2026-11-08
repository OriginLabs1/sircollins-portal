/**
 * A small, hand-curated icon set.
 *
 * Every glyph exists for a reason the interface can name: roles, witness,
 * rarity, transport. They are inline SVG so they inherit colour, need no
 * network request, and can be used offline. No icon font, no runtime library.
 */

const BODIES = {
  home:
    '<path d="M3.5 10.8L12 3.5l8.5 7.3"/><path d="M5.8 9.4V20.5h12.4V9.4"/><path d="M9.8 20.5v-5.6h4.4v5.6"/>',
  spark:
    '<path d="M12 3.2l1.7 4.9 4.9 1.7-4.9 1.7L12 16.4l-1.7-4.9L5.4 9.8l4.9-1.7L12 3.2z"/><path d="M18.2 15.4l.7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7.7-2.1z"/>',
  quote:
    '<path fill="currentColor" stroke="none" d="M9.4 6.2C6.2 7.4 4.4 10 4.4 13.2V18h6.2v-6.2H7.4c0-1.7 1-3 2.9-3.9l-.9-1.7zm9.2 0c-3.2 1.2-5 3.8-5 7V18H20v-6.2h-3.2c0-1.7 1-3 2.9-3.9l-1.1-1.7z"/>',
  heart:
    '<path d="M20.4 8.6a5.1 5.1 0 0 0-8.4-3.2 5.1 5.1 0 0 0-8.4 3.2c0 5.3 8.4 10.3 8.4 10.3s8.4-5 8.4-10.3z"/>',
  seal:
    '<path d="M12 2.8l2.2 1.6 2.7-.3 1.2 2.4 2.4 1.2-.3 2.7L21.8 12l-1.6 2.2.3 2.7-2.4 1.2-1.2 2.4-2.7-.3L12 21.2l-2.2-1.6-2.7.3-1.2-2.4-2.4-1.2.3-2.7L2.2 12l1.6-2.2-.3-2.7 2.4-1.2 1.2-2.4 2.7.3L12 2.8z"/><path d="M8.6 12.2l2.2 2.2 4.6-4.6"/>',
  share:
    '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.3 10.8l7.4-4.4M8.3 13.2l7.4 4.4"/>',
  link:
    '<path d="M10.5 13.5a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 1 0-5.7-5.7l-1.6 1.6"/><path d="M13.5 10.5a4 4 0 0 0-5.7 0L5 13.3a4 4 0 1 0 5.7 5.7l1.6-1.6"/>',
  copy:
    '<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5"/>',
  check: '<path d="M20 6.5L9.5 17 4 11.5"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  download: '<path d="M12 3v12"/><path d="M7.5 10.5L12 15l4.5-4.5"/><path d="M4 20h16"/>',
  'x-social':
    '<path fill="currentColor" stroke="none" d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3l-4.9-6.4L6.4 22H3.3l7.3-8.3L2.8 2h6.4l4.4 5.8L18.9 2zm-1.1 18h1.7L7.3 3.9H5.5L17.8 20z"/>',
  facebook:
    '<path fill="currentColor" stroke="none" d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12z"/>',
  eye:
    '<path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  broadcast:
    '<circle cx="12" cy="12" r="2"/><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7"/><path d="M5.5 5.5a9 9 0 0 0 0 13M18.5 5.5a9 9 0 0 1 0 13"/>',
  pen:
    '<path d="M12 20h9"/><path d="M16.6 3.4a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.6 3.4z"/>',
  users:
    '<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16.5 5.2a3.2 3.2 0 0 1 0 5.9"/><path d="M17.5 14.2A5.6 5.6 0 0 1 21 20"/>',
  badge:
    '<circle cx="12" cy="9" r="5.2"/><path d="M8.6 13.4L7.2 21l4.8-2.4L16.8 21l-1.4-7.6"/><path d="M10.4 9l1.2 1.2 2.2-2.3"/>',
  open:
    '<path d="M13 4H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6"/><path d="M16 8l4 4-4 4"/><path d="M20 12H9"/>',
  gift:
    '<rect x="3" y="8" width="18" height="13" rx="2"/><path d="M3 12h18M12 8v13"/><path d="M12 8C9 8 7.5 6.8 7.5 5.2A2.2 2.2 0 0 1 12 4.2a2.2 2.2 0 0 1 4.5 1C16.5 6.8 15 8 12 8z"/>',
  compass:
    '<circle cx="12" cy="12" r="9"/><path d="M15.8 8.2l-2.1 5.5-5.5 2.1 2.1-5.5 5.5-2.1z"/>',
  route:
    '<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H14a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5"/>',
  book:
    '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M8 7h8"/>',
  cpu:
    '<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M9.5 3v4M14.5 3v4M9.5 17v4M14.5 17v4M3 9.5h4M3 14.5h4M17 9.5h4M17 14.5h4"/><rect x="10.5" y="10.5" width="3" height="3" rx=".5"/>',
  sparkles:
    '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"/><path d="M19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16z"/><path d="M5 3l.5 1.5L7 5l-1.5.5L5 7l-.5-1.5L3 5l1.5-.5L5 3z"/>',
  question:
    '<circle cx="12" cy="12" r="9"/><path d="M9.2 9.2a2.9 2.9 0 1 1 4.6 2.4c-.9.6-1.8 1.2-1.8 2.6"/><circle cx="12" cy="17.2" r=".9" fill="currentColor" stroke="none"/>',
  'arrow-down': '<path d="M12 4v16"/><path d="M6 14l6 6 6-6"/>',
  'arrow-right': '<path d="M4 12h16"/><path d="M14 6l6 6-6 6"/>',
  mail: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M3 7l9 6 9-6"/>',
  telegram:
    '<path d="M21.5 3.5L2.8 10.8l5.7 2.1L10 20l3.6-5.1 5.9 3.3 2-14.7z"/><path d="M8.5 12.9l11-8.2"/>',
  seed: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none"/>',
  leaf:
    '<path d="M20 4C10.5 4 4 10.5 4 20c9.5 0 16-6.5 16-16z"/><path d="M4 20c4-4 7.5-6.5 11-8"/>',
  gem:
    '<path d="M7 3h10l4 6-9 12L3 9l4-6z"/><path d="M3 9h18M9.5 9L12 21l2.5-12M7 3l2.5 6M17 3l-2.5 6"/>',
  diamond:
    '<path d="M12 2.5l6.8 9.5-6.8 9.5L5.2 12 12 2.5z"/><path d="M5.2 12h13.6M12 2.5L9 12l3 9.5 3-9.5-3-9.5z"/>',
  starburst:
    '<path d="M12 2.5l2.4 5.9 6.3.6-4.8 4.2 1.4 6.2L12 16.2l-5.3 3.2 1.4-6.2L3.3 9l6.3-.6L12 2.5z"/><path d="M19 17.5l.6 1.9 1.9.6-1.9.6-.6 1.9-.6-1.9-1.9-.6 1.9-.6.6-1.9z"/>',
  qr:
    '<rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="3" y="15" width="6" height="6" rx="1"/><path d="M15 15h2v2h-2z"/><path d="M19 15h2M15 19v2M19 19h2v2h-2z"/>',
  globe:
    '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9S14.5 18.5 12 21c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z"/>',
  lock:
    '<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  'chevron-down': '<path d="M6 9l6 6 6-6"/>',
  code:
    '<path d="M8.5 7.5L4 12l4.5 4.5"/><path d="M15.5 7.5L20 12l-4.5 4.5"/><path d="M13.4 4.5l-2.8 15"/>',
  film:
    '<rect x="2.5" y="4.5" width="19" height="15" rx="2.5"/><path d="M7 4.5v15M17 4.5v15M2.5 9.5h4.5M17 9.5h4.5M2.5 14.5h4.5M17 14.5h4.5"/>',
  music:
    '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  palette:
    '<path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-.9 2-1.9 0-1.4-1.2-1.8-1.2-2.9 0-.9.7-1.5 1.7-1.5H16a5 5 0 0 0 5-5c0-3.9-4-6.7-9-6.7z"/><circle cx="7.5" cy="10" r="1.1" fill="currentColor" stroke="none"/><circle cx="10" cy="6.8" r="1.1" fill="currentColor" stroke="none"/><circle cx="14.5" cy="6.8" r="1.1" fill="currentColor" stroke="none"/>',
  play:
    '<circle cx="12" cy="12" r="9"/><path d="M10 8.5l6 3.5-6 3.5v-7z" fill="currentColor" stroke="none"/>',
  mic:
    '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0"/><path d="M12 18v3M9 21h6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
} as const;

export type IconName = keyof typeof BODIES;

export function isIconName(value: string): value is IconName {
  return Object.prototype.hasOwnProperty.call(BODIES, value);
}

export function icon(name: IconName, className = 'icon'): string {
  return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${BODIES[name]}</svg>`;
}

/** Create an SVG node from the set, safe because the markup is authored here. */
export function iconNode(name: IconName, className = 'icon'): SVGSVGElement {
  const template = document.createElement('template');
  template.innerHTML = icon(name, className).trim();
  const node = template.content.firstElementChild;
  if (!(node instanceof SVGSVGElement)) throw new Error(`Icon did not render: ${name}`);
  return node;
}

/** Replace every `[data-icon]` placeholder under `root` with its SVG. */
export function hydrateIcons(root: ParentNode = document): void {
  for (const host of root.querySelectorAll<HTMLElement>('[data-icon]')) {
    const name = host.dataset['icon'];
    if (name === undefined || !isIconName(name)) continue;
    const className = host.dataset['iconClass'] ?? 'icon';
    host.replaceChildren(iconNode(name, className));
  }
}
