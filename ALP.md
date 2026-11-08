# ALP — Average Lovable Product Plan

**Product:** Sir Collins Portal `v0.0.2`
**Definition:** an **Average Lovable Product** is the smallest release a real person would
keep, recommend, and return to. Average in scope; above average in feel.

This plan implements [`CONTEXT.md`](CONTEXT.md) and [`SPECS.md`](SPECS.md). It does not begin
with code. It begins with a ratified copy contract and a green baseline.

---

## 1. ALP versus MVP

| | MVP | ALP (this plan) |
| --- | --- | --- |
| Question | What is the least we can ship? | What is the least a person will love? |
| Scope | Feature-minimal | Journey-complete |
| Quality | “Fix later” | Release-blocking |
| Copy | Placeholder | Authored, verbatim, final |
| Feel | Functional | Dignified, quiet, fast |
| Risk | Rework after launch | Rework before launch |

The ALP has **five complete journeys**. A journey is complete when it works offline, on a
phone, with a keyboard, and after a reload.

## 2. The five lovable journeys

1. **Meet** — land, understand the person in under 60 seconds, reach The Voice.
2. **Read** — read all five entries offline, with no layout shift and no dependency tax.
3. **Witness** — acknowledge at the right depth, see an honest rarity symbol, carry the
   acknowledgment to another device.
4. **Give** — toggle Token/Giving Mode, read the hint, scan one QR, land in Telegram with
   “Hi from Giver” already typed.
5. **Keep** — install the PWA or the Android app, return offline, export personal state.

If any journey needs an explanation longer than one sentence, it is not done.

## 3. Quality bar (release-blocking)

- N1–N12 in `CONTEXT.md` §5 all pass.
- Zero console errors on a real Android device.
- The copy contract has no retired strings.
- Every QR scans on two phones and one print test.
- A person who has never seen the portal can complete journey 4 without help.

## 4. Phases, gates, and effort

Effort is focused engineering time, not calendar time. T-shirt sizes assume one maintainer.

### Phase 0 — Ratify (S, ~0.5 day)

**Work**

- Answer the six open questions in `CONTEXT.md` §17.
- Approve `docs/COPY-DECISIONS.md` line by line.
- Confirm the Telegram QR target URL.
- Accept ADR-001…ADR-008.

**Exit gate G0:** every copy line is marked *approved* or *verbatim-preserve*; the QR URL is
confirmed in writing.

**Why first:** implementing unapproved copy is rework by definition.

### Phase 1 — Copy and content law (S, ~1 day)

**Work**

- Apply C-01…C-08 from the copy register.
- Update `ACK_ROLE_LABEL`, `ACK_ROLE_DESCRIPTION`, `RARITY_SCALE_NOTE`.
- Remove “Featured” from the meta description and manifest description.
- Remove “On stage” and “From the Stage”; add “The Voice” and the four-line credit.
- Keep provenance as a secondary line.
- Add a contract test: role snapshot + retired-string grep.

**Exit gate G1:** `npm run lint`, `npm run test`, `npm run build` pass; a DOM grep finds no
retired copy; the stage section still proves its origin.

### Phase 2 — Giving Plan handshake (S, ~1 day)

**Work**

- Add `GIVING_HANDSHAKE` to `src/lib/schema.ts` (single source).
- Render the verbatim hint in the Giving panel.
- Render the QR when the mode is active; add “Open Telegram” and the literal URL.
- Add “Save QR”; reuse `paintQr` and `downloadCanvas`.
- Add the handshake to the share dialog as a named intent.

**Exit gate G2:** scanning opens Telegram with “Hi from Giver” prefilled; the QR is hidden when
the mode is off; no network request renders it.

### Phase 3 — Portability and research (M, ~1.5 days)

**Work**

- Add `exportState()` / `importState()` with version checks and merge rules.
- Add a quiet “Export my data” action in the footer or Respond panel.
- Add `researchOptIn` and the local signal recorder (off by default).
- Include signals in export only when opted in.

**Exit gate G3:** export → clear → import restores every field; with opt-in off, no signal is
written; the export contains no device identifiers.

### Phase 4 — PWA hardening (M, ~1.5 days)

**Work**

- Add the update-available prompt for a waiting service worker.
- Add one restrained, dismissible install invitation.
- Add PNG 192/512 icons for store and install surfaces.
- Add `public/.well-known/assetlinks.json` placeholder and a generation note.
- Verify offline reload and cache versioning.

**Exit gate G4:** installable on Android Chrome; offline reload passes; update prompt appears
after a version bump; Lighthouse PWA and a11y pass.

### Phase 5 — Android app (M, ~1.5 days)

**Work**

- Bundle `dist/` into the APK via Gradle `syncWebAssets`; serve it to a WebView from
  `https://appassets.androidplatform.net`.
- Set package id, versionCode, signing key custody.
- Remove the `INTERNET` permission; route external links to the system browser.
- Claim the portal origin for deep links; verify asset links with Google’s statement list tool.
- Produce an AAB for any future store and a direct APK for private distribution.

**Exit gate G5:** app installs, opens offline on a clean device with no browser installed,
every portal feature works, and deep links open the bundled copy.

### Phase 6 — Release and verify (S, ~0.5 day)

**Work**

- Write `CHANGELOG.md`.
- Run the full gate: lint → test → build → dry-run → deploy.
- Post-deploy: headers, literal emails, JSON-LD, SW cache version, QR scans.
- Tag `v0.0.2`; record the deployment id for rollback.

**Exit gate G6:** every N1–N12 check is recorded with evidence; rollback id is written down.

## 5. Work breakdown by epic

| Epic | Requirements | Phase |
| --- | --- | --- |
| Copy contract | FR-02, FR-03, FR-15 | 1 |
| Giving handshake | FR-03, FR-04 | 2 |
| Rarity honesty | FR-06 | 1 |
| Roles exactness | FR-05 | 1 |
| Portability | FR-10 | 3 |
| Research (local) | FR-13 | 3 |
| PWA hardening | FR-11 | 4 |
| Android shell | FR-12 | 5 |
| Release | §13 SPECS | 6 |

## 6. Definition of Done

A requirement is done only when all of these are true:

- [ ] Implemented behind the documented adapter seam.
- [ ] Covered by a unit, contract, or journey test (or a recorded manual check).
- [ ] Passes on a 320 px viewport and a real Android device.
- [ ] Works offline after one visit.
- [ ] Keyboard-only and 200% zoom pass.
- [ ] No console error, no CSP violation, no unexpected network request.
- [ ] Copy matches the register exactly.
- [ ] `CACHE_VERSION` bumped if the shell changed.
- [ ] Docs updated in the same change (CONTEXT, SPECS, register, changelog).
- [ ] Deployment id recorded after release.

## 7. Decision gates

| Gate | Question | If no |
| --- | --- | --- |
| G0 | Is the copy ratified? | Stop; do not code. |
| G2 | Does one scan reach the handshake? | Fall back to a visible URL and a copy button. |
| G4 | Does the PWA meet the install/offline bar? | Do not ship the Android shell yet. |
| G5 | Does the bundled app work offline and install cleanly on a real device? | Ship PWA only; revisit the shell. |
| G6 | Are all N1–N12 evidenced? | HALT; “Build Again”. |

## 8. Evidence without surveillance

The portal does not ship analytics. Research is qualitative and local:

- **Local signals** (opt-in, exportable): install, return visit, acknowledgment sealed, carrier
  link opened, giving handshake opened, offline load succeeded.
- **Human research**: five short conversations per release — one reader, one witness, one
  giver, one community member, one first-time visitor.
- **Design decisions** cite either a signal export or a conversation note. No “I think”.

This satisfies the User Research north star without betraying the privacy non-negotiable.

## 9. Release cadence

- **Content release:** copy or entries only; no app release; bump `CACHE_VERSION`.
- **Shell release:** layout, logic, adapters; full gate; tag.
- **Platform release:** bundled APK/versionCode; deep links verified; offline launch checked.
- **Emergency:** “Build Again” protocol in `WORKFLOWS.md`.

## 10. What would justify building again

Only these, and only with an ADR:

1. A measured performance ceiling the web core cannot pass on target devices.
2. A required native capability (background notification, native share target) that the bundled
   WebView shell cannot provide.
3. A privacy or data-loss defect in production.
4. A scale of content that makes bundled JSON unworkable.

Absent one of these, we improve the core. We do not fork it.

## 11. First action after approval

Run Phase 0, then Phase 1. The first commit is the copy contract and its test — not a redesign.
The build is already green; the goal is to keep it green while the words become exact.
