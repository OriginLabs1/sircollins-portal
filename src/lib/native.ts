/**
 * Android shell bridge.
 *
 * The bundled app is a WebView, so a few surfaces that a browser provides for
 * free (downloads, the share sheet, the clipboard) are handed to the native
 * side through `window.SirCollinsApp`. Every call is optional: when the page
 * runs in a normal browser the same code paths fall back to the web APIs.
 *
 * The interface name is part of the app contract; keep it in sync with
 * `android/app/src/main/java/net/coreconcept1/sircollins/MainActivity.java`.
 */

export interface SirCollinsBridge {
  /** Saves a data: URL (the Giving QR) without a storage permission prompt. */
  readonly saveImage: (dataUrl: string, fileName: string) => boolean;
  /** Opens the native share sheet. Returns false when it cannot be shown. */
  readonly shareText?: (title: string, text: string, url: string) => boolean;
  /** Copies text through the platform clipboard. */
  readonly copyText?: (value: string) => boolean;
}

declare global {
  interface Window {
    readonly SirCollinsApp?: SirCollinsBridge;
  }
}

/** The native bridge, when this page is running inside the Android app. */
export function nativeBridge(): SirCollinsBridge | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.SirCollinsApp;
}

/** True when the page is served from the app's private asset origin. */
export function isBundledApp(): boolean {
  return typeof window !== 'undefined' && window.location.hostname === 'appassets.androidplatform.net';
}
