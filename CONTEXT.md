# CONTEXT — Sir Collins Portal

**Document status:** target state for `v0.0.2` (the ALP). The deployed `v0.0.1` still carries the
previous copy until the approved copy batch lands. The exact before/after text lives in
[`docs/COPY-DECISIONS.md`](docs/COPY-DECISIONS.md).

**Read with:** [`SPECS.md`](SPECS.md) (requirements) · [`ALP.md`](ALP.md) (plan) ·
[`WORKFLOWS.md`](WORKFLOWS.md) (SOPs) · [`SKILLS.md`](SKILLS.md) · [`TOOLS.md`](TOOLS.md).

---

## 1. Mission

Build and maintain the **Sovereign Digital Twin** of Sir Collins Chris: a self-sufficient,
offline-first, machine-readable portal that serves as a living record of leadership, ICT
strategy, and creative work. We do not display information. We keep a record that survives the
device, the network, and the platform.

## 2. Product thesis

The portal is not a portfolio, a feed, or a scoreboard. It is a **record of a life's work and
the witness it gathers**.

1. **The words are the product.** Copy is authored, verbatim, and stable. Chrome exists to
   carry it, never to compete with it.
2. **Witness is the only metric.** Depth of attention, not popularity. No likes race, no
   leaderboard, no raw counts on the surface.
3. **The device is the vault.** Personal state stays on the device that created it until its
   owner chooses to carry it somewhere else.
4. **The edge is the delivery van.** Public content is cached and served fast; it is never
   the owner of anything private.

**Explicitly not:** advertising, tracking SDKs, engagement loops, paywalls, accounts,
server-side profiles, or ranking by money.

## 3. Identity

- **Principal:** Sir Collins Chris
- **Roles:** Unique Pioneer · Leadership Consultant · Royal Tutor · ICT Strategist · Creative Genius
- **Domain:** `sircollins.coreconcept1.net` (canonical entry point)
- **Repository:** `~/projects/sircollins-portal`
- **Emblem:** `public/brand/logo.png` (transparent PNG, 696×587). It is the hero mark, brand
  badge, Open Graph/Twitter image and shell asset. It is **not** `Person.image`; an emblem is
  not a depiction of the person.
- **Hero copy:** “Life, reality, integrity, and unique impact —” /
  “The living portal of the Life and unique realities of Sir Collins.”
- **Provenance line:** *Made with love from OneOrigin.* Powered by Sir Collins Tech-Agency.

## 4. North star, translated into engineering

| North-star word | Engineering meaning | Proof |
| --- | --- | --- |
| Super | Exceeds platform baselines: installable, offline, instant, accessible | Lighthouse PWA + a11y gates |
| Uniqueness | One visual identity, not a template | Design tokens reviewed per release |
| Coherent | One design system, one copy voice | Copy contract + token audit |
| Royal concepts | Dignity through restraint; no gaudy effects | Single blur layer; motion budget |
| Replaceable implementations | Every major seam has an interface and a fallback | Adapter table (§7) |
| User research | Local, consent-based signals only | Research adapter, no SDK |
| Release management | Semver, changelog, rollback, “Build Again” | `WORKFLOWS.md` C/F |
| UI/UX and usability | Tested with real flows, not assertions | Journey tests (§13 SPECS) |
| Community management | Optional; Telegram is the transport, the portal is the record | No forum build |
| Documentation | Docs are code; drift is a defect | This file + SPECS + ADR log |
| Web design | Content-first, no layout shift, no dependency tax | Perf budgets (§11 SPECS) |
| Governance | Decisions recorded, not remembered | ADR log (§16) |
| E-Notification | Opt-in, adapter-based, quiet by default | Notification adapter (§7) |

## 5. Non-negotiables (acceptance criteria)

Every line of code, design decision, and feature must pass these. A failure is a release
blocker, not a backlog item.

| # | Criterion | Acceptance test |
| --- | --- | --- |
| N1 | Correctness | `npm run lint` and `npm run test` pass; zero console errors on phone, tablet, desktop |
| N2 | Offline | After one visit, the shell and all five entries load with the network disabled |
| N3 | Privacy | No request carries personal state; verified in DevTools network log |
| N4 | Portability | Export → wipe → import round-trips every personal field |
| N5 | Accessibility | WCAG 2.2 AA: keyboard-only, 200% zoom, reduced motion, contrast |
| N6 | Performance | LCP < 2.0 s on mid-range 4G; INP < 200 ms; CLS < 0.1; shell ≤ 150 KB gzip (JS+CSS) |
| N7 | Security | CSP `default-src 'self'`; no secrets in the bundle; no `eval`; no remote QR service |
| N8 | Semantics | JSON-LD validates; contact addresses stay literal in the HTML |
| N9 | Content | Verbatim rule holds; copy contract (SPECS §5) is enforced |
| N10 | Replaceability | Every seam in §7 has a contract, a shipped implementation, and a fallback |
| N11 | Reproducibility | Clean clone → install → build → `deploy --dry-run` succeeds without local state |
| N12 | Restraint | “Build the best, or build again — only when justifiably vital.” No speculative modules. |

## 6. Surfaces and platforms

One core, three shells. The web core is canonical; every other surface is a client of the same
contracts.

| Surface | Role | Status |
| --- | --- | --- |
| **Web PWA** | Canonical implementation and reference behaviour | Production (`v0.0.1`) |
| **Android app (bundled WebView)** | Installable app on Android, same web core, no fork, works offline | Shipped `v0.0.3` |
| **Native surfaces (KMP/Compose)** | Optional offline reading, giving plan, notifications — only on evidence | Decision gate, not committed |
| **Carrier links** (`#ack=…`) | Device-to-device transport of one acknowledgment | Production |
| **Telegram** | Community and Giving Plan transport; not a data store | Production (link) |
| **Notifications** | In-app “what's new” now; Web Push later; FCM only if a native shell earns it | Adapter |

**Why a bundled WebView before Kotlin/Compose:** the ALP is already a complete web product.
Packaging `dist/` inside a thin WebView shell gives a real, installable Android app with one
codebase and no duplicated domain logic — and, unlike a Trusted Web Activity, it works offline
on first launch with no browser installed and no network permission. The same web core still
serves the website. A KMP/Compose rewrite is justified only by measured needs the web shell
cannot meet — for example, background notifications, native share targets, or offline search
over a large corpus. C/C++ enters only for a measured compute bottleneck (content hashing,
vector search), never for architecture theatre.

## 7. Architecture: adapter seams

Domain rules stay pure (`src/lib/portal.ts`, `src/lib/schema.ts`). Platform access sits behind
seams. Each seam is selected at boot, fails closed, and never throws into the UI.

| Seam | Contract | Shipped (web) | Fallback | Future |
| --- | --- | --- | --- | --- |
| `StorageAdapter` | `SovereignStore` | OPFS | localStorage → memory | SQLite WASM + OPFS |
| `ContentSource` | `Entry[]` loader | Bundled `entries.json` | Service-worker cache | Signed remote JSON |
| `ShareTransport` | `share(url, text)` | Web Share API | Clipboard → visible URL | Native share sheet |
| `GivingTransport` | `handshake(intent)` | Telegram deep link | Copyable URL | Payment adapter (Worker) |
| `NotificationAdapter` | `notify(event)` | In-app banner | Footer note | Web Push → FCM |
| `ResearchAdapter` | `record(signal)` | Local counters | No-op | Opt-in aggregate export |
| `IdentityAdapter` | `who()` | None (anonymous) | — | Passkeys (WebAuthn) |
| `SearchAdapter` | `query(text)` | Title/theme filter | — | `sqlite-vec` semantic search |

Rules:

- A seam change must not change a call site. That is the test of the seam.
- Adapters are additive. Removing one degrades a feature; it never breaks the page.
- No adapter may silently upload. Any network write is an explicit, named decision in an ADR.

## 8. Data posture: remote-first, portable, selectively local

**Remote-first** means content and shell updates are authored centrally and delivered from the
edge, so a website copy change never requires a rebuild. The Android app bundles a snapshot of
that build, so reaching installed apps does require a release; Obtainium makes that quiet.

**Portable** means no lock-in: every personal field can leave as one JSON file or one carrier
link, and the same payload works on any device.

**Selectively local** means only private state is stored locally. Public content is cached, not
owned. Nothing private is synced by default.

| Data class | Examples | Lives | Leaves the device? | Export |
| --- | --- | --- | --- | --- |
| Public content | entries, stage image, skills | Repo → edge → SW cache | n/a (public) | repo |
| Personal state | loved, acknowledgments, receptive flag, reading position | Device: OPFS → localStorage → memory | **No** | JSON file |
| Carrier payload | one acknowledgment | URL fragment `#ack=` | Only when the user sends it | the link |
| Giving intent | “Hi from Giver” draft | Telegram composer | Only when the user sends it | n/a |
| Research signal | local feature counters | Device | **No** (opt-in aggregate later) | JSON |
| Secrets | API tokens | Environment / `.env` only | Never | n/a |

## 9. Interaction model

**Reading order:** Unique Skills → Creative Expressions → Unique Concepts → **The Voice** →
Token/Giving Mode → Inspirations → Reflections → Respond. Capability and verifiable origins lead;
giving is never the first thing under “Enter the portal”.

### 9.1 Roles — exact labels and wordings

Lightest claim to deepest. Labels and descriptions are a copy contract; do not paraphrase.

| Role id | Label | Description (verbatim) | Weight |
| --- | --- | --- | --- |
| `observer` | Observer | I read and observed. | 1 |
| `aspirant` | Membership Aspirant | A potential member willing to be a recognized member of Sir Collins Community. | 1 |
| `communicator` | Communicator | I spoke or reshared this. | 2 |
| `active-member` | Active Member | A honorable member active within Sir Collins Community. | 2 |
| `responder` | Responder | I acted on this or created from it. | 3 |

Membership never outranks action. A self-declaration is worth no more than speech.

### 9.2 Rarity

Rarity measures **both depth of witness and worth — not popularity or money.**

- **Worth** is intrinsic curatorial weight (0–5) supplied with the entry. It sets the floor.
- **Depth of witness** is the weighted acknowledgment total: Observer 1, Aspirant 1,
  Communicator 2, Active Member 2, Responder 3.
- `score = worth + witness`, mapped onto Very Common → Common → Uncommon → Rare → Unique.
- The surface shows the symbol. Hover, focus, or tap reveals an honest breakdown.
- Raw counts are never the surface. Nothing is for sale.

### 9.3 Love and acknowledgment

- **Love** is a private, personal signal. It never affects rarity.
- **Acknowledge** is the primary validating interaction. It records depth of witness.
- **Acknowledged by** lists only what this device holds, including imported carrier links.
- **Carrier links** (`#ack=<base64url payload>`) carry one acknowledgment from the creating
  device to Sir Collins or to anyone the sender chooses. Nothing is uploaded.

### 9.4 QR law

QR codes carry **public destinations and the giving handshake only**. Acknowledgment links
contain a person's details and are never printed as a code.

- Generate on-device (`src/lib/qr.ts`), never with a remote QR image service.
- One code per intent. Always pair it with a human-readable URL.
- Minimum quiet zone 4 modules; test at 320 px and in high-contrast mode.
- Ranked uses:
  1. **Giving Plan handshake** — `https://t.me/CollinsRoyalMedium?text=Hi%20from%20Giver`
     (scan → chat opens with the exact words already typed).
  2. **Carry the portal** — the canonical home URL.
  3. **The Voice** — a link to `#stage` for event slides and printed material.
  4. **Contact card** — the plain Telegram profile, no prefilled text.
- The attached Telegram QR is a design reference. The shipped code is generated from the
  canonical URL, so it stays crisp, themeable, offline, and current.

## 10. Copy and content law

1. **Verbatim rule.** Text supplied by Sir Collins is placed verbatim in `src/data/entries.json`
   and in quoted copy. Never paraphrase, “improve”, or translate it without instruction.
2. **Canonical terms.** Use these exact forms everywhere:
   - `Token/Giving Mode` (not “Giving/Token Mode”)
   - `The Voice` (section title; the old “From the Stage” is retired)
   - `Inspirations` (not “Featured Inspirations”)
   - `Active Member`, `Membership Aspirant`, `Communicator`, `Observer`, `Responder`
3. **No editorial inflation.** No “Featured”, no “Aphorisms to live by”, no “On stage” label.
4. **Provenance is not decoration.** Never delete the record of where something was said.
   Re-frame the label if asked, but keep the origin in the caption or metadata.
5. **Typo rule.** Quoted author text is preserved as written, including “been GOOD or been
   RIGHT”. UI chrome is corrected only with a flag in `docs/COPY-DECISIONS.md`.
6. **One voice.** Section notes are short, declarative, and free of marketing adjectives.

## 11. Token/Giving Mode and the Giving Plan

Token/Giving Mode is the user-facing name of the openness state (internally `receptive`, kept
for stored-state compatibility). The exact openness copy is rendered verbatim:

> Sir Collins and his community network are open and receptive to the right people and the
> right resources or gifts from those who love and trust our uniqueness

**The hint is part of the feature, not a tooltip.** Toggling the mode is an act of intent:
choosing to give, or choosing to request a Giving Plan. The handshake is one sentence sent to
the Telegram inbox:

> Hi from Giver

**A Giving Plan is a conversation, not a checkout.** No payment code, no card fields, no
processor in `v0.0.x`. The portal records intent; Telegram carries the conversation; a payment
adapter arrives only when a Worker, a processor, and a written policy exist.

## 12. Contact and channels

- **Professional email:** `access1@tutamail.com`
- **Personal email:** `sircollins1@protonmail.com`
- **Telegram:** [t.me/CollinsRoyalMedium](https://t.me/CollinsRoyalMedium)
- **Giving handshake:** `https://t.me/CollinsRoyalMedium?text=Hi%20from%20Giver`

`access1@tutamail.com` is the professional channel. `sircollins1@protonmail.com` is personal.
Both addresses stay literal in the HTML so they are readable without JavaScript, copyable, and
clickable as real `mailto:` links.

Cloudflare **Email Address Obfuscation is off** for `coreconcept1.net` (zone
`4d46970af3e406e90186b99f07156861`). Do not re-enable it: it rewrites addresses to
`/cdn-cgi/l/email-protection` and hides them from crawlers and no-JS readers.

## 13. Current state (`v0.0.1`)

- **Status:** live on Cloudflare Pages behind the custom domain; active development.
- **Green baseline:** strict TypeScript, 26 tests passing, zero lint errors.
- **Live:** Liquid Glass shell led by the emblem; JSON-LD Person/WebSite/CollectionPage;
  OPFS → localStorage → memory storage adapter; service worker; Unique Skills (10) with
  Creative Expressions; Unique Concepts (Ceremoni, Royal Discipleship, Super Birthdays); the
  TEDx Jalingo stage feature; five verbatim Inspirations/Reflections; Love, Acknowledge, Share;
  “Acknowledged by”; responder form; carrier links; Token/Giving Mode; qualitative rarity;
  both contact addresses; client-side QR.
- **Pending:** the copy batch in `docs/COPY-DECISIONS.md`; the Giving Plan QR; state export.
- **Not built:** Private AI Agent layer, `sqlite-vec` search, CBOR-LD, payment adapter,
  server-aggregated acknowledgments, Android shell, notifications.

## 14. ALP posture

The target is an **Average Lovable Product**, not a minimum viable one: the smallest release a
real person would keep, recommend, and return to. Average in scope; above average in feel.
See [`ALP.md`](ALP.md) for journeys, phases, gates, and the definition of done.

## 15. Governance

| Document | Question it answers |
| --- | --- |
| `CONTEXT.md` | Why does this exist, and what is non-negotiable? |
| `SPECS.md` | What exactly must be built, and how is it verified? |
| `ALP.md` | In what order, at what quality bar, with what gates? |
| `docs/COPY-DECISIONS.md` | What exact words change, and which flags are open? |
| `WORKFLOWS.md` | How do we change, review, deploy, and rebuild? |
| `SKILLS.md` | What must the agent be competent in? |
| `TOOLS.md` | What is installed versus planned? |
| `README.md` | How does a new maintainer run and ship it? |

**Change classes:** copy (no ADR, copy register), feature (SPECS + tests), architecture
(ADR + SPECS), release (WORKFLOWS C). Any change to a non-negotiable needs an ADR that names
the trade-off.

## 16. Decision log

| ID | Decision | Rationale |
| --- | --- | --- |
| ADR-001 | The web core is canonical; native shells are clients. | One source of truth; avoids a fork. |
| ADR-002 | Android bundles the web core in a WebView rather than a TWA; KMP/Compose only on evidence. | Works offline on first launch with no browser or network; no duplicated domain logic; smallest sustainable surface. |
| ADR-003 | No server-side personal data in `v0.0.x`. | Sovereignty is the product, not a setting. |
| ADR-004 | Telegram is the giving and community transport; the portal is the record. | Uses an existing, trusted channel; no forum to maintain. |
| ADR-005 | QR codes are generated on-device from canonical URLs. | Offline, crisp, themeable, no third-party dependency. |
| ADR-006 | Rarity = curatorial worth + depth of witness; no money, no popularity. | Honest scale; membership cannot outrank action. |
| ADR-007 | Copy is a contract; verbatim content is immutable without instruction. | The words are the product. |
| ADR-008 | No analytics SDK; research is local and opt-in. | Trust beats instrumentation. |

## 17. Open questions

1. **QR target:** the attached Telegram QR image could not be decoded in this environment.
   Confirm it resolves to `https://t.me/CollinsRoyalMedium`; if not, supply the URL text.
2. **Stage credit:** confirm “Role: Strategist & Creative Facilitator” and the event naming
   “TEDx Jalingo · A New Wave” are accurate and may be published.
3. **Typos:** are “Occassion”, “Inslirations”, and “A honorable” intentional verbatim forms, or
   should UI chrome use “Occasion”, “Inspirations”, and “An honorable”? (Quoted content stays
   verbatim either way.)
4. **Worth in UI:** may the rarity breakdown label the intrinsic component “Worth”, or should it
   stay “Curation” to avoid a monetary reading?
5. **Android distribution:** Play Store, direct APK, or both? Who owns the signing key?
6. **Notifications:** is Web Push wanted in `v0.0.2`, or is in-app “what's new” enough?
