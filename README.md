# Sir Collins Portal

Sovereign Digital Twin of **Sir Collins Chris** — an offline-first, machine-readable PWA.

Target domain: `sircollins.concept1.net` · Cloudflare Pages project: `sircollins-pwa`

## Governance documents

Read these before changing anything:

| File | Contents |
| --- | --- |
| `CONTEXT.md` | Mission, architectural pillars, acceptance criteria, contact channels |
| `SKILLS.md` | Agent competency matrix and communication protocol |
| `TOOLS.md` | Approved libraries and integrations |
| `WORKFLOWS.md` | SOPs: feature, review, deploy, content, "Build Again" |

## Current state

Version `0.0.1` — core shell only. Implemented:

- Strict TypeScript + Vite build (no framework, no runtime dependencies).
- **Liquid Glass** base styles: aurora field, single-layer `backdrop-filter`, spring
  cubic-beziers, `prefers-reduced-motion` and `prefers-contrast` branches.
- **Sovereign storage adapter** (`src/lib/storage.ts`): OPFS → localStorage → in-memory,
  probed at runtime, never throws. The header badge appears only when the engine is not OPFS.
- **JSON-LD** (`src/lib/schema.ts`): Person, WebSite and Blog graphs generated from one
  source, injected at boot. This is the same builder the CBOR-LD path will consume.
- **Service worker** (`public/sw.js`): network-first navigation with offline shell fallback,
  stale-while-revalidate for same-origin assets.
- **Tests** (`tests/`): storage fallback chain, corrupt-payload recovery, JSON-LD shape.

Not yet built: the Private AI Agent interaction layer, `sqlite-vec` semantic search,
CBOR-LD encoding, the payment adapter, and real (non-draft) teaser content.

## Commands

```sh
npm install      # install
npm run dev      # dev server on http://localhost:5173
npm run lint     # tsc --noEmit (strict, zero errors tolerated)
npm run test     # vitest
npm run build    # typecheck + production bundle into dist/
npm run deploy   # build, then wrangler pages deploy dist --project-name=sircollins-pwa
```

## Deployment

`npm run deploy` requires `CLOUDFLARE_API_TOKEN` in the environment:

```sh
export CLOUDFLARE_API_TOKEN=...   # never commit this, never paste it in chat
npm run deploy
```

Deviation from `WORKFLOWS.md` Workflow C: the artifact directory is `dist/`, not
`src/frontend/`, because Vite emits there. Everything else in that workflow applies.

## Conventions

- No `any`. No non-null assertions in place of real checks — narrow with `query<T>()` helpers.
- All storage access goes through `createSovereignStore()`; never touch `localStorage` or
  OPFS directly in UI code.
- Semantic data is defined once in `src/lib/schema.ts` and projected to JSON-LD; CBOR-LD must
  reuse it rather than duplicate the shape.
- Every surface gets exactly one `backdrop-filter`. Nested blurs are the usual cause of
  jank on mid-range phones.
- Bump `CACHE_VERSION` in `public/sw.js` on any shell change.

## Security note

A Cloudflare API token was shared in plain text during setup. It was **not** written into
the repository, and `.gitignore` blocks `.env`, `.dev.vars` and `.cloudflare-token`. Rotate
that token before deploying.
