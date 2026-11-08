# SPECS — Sir Collins Portal `v0.0.2` (ALP)

**Status:** proposed, awaiting approval. Implements [`CONTEXT.md`](CONTEXT.md).
**Scope:** the Average Lovable Product — the smallest release a real person would keep,
recommend, and return to. No speculative modules.

Requirement IDs are stable. A requirement is done only when its acceptance check passes on a
real device or in an automated test.

---

## 1. Scope

### 1.1 In scope

| Area | Included in `v0.0.2` |
| --- | --- |
| Copy | The exact batch in `docs/COPY-DECISIONS.md` |
| The Voice | Stage section re-framed, provenance retained |
| Giving | Token/Giving Mode + hint + Telegram handshake + QR |
| QR | On-device generation for public destinations and the handshake |
| Acknowledgment | Five roles with exact labels/wordings; carrier links unchanged |
| Rarity | Worth + witness; corrected public explanation |
| Portability | Full state export/import as one JSON file |
| PWA | Install, offline, update prompt, share target |
| Android | TWA shell definition, asset links, signing plan |
| Research | Local, opt-in signals with export; no SDK |
| Docs | CONTEXT, SPECS, ALP, copy register, ADR log |

### 1.2 Out of scope (explicit)

Accounts, server-side profiles, aggregated public counts, payments, AI agent, semantic search,
CBOR-LD, forum/community software, push notifications (unless gate G4 passes), iOS native
shell, localisation beyond English.

## 2. Users and jobs

| Persona | Job to be done | Success signal |
| --- | --- | --- |
| First-time visitor | Understand who Sir Collins is and what he stands for in under 60 s | Reaches The Voice or Inspirations; no confusion about “giving” |
| Reader | Read and keep the words offline | Installs or bookmarks; entries available with no network |
| Witness | Acknowledge at the right depth and carry that acknowledgment | Seals a response; link opens correctly on another device |
| Giver | Express intent without a checkout | Toggles the mode; scans the QR; Telegram opens with “Hi from Giver” |
| Community member | Belong without an account | Selects Membership Aspirant or Active Member; state persists |
| Maintainer | Change copy or content without touching architecture | One data file or one copy register entry; tests stay green |

## 3. Information architecture

```
/                         Home (hero → skills → expressions → concepts → voice → giving →
                          inspirations → reflections → respond → contact)
/#skills                  Unique Skills
/#expressions             Creative Expressions
/#concepts                Unique Concepts
/#stage                   The Voice (TEDx Jalingo)
/#receptive               Token/Giving Mode
/#inspirations            Inspirations
/#reflections             Reflections
/#respond                 Respond
/#entry-<id>              One entry (JSON-LD anchor)
/#ack=<payload>           Carrier link (imports one acknowledgment)
```

Navigation exposes Skills, Inspirations, Reflections, Respond. The Voice and Giving remain in
the reading flow, not the top nav.

## 4. Functional requirements

### FR-01 — Content integrity

- Load entries from `src/data/entries.json`; validate `id`, `kind`, `theme`, `text`, `weight`.
- Reject invalid items without breaking the page; log a single warning in development only.
- Render inspirations and reflections in the declared order.
- **Accept:** all five entries render; a malformed item is skipped; `npm run test` passes.

### FR-02 — The Voice (stage section)

- Section title is exactly **The Voice**.
- The eyebrow “On stage” is removed.
- The stage note is replaced by the four-line credit in `docs/COPY-DECISIONS.md` C-01.
- The provenance sentence (“Delivered on the TEDx Jalingo stage, from the talk *A New Wave*”)
  is retained as a secondary line or metadata, never deleted.
- The slide image keeps real dimensions, lazy loading, and alt text carrying the quote.
- The mat links to the full-size image with `rel="noopener"`.
- **Accept:** no “From the Stage” or “On stage” string remains in `index.html`; provenance is
  still present in the DOM; the image opens full size.

### FR-03 — Token/Giving Mode

- The toggle persists the `receptive` flag through the storage adapter.
- Active state is visible in the panel, the header badge, and `aria-pressed`.
- The exact openness copy is rendered verbatim.
- The hint is rendered verbatim as its own paragraph:
  > HINT: Toggling the Giving/Token Mode or turning it on also means choosing to give or
  > choosing to request for a 'Giving Plan' by saying 'Hi from Giver' to Sir Collins Telegram inbox.
- The hint uses the canonical term **Token/Giving Mode** in UI chrome; the verbatim hint is
  preserved as supplied.
- **Accept:** toggle → reload → still active; hint text matches exactly; no payment UI exists.

### FR-04 — Giving Plan handshake and QR

- Canonical handshake: `https://t.me/CollinsRoyalMedium?text=Hi%20from%20Giver`.
- The Giving panel renders a QR for the handshake when the mode is active.
- A visible “Open Telegram” link and the literal URL accompany the QR.
- The QR is generated on-device; no network request is made to render it.
- A “Save QR” action downloads a PNG at ≥ 640 px.
- **Accept:** scanning with a phone opens the chat with “Hi from Giver” prefilled; disabling
  the mode hides the QR; the download is a valid PNG.

### FR-05 — Acknowledgment roles

- Labels and descriptions are exactly those in CONTEXT §9.1.
- `ACK_ROLES`, `ACK_ROLE_LABEL`, `ACK_ROLE_DESCRIPTION`, `ACK_ROLE_ICON`, `ACK_WEIGHT`, and
  both role fieldsets stay in sync.
- **Accept:** a snapshot test asserts the five label/description pairs; changing one without
  the others fails the build.

### FR-06 — Rarity

- `score = intrinsic worth (0–5) + weighted witness`.
- Weights: Observer 1, Aspirant 1, Communicator 2, Active Member 2, Responder 3.
- Tiers: Very Common ≥ 0, Common ≥ 3, Uncommon ≥ 6, Rare ≥ 10, Unique ≥ 15.
- The public note reads: *“Rarity measures both depth of witness and worth, not popularity or
  money.”*
- The legend lists all five weights explicitly; no role is omitted.
- Raw counts never appear on the card surface.
- **Accept:** unit tests cover tier boundaries, weights, and the note string; the legend
  contains all five roles.

### FR-07 — Love and acknowledgment

- Love is local, toggles, and never changes rarity.
- Acknowledgment validates name (1–80), role, optional note (≤ 280), optional X/Facebook URLs.
- State is deduplicated by `entry + lower(name) + at`.
- **Accept:** existing tests plus a new test that love does not change `score`.

### FR-08 — Carrier links

- `#ack=` payloads validate against current entry ids and fail closed.
- Importing a link adds one acknowledgment with `source: 'link'`.
- Import is idempotent.
- **Accept:** round-trip test on another profile; a tampered payload is rejected.

### FR-09 — Share

- Share dialog offers copy, native share (when available), and QR for public URLs.
- QR is hidden for carrier links.
- **Accept:** native share falls back to copy; no private payload is rendered as a QR.

### FR-10 — Portability

- Export produces one JSON file: `{ version, exportedAt, state }`.
- Import validates version and shape, merges without duplicating, and reports counts.
- Export never includes secrets or device identifiers.
- **Accept:** export → clear → import restores loved, acknowledgments, receptive flag.

### FR-11 — PWA

- Manifest: name, short name, icons (any + maskable), start URL, scope, standalone,
  theme/background, shortcuts.
- Service worker: network-first navigation with offline shell; stale-while-revalidate for
  same-origin assets; `CACHE_VERSION` bumped on shell change.
- Update prompt: when a new worker is waiting, show a quiet “Update available” action.
- Install prompt: one restrained, dismissible invitation; never blocks reading.
- **Accept:** installable on Android Chrome; offline reload works; update prompt appears after
  a version bump.

### FR-12 — Android shell

- TWA via Bubblewrap (or equivalent) pointing at the canonical origin.
- Digital Asset Links published at `/.well-known/assetlinks.json`.
- Package id, signing key, and versionCode documented in the repo.
- No WebView bundle, no duplicated content, no separate domain.
- **Accept:** APK/AAB installs, opens without a URL bar, passes Play pre-launch checks, and
  reflects a web deploy without an app update.

### FR-13 — Research signals (local, opt-in)

- Event shape: `{ name, at, entry?, role?, surface? }`; no free text, no identifiers.
- Stored locally; exportable with state; disabled until the user opts in.
- No network transmission in `v0.0.x`.
- **Accept:** with opt-in off, zero signals are written; with it on, the export contains only
  the allowed fields.

### FR-14 — Contact

- Both email addresses remain literal in the HTML.
- Telegram link and handshake are present and correct.
- **Accept:** `curl` of the home page contains both addresses; `mailto:` works without JS.

### FR-15 — Copy contract

- No “Featured”, “Aphorisms to live by”, “On stage”, or “From the Stage” in shipped copy.
- Meta description and manifest description say “inspirations”, not “featured inspirations”.
- Canonical term is “Token/Giving Mode” in chrome.
- **Accept:** a grep-based test fails on retired strings.

## 5. Content contract (`src/data/entries.json`)

```jsonc
{
  "$comment": "Verbatim material. Do not edit without instruction.",
  "items": [
    {
      "id": "kebab-case-2-80",
      "kind": "inspiration" | "reflection",
      "theme": "short label",
      "text": "verbatim, newlines preserved",
      "attribution": "optional",
      "weight": 0
    }
  ]
}
```

Rules: `id` matches `^[a-z0-9-]{2,80}$`; `weight` is an integer 0–5; order is editorial;
JSON-LD derives from this file only.

## 6. State contract (`portal-state`)

```ts
interface PortalState {
  version: 1;
  loved: string[];
  acknowledgments: Acknowledgment[];
  receptive: boolean;
  // v0.0.2 additions, optional on read:
  researchOptIn?: boolean;
  signals?: Signal[];
  lastEntry?: string;
}
```

Migration: unknown fields are preserved on read where safe; `version` gates future migrations.
Corrupt payload → `emptyState()`, never a crash.

## 7. Acknowledgment contract

```ts
interface AckPayload {
  v: 1;
  entry: string;          // entry id or "general"
  name: string;           // 1–80, trimmed
  role: 'observer' | 'aspirant' | 'communicator' | 'active-member' | 'responder';
  at: string;             // ISO 8601
  x?: string;             // https, x.com/twitter.com profile
  facebook?: string;      // https, facebook.com profile
  note?: string;          // ≤ 280
}
```

Encoded as base64url JSON in the URL fragment. Max payload 4096 characters. Unknown entries,
roles, or dates fail closed; unusable social links are dropped.

## 8. QR contract

| Intent | Payload | Surface | Notes |
| --- | --- | --- | --- |
| Giving handshake | `https://t.me/CollinsRoyalMedium?text=Hi%20from%20Giver` | Giving panel | Only when mode is active |
| Carry the portal | `${origin}/` | Footer, share dialog | Existing behaviour |
| The Voice | `${origin}/#stage` | Share dialog | For slides and print |
| Contact card | `https://t.me/CollinsRoyalMedium` | Contact panel | No prefilled text |
| Acknowledgment | — | **Never** | Contains personal data |

Implementation: `paintQr(canvas, text, { pixels: 640 })`; quiet zone ≥ 4; dark `#0a1020` on
light `#f7f9ff`; `aria-label` names the destination; human-readable URL adjacent.

## 9. Adapter interfaces

```ts
// Storage — matches src/lib/storage.ts
interface SovereignStore {
  readonly engine: 'opfs' | 'localstorage' | 'memory';
  readonly volatile: boolean;
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
  keys(): Promise<string[]>;
  clear(): Promise<void>;
}

// Content
interface ContentSource {
  readonly id: 'bundled' | 'cache' | 'remote';
  load(): Promise<readonly Entry[]>;
}

// Giving
interface GivingTransport {
  readonly id: 'telegram' | 'clipboard';
  handshake(intent: 'give' | 'plan'): { url: string; text: string };
}

// Notifications
interface NotificationAdapter {
  readonly id: 'in-app' | 'web-push' | 'none';
  notify(event: { title: string; body: string; url?: string }): Promise<boolean>;
}

// Research
interface ResearchAdapter {
  readonly id: 'local' | 'none';
  enabled(): boolean;
  record(signal: { name: string; at: string; entry?: string; role?: string; surface?: string }): Promise<void>;
}
```

Selection rules: prefer the richest available adapter; fall back in the order documented in
CONTEXT §7; log the chosen engine; never throw.

## 10. Platform specifications

### 10.1 PWA

- `display: standalone`, `display_override: [window-controls-overlay, standalone]`.
- Icons: SVG `any` + `maskable`; 192/512 PNG generated before Play submission.
- `start_url: /`, `scope: /`, `id: /`.
- Shortcuts: Skills, Inspirations & Reflections, Respond, Contact.
- Offline shell includes `/`, `/index.html`, manifest, icons, emblem, stage image.
- Cache version is part of the release checklist.

### 10.2 Android (TWA)

- Tool: Bubblewrap (or Android Studio TWA template).
- Origin: `https://sircollins.coreconcept1.net`.
- Asset links: `public/.well-known/assetlinks.json` with the release cert SHA-256.
- Package: `net.coreconcept1.sircollins` (confirm before first upload).
- Signing: upload key held by Sir Collins Tech-Agency; documented, backed up, never committed.
- Minimum SDK: whatever Bubblewrap emits; target the current Play requirement.
- No custom WebView, no JS bridge in `v0.1`.
- **Upgrade path:** if a measured need appears, add a Compose Multiplatform shell that reuses
  the same JSON contracts and a shared Kotlin domain module. Do not fork the copy.

### 10.3 Notifications

- `v0.0.2`: in-app “what's new” from a static `releases.json`; no permission prompt.
- `v0.1+`: Web Push via a Cloudflare Worker with VAPID, opt-in, one topic.
- `v0.2+`: FCM only if the native shell exists and the need is proven.
- Quiet hours and frequency cap are part of any push spec.

### 10.4 Research

- Local only; opt-in; exportable.
- Aggregation, if ever added, is a separate ADR with a written privacy note.
- No cookies, no fingerprinting, no third-party script.

## 11. Non-functional requirements

### 11.1 Performance budgets

| Metric | Budget |
| --- | --- |
| LCP (mid-range 4G) | < 2.0 s |
| INP | < 200 ms |
| CLS | < 0.1 |
| Shell JS + CSS (gzip) | ≤ 150 KB |
| Fonts | ≤ 2 families, `display=swap`, preconnect |
| Images | real dimensions, lazy below fold, ≤ 250 KB each |
| Backdrop filters | exactly one per surface |

### 11.2 Accessibility

- WCAG 2.2 AA; visible focus; 44×44 px targets; labels on every control.
- Dialog focus trap and restore; `aria-live` for results and toasts.
- `prefers-reduced-motion` removes reveal/spring motion; `prefers-contrast` strengthens borders.
- Colour is never the only carrier of meaning (rarity uses symbol + label).

### 11.3 Security

- CSP `default-src 'self'`; `frame-ancestors 'none'`; `base-uri 'self'`.
- No inline event handlers; no `eval`; no third-party script.
- External links: `rel="noopener noreferrer"`.
- Secrets only in environment or mode-600 `.env`; rotate anything shared in plain text.
- QR generation is local; no URL is sent to a QR service.

### 11.4 Privacy

- No analytics SDK, no cookies, no fingerprinting.
- Personal state never leaves the device unless the user sends a carrier link or a Telegram
  draft.
- Export is explicit and user-initiated.

### 11.5 SEO and semantics

- JSON-LD: Person, WebSite, CollectionPage (Quotation/Question).
- `Person.image` intentionally absent; emblem via Open Graph and manifest.
- Canonical and OG URLs point to the custom domain.
- `knowsAbout` derives from the rendered skill titles.

### 11.6 Resilience matrix

| Failure | Behaviour |
| --- | --- |
| OPFS unavailable | localStorage; badge shows “Storage: on this device” |
| localStorage blocked | memory; badge shows volatile warning |
| Corrupt state | `emptyState()`; no crash; user can re-import |
| QR encoder throws | hide QR, keep copy/share actions |
| Share API absent | copy link, toast confirmation |
| Offline first visit | readable fallback block + message |
| Fonts blocked | system font stack; no layout break |
| Image missing | alt text and caption remain |

### 11.7 Language

English only in `v0.0.2`. Copy is stored in one place per surface to allow future extraction;
no hard-coded strings inside render functions beyond labels already in `schema.ts`.

## 12. Test plan

| Layer | Tests |
| --- | --- |
| Unit | storage fallback, corrupt recovery, payload round-trip, role weights, tier boundaries, note strings, love isolation, export/import |
| Contract | snapshot of role labels/descriptions; grep for retired copy strings |
| DOM | role fieldsets generated from one source; giving hint verbatim; QR hidden for carrier links |
| Journey | first visit → voice → giving → scan → Telegram draft; acknowledge → copy link → import on second profile |
| Platform | offline reload; install; TWA launch; asset links |
| Manual | keyboard-only pass; 200% zoom; reduced motion; high contrast; 320 px width |

Commands: `npm run lint`, `npm run test`, `npm run build`, `python3 tools/deploy.py --dry-run`.

## 13. Release management

- **Versioning:** semver. `v0.0.2` = copy batch + giving QR + portability + TWA definition.
- **Changelog:** `CHANGELOG.md` (new) with Added / Changed / Fixed / Removed.
- **Gates:** lint → test → build → dry-run → deploy → post-deploy curl checks.
- **Rollback:** previous Cloudflare deployment id; `CACHE_VERSION` bump on every shell change.
- **Content releases** do not require an app release; **shell releases** do.
- **Build Again** triggers: any N1–N12 failure in production, data loss, or a privacy breach.

## 14. Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Copy drift between docs and UI | High | Medium | Copy register + grep test |
| TWA asset-link mismatch | Medium | High | Verify with Google’s statement list tool before release |
| QR unreadable in print | Low | Medium | 640 px PNG, quiet zone, contrast check |
| Telegram deep link ignored on desktop | Medium | Low | Always show the literal URL |
| Feature creep into payments/AI | Medium | High | Out-of-scope list; ADR gate |
| Over-blurring on mid-range phones | Medium | Medium | One blur layer; measure on device |

## 15. Traceability

| Context clause | Requirements |
| --- | --- |
| §5 N1–N12 | FR-01…FR-15, §11 |
| §6 surfaces | FR-11, FR-12, §10 |
| §7 adapters | §9, FR-10, FR-13 |
| §8 data posture | FR-10, FR-13, §11.4 |
| §9.1 roles | FR-05 |
| §9.2 rarity | FR-06 |
| §9.4 QR law | FR-04, FR-09, §8 |
| §10 copy law | FR-02, FR-03, FR-15 |
| §11 giving | FR-03, FR-04 |
