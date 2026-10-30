# WORKFLOWS: Standard Operating Procedures

## Workflow A: Feature Request & Implementation

1. **Analyze**: Break down the request against `CONTEXT.md` criteria (Robustness, Sovereignty).
2. **Plan**: Outline the file changes required (frontend, data, config).
3. **Verify**: Check that every dependency is in `TOOLS.md` §1 *Installed*. Anything in §2
   *Planned* needs an explicit decision before it is imported.
4. **Execute**:
   - Apply the change as one consolidated patch, not a scatter of partial edits.
   - Include migration scripts if a database schema changes.
5. **Validate**: Run the real commands — `npm run lint`, `npm run test`, `npm run build` — and
   report their output. Do not simulate a build when the build can be run.
6. **Report**: Confirm success or list the exact failure point.

## Workflow B: Code Review & Optimization

1. **Scan**: Review code for `any` types, blocking operations, or non-modular coupling.
2. **Refactor**: Propose specific improvements (e.g. "Move this logic to a WASM module for
   performance").
3. **Test**: Generate Vitest cases for critical paths (the suite runs with `npm run test`).
4. **Commit**: Prepare a commit message following Conventional Commits (`feat:`, `fix:`,
   `refactor:`).

## Workflow C: Deployment Protocol

1. **Pre-flight**:
   - `cd ~/projects/sircollins-portal`
   - Confirm the token resolves (environment → `.env` → `~/.cloudflare-token`):
     `python3 tools/deploy.py --verify`.
   - Run `npm run lint`, `npm run test`, `npm run build`.
   - Confirm the artifact is in `dist/`. There is no `src/frontend/`.
2. **Deploy** (primary path, no Wrangler):
   - `python3 tools/deploy.py --commit-message "..."`
   - Alternative: `npx wrangler pages deploy dist --project-name=sircollins-pwa`
3. **Post-deploy**:
   - `curl -sI https://sircollins.coreconcept1.net/` → 200 plus the CSP, `X-Frame-Options`,
     `Referrer-Policy` and `Permissions-Policy` headers.
   - Compare every file in `dist/` with the live bytes (the Python deployer prints the
     deployment id; use it for rollback if a check fails).
   - `/sw.js` must return `Cache-Control: no-cache` (a scoped zone Cache Rule enforces this).
   - Confirm the service worker registers and JSON-LD includes Person, WebSite and
     CollectionPage (Quotation/Question parts). `Person.image` is intentionally absent; the
     emblem is referenced through Open Graph and the manifest instead.
   - Check the canonical URL and Open Graph URL are `https://sircollins.coreconcept1.net/`.

## Workflow D: "Inspirations & Reflections" Content Update

1. **Input**: Receive raw text/media from Sir Collins.
2. **Process**:
   - Place the text **verbatim** in `src/data/entries.json`; never paraphrase, and preserve
     the author's wording (including “been GOOD or been RIGHT”).
   - `kind` is `inspiration` or `reflection`; `weight` is the 0–5 curation floor that seeds
     the rarity scale.
   - JSON-LD is derived automatically: `buildCollectionGraph()` maps inspirations to
     `Quotation` and reflections to `Question`. Do not hand-write the graph.
   - Compress to CBOR-LD for internal storage once the encoder exists; it does not exist yet.
3. **Output**: Update `src/data/entries.json`; the dev server hot-reloads. Bump
   `CACHE_VERSION` in `public/sw.js` before deploying.
4. **Notify**: "Content ingested. Inspirations and Reflections are live on
   sircollins.coreconcept1.net."

## Workflow E: Capability, Concept & Stage Content

1. **Skills**: the ten capability tiles and their one-line descriptions live in `index.html`
   (§ Unique Skills). `Person.knowsAbout` is read from those titles at boot, so renaming a
   skill updates the JSON-LD without a second edit.
2. **Creative Expressions**: external links open in a new tab with `rel="noopener noreferrer"`.
   Do not inline third-party players; the CSP stays `default-src 'self'`.
3. **Concepts**: keep Sir Collins's claims and dates as given (“a few years ago” is
   intentional; do not invent a year). “Reality hint” is a label; the copy beneath it is his.
4. **Stage image**: `public/media/tedx-jalingo.jpg` is served as supplied at 1080×856. Every
   image needs real `width`/`height`, `loading="lazy"` below the fold, and alt text that
   carries the slide's quote. The mat links to the full-size file; keep `rel="noopener"`.
   Add new media to `SHELL_ASSETS` and bump `CACHE_VERSION`.
5. **Contact**: both `access1@tutamail.com` and `sircollins1@protonmail.com` remain visible in
   the contact panel and the personal address in the footer. Keep Cloudflare Email Address
   Obfuscation **off** (zone setting `email_obfuscation`) so the HTML carries the real
   addresses; after a deploy, `curl` the home page and confirm the literal addresses appear.

## Workflow F: Acknowledgment & Rarity Review

1. **Privacy first**: acknowledgments live only on the device that created them. Never add
   silent upload, analytics on names, or a server-side tally without an explicit decision.
2. **Carrier links**: `#ack=<payload>` is validated by `decodeAck()` against the current entry
   ids. Adding an entry means it becomes a valid carrier target; removing one invalidates the
   old links (they fail closed).
3. **Roles**: changes to `ACK_ROLES` must also update `ACK_ROLE_LABEL`, `ACK_ROLE_DESCRIPTION`,
   `ACK_ROLE_ICON`, `ACK_WEIGHT`, and both role fieldsets in `index.html`.
4. **Rarity**: curation sets the floor, acknowledgment raises it. Membership must never weigh
   more than action. Keep the breakdown honest — every point must be attributable.
5. **Verify**: `npm run test` covers payload round-trips, role weights, tier boundaries and
   corrupt-state recovery.

## Optional Emergency Protocol: "Build Again"

If a release fails any acceptance criterion:

1. **HALT** deployment immediately.
2. **Isolate** the failing component.
3. **Revert** to the last known stable commit or Cloudflare deployment.
4. **Diagnose** root cause (logic, syntax, or architecture).
5. **Rebuild** with corrected logic before retrying.
