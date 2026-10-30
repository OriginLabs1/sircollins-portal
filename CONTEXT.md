# CONTEXT: Sir Collins Portal (sircollins.coreconcept1.net)

## 1. Mission Statement

To build and maintain the **Sovereign Digital Twin** of Sir Collins Chris — a self-sufficient,
offline-first, machine-readable PWA that serves as a living encyclopedia of leadership, ICT
strategy, and creative genius. We do not merely display information; we engineer a **reliable,
universal, and robust** digital entity.

## 2. Identity & Persona

- **Principal**: Sir Collins Chris
- **Roles**: Unique Pioneer | Leadership Consultant | Royal Tutor | ICT Strategist | Creative Genius
- **Domain**: `sircollins.coreconcept1.net` (primary entry point)
- **Project Directory**: `~/projects/sircollins-portal`
- **Emblem**: `public/brand/logo.png` (transparent PNG, 696×587) — the hero mark, the
  brand badge, the Open Graph/Twitter image and the shell asset. It is **not** `Person.image`:
  an emblem is not a depiction of the person.
- **Hero copy**: “Life, reality, integrity, and unique impact —” /
  “The living portal of the Life and unique realities of Sir Collins.”

## 3. Architectural Pillars (Acceptance Criteria)

Every line of code, design decision, and feature must satisfy these criteria:

- We build the best, or we build again (only when justifiably vital).
- **Robustness**: Zero-runtime errors. Graceful degradation (localStorage fallback if OPFS fails).
- **Sovereignty**: Data ownership is absolute. Local-first (SQLite WASM + OPFS) with optional
  sovereign sync.
- **Semantic Integrity**: All data is machine-readable via **JSON-LD** (public) and **CBOR-LD**
  (internal/machine-to-machine).
- **Aesthetic**: "Liquid Glass" UI (advanced glassmorphism, aurora gradients, spring-physics)
  meeting "Structural" typography (Google Sans/Inter).
- **Performance**: <100ms interaction latency. Instant load via Cloudflare Edge.
- **Future-Proofing**: Modular components. Replaceable without breaking the whole.

## 4. Tech Stack Constraints

- **Language**: TypeScript (Strict); C++/WASM reserved for compute-heavy modules (none yet).
- **Runtime**: Browser (PWA) today; Cloudflare Workers at the edge once server logic exists.
- **Storage**: SQLite WASM (`sqlite-vec` for semantic search) + OPFS — target. The shipped
  adapter is OPFS → localStorage → in-memory.
- **Payments**: Sovereign Adapter (Flutterwave/Paystack) via Cloudflare Workers — target; no
  payment code or Worker exists yet.
- **Deployment**: Cloudflare Pages (project `sircollins-pwa`), artifact directory `dist/`,
  deployed by `tools/deploy.py` (primary) or Wrangler (alternative).

## 5. Current State

- **Version**: 0.0.1 (core architecture live).
- **Status**: Active development; production is a static Pages deployment behind the custom
  domain.
- **Live now**: strict TypeScript build; Liquid Glass shell led by the emblem; JSON-LD
  Person/WebSite/CollectionPage (with `knowsAbout` read from the interface); OPFS/localStorage
  storage adapter; service worker; **Unique Skills** (10 capabilities) with **Creative
  Expressions** links; **Unique Concepts** (Ceremoni, Royal Discipleship, Super Birthdays);
  the TEDx Jalingo stage feature; the verbatim **Inspirations** (2) and **Reflections** (3);
  Love, Acknowledge, Share per entry; “Acknowledged by”; responder form with name, X,
  Facebook and a why/where note; carrier links; Token/Giving Mode; qualitative rarity symbols;
  both contact addresses visible in the interface.
- **Interaction model**: [see §7](#7-interaction-model).

## 6. Contact & Channels

- **Professional Email**: access1@tutamail.com
- **Personal Email**: sircollins1@protonmail.com
- **Telegram**: [t.me/CollinsRoyalMedium](https://t.me/CollinsRoyalMedium)

> `access1@tutamail.com` is the professional channel. `sircollins1@protonmail.com` is personal.

Cloudflare **Email Address Obfuscation is off** for `coreconcept1.net` (zone
`4d46970af3e406e90186b99f07156861`). Both addresses must stay literal in the HTML so they are
readable without JavaScript, copyable, and clickable as real `mailto:` links. Do not re-enable
the setting; it rewrites addresses to `/cdn-cgi/l/email-protection` and hides them from
crawlers and no-JS readers.

## 7. Interaction Model

- **Reading order**: Unique Skills → Creative Expressions → Unique Concepts → From the Stage
  → Token/Giving Mode → Inspirations → Reflections → Respond. Token/Giving Mode is never the
  first feature under “Enter the portal”; capability and verifiable origins lead.
- **Token/Giving Mode** is the user-facing name of the openness state (internally the
  `receptive` flag, kept for stored-state compatibility). The exact openness copy is
  rendered verbatim and is not paraphrased.
- **Roles** (`src/lib/schema.ts` → `ACK_ROLES`), lightest claim to deepest:
  Observer · Membership Aspirant · Communicator · Community Active Member · Responder.
  Membership roles never outrank action on the rarity scale.
- **Acknowledge** is the primary validating interaction. It records depth of witness, not
  popularity, and drives the **rarity symbol**. No money moves.
- **Love** is a private, personal signal; it never affects rarity.
- **Carrier links** (`#ack=<base64url payload>`) carry one acknowledgment from the device
  that created it to Sir Collins or to anyone the sender chooses. Nothing is uploaded.
- **Rarity** = intrinsic curation weight (0–5) + weighted acknowledgments
  (Observer 1, Aspirant 1, Communicator 2, Active Member 2, Responder 3) mapped onto
  Very Common → Common → Uncommon → Rare → Unique. The UI shows the symbol; hover/focus or
  tap reveals the breakdown. Raw counts are never the surface.
- **QR codes** carry public destinations only (the portal, an entry). Acknowledgment links
  contain a person's details, so they are shared directly and never printed as a code.
