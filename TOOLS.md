# TOOLS: Available Libraries & Integrations

Two lists, kept apart on purpose: what is **installed** and what is **planned**. A dependency
named here without a version is not an invitation to assume it exists — check `package.json`.

## 1. Installed

### Runtime and build

- `typescript` 5.6 — strict compiler; `npm run lint` is `tsc --noEmit`.
- `vite` 5.4 — dev server and production bundle into `dist/`.
- `vitest` 2.1 — unit tests (`npm run test`).
- No runtime dependencies. The browser bundle is plain TypeScript + CSS.
- Node.js + npm; `npx wrangler` is available for the alternative deploy path.

### Hosting, deployment, tooling

- **Cloudflare Pages** — project `sircollins-pwa`, custom domain
  `sircollins.coreconcept1.net`.
- `tools/deploy.py` — stdlib-only Pages deployer (primary path).
- `tools/blake3.py` — pure-Python BLAKE3, required for Pages asset keys.
- `git` — conventional commits.
- Python 3.13 standard library (`urllib`, `sqlite3`, `struct`) — no pip packages.
- Shell: standard POSIX (`bash`).
- Fonts: Google Fonts CDN (`Inter`, `JetBrains Mono`), allowed by the CSP; `Google Sans` is used
  only if the visitor already has it.

### Browser platform

- Service Worker + Cache API, OPFS, `localStorage`, Canvas 2D, `backdrop-filter`, CSS
  `clip-path`, `prefers-reduced-motion`, `prefers-contrast`.

## 2. Planned (not installed — do not import yet)

- `sql.js` / `sqlite-wasm` + `sqlite-vec` — SQLite in the browser and vector search.
- `opfs-tools` — OPFS helpers; the current adapter uses the raw API.
- `cbor` / a CBOR-LD encoder — internal machine-to-machine representation.
- `motion.dev` — preferred spring-physics library **if** CSS transitions stop being enough.
  Today all motion is CSS cubic-beziers; no animation runtime is shipped.
- `lucide` — SVG icon set, if the inline icon needs grow.
- Rive CLI — optional, for authored vector motion.
- Paystack / Flutterwave adapters and the Cloudflare Worker that routes them.

## 3. Environment Constraints

- No ImageMagick, Pillow, `cwebp` or `oxipng` in this environment. Image dimensions and
  composition are inspected with the browser's Canvas API; do not assume a CLI converter exists.
- Cloudflare zone settings are shared with other subdomains (`brimenergy`, `pioneer`, `reality`,
  `prime`). Never change zone-wide cache, TLS or email settings to fix one host; use a scoped
  Rule instead.
- Deployment-specific `*.sircollins-pwa.pages.dev` hostnames may fail TLS from this network;
  verify through the custom domain.

## 4. AI Agent Specific Tools

- `web_search`: verify current tech trends or API docs.
- `file_read/write`: modify project files directly.
- `code_execution`: run builds, tests and deployment checks locally.
