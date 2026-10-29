# CONTEXT: Sir Collins Portal (sircollins.concept1.net)

## 1. Mission Statement

To build and maintain the **Sovereign Digital Twin** of Sir Collins Chris — a self-sufficient,
offline-first, machine-readable PWA that serves as a living encyclopedia of leadership, ICT
strategy, and creative genius. We do not merely display information; we engineer a **reliable,
universal, and robust** digital entity.

## 2. Identity & Persona

- **Principal**: Sir Collins Chris
- **Roles**: Unique Pioneer | Leadership Consultant | Royal Tutor | ICT Strategist | Creative Genius
- **Domain**: `sircollins.concept1.net` (Primary Entry Point)
- **Project Directory**: `~/sircollins-portal`

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

- **Language**: TypeScript (Strict), C++ (WASM only for compute-heavy tasks).
- **Runtime**: Cloudflare Workers (Edge) + Browser (PWA).
- **Storage**: SQLite WASM (`sqlite-vec` for semantic search) + OPFS.
- **Payments**: Sovereign Adapter (Flutterwave/Paystack) via Cloudflare Workers.
- **Deployment**: Cloudflare Pages (Project: `sircollins-pwa`).

## 5. Current State

- **Version**: 0.0.1 (Core Architecture Live)
- **Status**: Active Development.
- **Immediate Goal**: Integrate Private AI Agent interaction layer and finalize
  "Inspirations & Reflections" teaser module.

## 6. Contact & Channels

- **Professional Email**: access1@tutamail.com
- **Personal Email**: sircollins1@protonmail.com
- **Telegram**: [t.me/CollinsRoyalMedium](https://t.me/CollinsRoyalMedium)

> `access1@tutamail.com` is the professional channel. `sircollins1@protonmail.com` is personal.
