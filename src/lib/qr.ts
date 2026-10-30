/**
 * Client-side QR generation.
 *
 * The encoder is vendored from Project Nayuki's MIT-licensed library so the
 * PWA stays offline-first and no image leaves the device. QR codes here carry
 * public destinations only (the portal, an entry). Acknowledgment links carry a
 * person's details, so they are shared directly, never printed as a code.
 */

import qrcodegen from '../vendor/qrcodegen.ts';

interface QrLike {
  readonly size: number;
  getModule(x: number, y: number): boolean;
}

export interface QrMatrix {
  /** Module count per side, excluding the quiet zone. */
  readonly size: number;
  /** Row-major modules, true = dark. */
  readonly modules: readonly boolean[];
}

export function buildQrMatrix(text: string): QrMatrix {
  const qr = qrcodegen.QrCode.encodeText(text, qrcodegen.QrCode.Ecc.MEDIUM) as QrLike;
  const modules: boolean[] = [];
  for (let y = 0; y < qr.size; y += 1) {
    for (let x = 0; x < qr.size; x += 1) {
      modules.push(qr.getModule(x, y));
    }
  }
  return { size: qr.size, modules };
}

export interface PaintOptions {
  readonly dark?: string;
  readonly light?: string;
  readonly quiet?: number;
  /** Target pixel width of the rendered canvas. */
  readonly pixels?: number;
}

/**
 * Paint a QR onto a canvas at a crisp integer module scale. Returns the pixel
 * size used, so callers can size the download or the CSS box.
 */
export function paintQr(canvas: HTMLCanvasElement, text: string, options: PaintOptions = {}): number {
  const matrix = buildQrMatrix(text);
  const quiet = Math.max(2, options.quiet ?? 4);
  const dark = options.dark ?? '#0a1020';
  const light = options.light ?? '#f7f9ff';
  const target = Math.max(160, options.pixels ?? 640);
  const total = matrix.size + quiet * 2;
  const scale = Math.max(2, Math.floor(target / total));
  const pixels = total * scale;

  canvas.width = pixels;
  canvas.height = pixels;
  const context = canvas.getContext('2d');
  if (context === null) return pixels;

  context.fillStyle = light;
  context.fillRect(0, 0, pixels, pixels);
  context.fillStyle = dark;
  for (let y = 0; y < matrix.size; y += 1) {
    for (let x = 0; x < matrix.size; x += 1) {
      if (matrix.modules[y * matrix.size + x] === true) {
        context.fillRect((x + quiet) * scale, (y + quiet) * scale, scale, scale);
      }
    }
  }
  return pixels;
}

export function downloadCanvas(canvas: HTMLCanvasElement, fileName: string): void {
  canvas.toBlob((blob) => {
    if (blob === null) return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
  }, 'image/png');
}
