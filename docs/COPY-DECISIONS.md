# COPY DECISIONS — `v0.0.2` batch

**Status:** awaiting approval. Nothing here is implemented until Phase 0 of [`ALP.md`](../ALP.md)
closes.

**Legend:** **APPROVED** = instruction is unambiguous, apply as written. **PRESERVE** = quoted
author text, never “corrected”. **FLAG** = needs a one-word decision before implementation.

**Canonical term rule:** UI chrome uses `Token/Giving Mode`, `The Voice`, `Inspirations`,
`Active Member`, `Membership Aspirant`, `Communicator`, `Observer`, `Responder`. Quoted content
stays exactly as supplied.

---

## C-01 — Stage credit block

**File:** `index.html` (stage figcaption)
**Status:** APPROVED · **FLAG** on spelling and provenance

**Current**

> The slide as it appeared on the TEDx Jalingo stage, from the talk *A New Wave*.

**New (verbatim, four lines)**

> A living Inspiration by Sir Collins
> Occassion: TEDx Jalingo
> Theme: 'A New Wave'
> Role: Strategist & Creative Facilitator

**Flags**

1. `Occassion` → `Occasion`. Recommended fix in UI chrome; preserve only if the spelling is
   intentional.
2. **Provenance:** replacing the sentence removes the only statement of *where* the slide was
   shown. Recommendation: keep it as a smaller secondary line —
   “Delivered on the TEDx Jalingo stage, from the talk *A New Wave*.” Provenance is a
   non-negotiable (CONTEXT §10.4), not decoration.
3. `Role: Strategist & Creative Facilitator` is a factual claim about the event. Confirm before
   publishing.

**Accept:** four lines render as a block; the slide quote and attribution remain; provenance is
still present in the DOM.

---

## C-02 — Section title

**File:** `index.html`
**Status:** APPROVED

| Current | New |
| --- | --- |
| `<h2 id="stage-title">From the Stage</h2>` | `<h2 id="stage-title">The Voice</h2>` |

Keep `id="stage"` and `#stage` links stable. Update `README.md` and any copy that says “From the
Stage”.

---

## C-03 — Remove the “On stage” eyebrow

**File:** `index.html`
**Status:** APPROVED

Delete `<p class="eyebrow">On stage</p>`. The section note `TEDx Jalingo · A New Wave` remains
and already carries the context. Check vertical rhythm after removal.

---

## C-04 — Giving hint

**File:** `index.html` (Token/Giving panel)
**Status:** APPROVED · **FLAG** on term order

**New (verbatim)**

> HINT: Toggling the Giving/Token Mode or turning it on also means choosing to give or choosing
> to request for a 'Giving Plan' by saying 'Hi from Giver' to Sir Collins Telegram inbox.

**Placement:** its own paragraph directly below the openness copy, above the status line. Not a
tooltip, not a footnote — it is the instruction for the feature.

**Flags**

1. The hint says `Giving/Token Mode`; the panel and badge say `Token/Giving Mode`. Recommendation:
   keep the hint verbatim as supplied, and keep chrome on `Token/Giving Mode`. If consistency is
   preferred, change the hint to `Token/Giving Mode` with approval.
2. `request for a` is non-standard; `request a` is correct. Preserve unless approved.

**Accept:** text matches character-for-character; it is visible without opening a dialog.

---

## C-05 — Remove the “Aphorisms to live by” eyebrow

**File:** `index.html`
**Status:** APPROVED

Delete `<p class="eyebrow">Aphorisms to live by</p>`. The section note
“Held as first principles, carried by those who acknowledge them.” already does the work.

---

## C-06 — “Featured Inspirations” → “Inspirations”

**File:** `index.html`
**Status:** APPROVED

| Current | New |
| --- | --- |
| `<h2 id="inspirations-title">Featured Inspirations</h2>` | `<h2 id="inspirations-title">Inspirations</h2>` |

Note: the instruction wrote “Inslirations”; that is treated as a typo for **Inspirations**.

---

## C-07 — Retire “featured” everywhere

**Files:** `index.html` (meta description), `public/manifest.webmanifest` (description)
**Status:** APPROVED

| Current fragment | New fragment |
| --- | --- |
| `— featured inspirations, reflections,` | `— inspirations, reflections,` |

Also update the Open Graph/Twitter descriptions if they are ever changed to mention entries.
A grep test must fail on the retired string.

---

## C-08 — Rarity note

**Files:** `src/lib/portal.ts` (`RARITY_SCALE_NOTE`), `index.html` (legend detail)
**Status:** APPROVED · **FLAG** on the word “worth”

**Current**

> Rarity measures depth of witness, not worth, popularity, or money. Curation sets the floor;
> acknowledgment raises it.

**New**

> Rarity measures both depth of witness and worth, not popularity or money.

**Why:** the current sentence contradicts the implementation. The scale already adds intrinsic
curatorial weight (worth) to weighted witness. The new sentence matches the code.

**Flag:** “worth” can read as monetary value. Recommendation: label the breakdown row
**“Worth (curation)”** so the meaning is unambiguous.

**Accept:** the constant and the rendered note are identical; a unit test asserts the string.

---

## C-09 — Legend detail completeness

**File:** `index.html` (rarity legend)
**Status:** APPROVED

**Current**

> Observers weigh 1, Communicators 2, Responders 3. Curation sets the floor. …

**Problem:** it omits Membership Aspirant (1) and Active Member (2), so the published scale is
incomplete.

**New**

> Observers 1 · Membership Aspirants 1 · Communicators 2 · Active Members 2 · Responders 3.
> Worth sets the floor; witness raises it. Nothing here is for sale, and no raw count appears on
> the surface.

**Accept:** all five roles appear; the weights match `ACK_WEIGHT`.

---

## C-10 — Role labels and descriptions

**Files:** `src/lib/schema.ts` (`ACK_ROLE_LABEL`, `ACK_ROLE_DESCRIPTION`), tests
**Status:** APPROVED · **FLAG** on “A honorable”

| Role id | Label (new) | Description (new, verbatim) | Old description |
| --- | --- | --- | --- |
| `observer` | Observer | I read and observed. | I have read and held this. |
| `aspirant` | Membership Aspirant | A potential member willing to be a recognized member of Sir Collins Community. | A potential member who is willing to be recognized as a honorable member… |
| `communicator` | Communicator | I spoke or reshared this. | I have shared or spoken this. |
| `active-member` | **Active Member** | A honorable member active within Sir Collins Community. | (unchanged text) |
| `responder` | Responder | I acted on this or created from it. | (unchanged) |

**Flags**

1. `A honorable` → `An honorable`. Recommended fix in UI chrome; preserve if intentional.
2. Label change `Community Active Member` → `Active Member` affects the role radio list and the
   “Acknowledged by” line. No stored data changes: the id stays `active-member`.

**Accept:** a snapshot test asserts the five pairs; both role fieldsets render from the same
source; no old label remains.

---

## C-11 — Telegram QR and Giving Plan handshake

**Files:** `src/lib/schema.ts`, `index.html`, `src/main.ts`
**Status:** APPROVED · **FLAG** on the attached QR target

**Canonical handshake**

```
https://t.me/CollinsRoyalMedium?text=Hi%20from%20Giver
```

**Behaviour**

- QR appears in the Token/Giving panel when the mode is active.
- A visible “Open Telegram” link and the literal URL sit beside it.
- “Save QR” downloads a 640 px PNG.
- The same handshake is available from the share dialog.
- QR is generated on-device by `src/lib/qr.ts`; no remote QR service.

**Why generate instead of embedding the attachment:** a generated code is crisp at any size,
themeable, offline, and always matches the canonical URL. The attached image is a design
reference, not a shipped asset.

**Flag:** the attached Telegram QR image could not be decoded in this environment. Confirm it
resolves to `https://t.me/CollinsRoyalMedium`. If it points elsewhere, supply the URL text.

**Accept:** scanning opens the chat with `Hi from Giver` already typed; turning the mode off
hides the QR; no network request renders it.

---

## Retired strings (contract test)

The build must fail if any of these appear in shipped UI copy:

```
Featured Inspirations
featured inspirations
Aphorisms to live by
On stage
From the Stage
Community Active Member
I have read and held this.
I have shared or spoken this.
Rarity measures depth of witness, not worth
```

Excluded from the check: this register, `CONTEXT.md`, `SPECS.md`, `ALP.md`, git history, and
`dist/` before build.
