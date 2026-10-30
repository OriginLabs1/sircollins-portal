# Sir Collins Portal

Sovereign Digital Twin of **Sir Collins Chris** — an offline-first, machine-readable PWA.

Target domain: `sircollins.coreconcept1.net` · Cloudflare Pages project: `sircollins-pwa`

## Governance documents

Read these before changing anything:

| File | Contents |
| --- | --- |
| `CONTEXT.md` | Mission, architectural pillars, acceptance criteria, contact channels |
| `SKILLS.md` | Agent competency matrix and communication protocol |
| `TOOLS.md` | Approved libraries and integrations |
| `WORKFLOWS.md` | SOPs: feature, review, deploy, content, "Build Again" |

## Current state

Version `0.0.1` — the living portal. Implemented:

- Strict TypeScript + Vite build (no framework, no runtime dependencies).
- **Emblem-led hero** (`public/brand/logo.png`) above the verbatim hero copy; the portrait was
  removed by instruction.
- **Liquid Glass** base styles: aurora field, single-layer `backdrop-filter`, spring
  cubic-beziers, `prefers-reduced-motion` and `prefers-contrast` branches.
- **Unique Skills** and **Creative Expressions**: ten capability tiles plus links to the
  creative work; `Person.knowsAbout` is derived from the same titles.
- **Unique Concepts**: Ceremoni, Royal Discipleship and Super Birthdays, with the reality hint.
- **From the Stage**: the TEDx Jalingo slide (`public/media/tedx-jalingo.jpg`) framed with its
  quote, attribution and context, linked to the full-size file; the image is cached by the
  service worker.
- **Inspirations & Reflections** (`src/data/entries.json`): five verbatim entries, each with
  Love, Acknowledge, Share, “Acknowledged by” and a qualitative rarity symbol (hover/focus
  for the breakdown).
- **Acknowledgment** (`src/lib/portal.ts`): five roles, local-first state, carrier links
  (`#ack=…`) that can be imported on another device, and a responder form (name, X, Facebook,
  why/where you share).
- **Token/Giving Mode** with the exact openness statement, plus a share dialog with
  client-side QR codes for public destinations.
- **Sovereign storage adapter** (`src/lib/storage.ts`): OPFS → localStorage → in-memory,
  probed at runtime, never throws.
- **JSON-LD** (`src/lib/schema.ts`): Person, WebSite and CollectionPage (Quotation/Question)
  generated from one source, injected at boot.
- **Service worker** (`public/sw.js`): network-first navigation with offline shell fallback,
  stale-while-revalidate for same-origin assets.
- **Tests** (`tests/`): storage fallback chain, corrupt-payload recovery, JSON-LD shape,
  carrier round-trips, role weights, rarity tiers.

Not yet built: the Private AI Agent interaction layer, `sqlite-vec` semantic search,
CBOR-LD encoding, the payment adapter, and globally aggregated acknowledgments (which need a
server-side store).

## Commands

```sh
npm install      # install
npm run dev      # dev server on http://localhost:5173
npm run lint     # tsc --noEmit (strict, zero errors tolerated)
npm run test     # vitest
npm run build    # typecheck + production bundle into dist/
npm run deploy:api  # build, then deploy dist/ with tools/deploy.py (primary)
npm run deploy   # build, then wrangler pages deploy dist --project-name=sircollins-pwa
```

## Deployment

`npm run deploy` requires `CLOUDFLARE_API_TOKEN` in the environment:

```sh
export CLOUDFLARE_API_TOKEN=...   # never commit this, never paste it in chat
npm run deploy
```

Deviation from `WORKFLOWS.md` Workflow C: none in substance. The artifact directory is
`dist/`, which is what Vite emits; both deploy paths use it.

### Deploy without Wrangler (Python, stdlib only)

Wrangler is only a client for the Pages REST API. `tools/deploy.py` calls the same
endpoint directly — `POST /accounts/{account_id}/pages/projects/{project}/deployments`
with a `multipart/form-data` body: a `manifest` field mapping each path to its asset
hash, plus `_headers` / `_redirects` as config parts (Pages consumes those and never
serves them). No npm, no pip, no network access beyond the API itself.

Asset identity is the subtle part. Pages does not key files by SHA-256; Wrangler uses
`blake3(base64(contents) + extension)[0:32]`, so a SHA-256 manifest produces a
deployment that returns **500 at every path**. `tools/blake3.py` implements BLAKE3 in
pure Python for this reason, and `tools/deploy.py` uses it for both the manifest and
the `/pages/assets/*` upload keys.

```sh
python3 tools/deploy.py --dry-run              # manifest only, no network calls
python3 tools/deploy.py                        # production deploy of dist/
python3 tools/deploy.py --preview              # preview deployment
python3 tools/deploy.py --account <id>         # override the account id
```

It reads the token from the first of these that exists:

| Order | Location | Scope | Use when |
|---|---|---|---|
| 1 | `CLOUDFLARE_API_TOKEN` env var | that shell | CI, or a one-off `export` |
| 2 | `CLOUDFLARE_API_TOKEN=...` in `.env` | this checkout | project-scoped token; gitignored |
| 3 | token alone in `~/.cloudflare-token` | every directory | simplest, works from anywhere |

It never prints the token and never takes it as a command-line argument, so it
stays out of shell history. Mode-checked: it warns if the file is group/world
readable.

```sh
python3 tools/deploy.py --verify     # token identity, account, Pages + zone access
```

What this does **not** avoid: authentication. The endpoint requires a token holding
*Account · Cloudflare Pages · Edit*, exactly as Wrangler does. Wrangler's OAuth login is
the only path that needs no token at all — it needs one browser click instead.

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

A Cloudflare API token was shared in plain text during setup. It was **not** written into the
repository, and `.gitignore` blocks `.env`, `.dev.vars` and `.cloudflare-token`. Rotation is
recommended; after rotating, run `python3 tools/deploy.py --verify` before the next deploy.
