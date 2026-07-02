# Plan — Landing Redesign (Leo/Aleo-inspired aesthetic)

Design work: adopt the **leo-lang.org / aleo.org** visual language on the OpenNeo
homepage — geometric display type, a pastel feature-pillar row, and an "Explore
our tools" colored-border card grid — adapted to OpenNeo's own brand and content.

> **Reference use, not reproduction.** leo-lang.org and aleo.org are the *design
> references*. We recreate the **layout patterns, type treatment, pastel-icon
> style, and card structure** — we do **not** copy their logo marks (the Aleo
> diamond), product names ("Leo", "snarkOS", "Aleo SDK"), illustrations, or copy.
> All glyphs, wordmarks, and text are original OpenNeo assets. See
> Architectural Non-Negotiables.

---

## Current State

**Landing** (`apps/landing/index.html`, single file + `stats.js`, tests in
`test/content.test.ts`):
- Warm brand shipped over PRs #52–#58: serif OpenNeo logo (Iowan/Palatino stack),
  cream + dark themes (CSS-variable tokens, `☾/☀` toggle, persisted to shared
  `neoos.theme` key), interactive live-network sparkline charts.
- Sections top→bottom: `nav` · `hero` (chip + h1 + tagline + CTA + install line)
  · `#features` (6 text cards) · `#protocol` (4 layers) · `#stats` (charts) ·
  `#donate` · footer.
- Tokens: `--bg/--panel/--fg/--muted/--accent/--border/--gold`, `--mono/--sans/--serif`.
- 15 content tests assert copy, themes, serif, licenses, chart IDs.

**Reader + Translator**: same warm cream/dark brand, shared `neoos.theme`.

**What's missing** (the three asks):
1. A geometric display font + the leo-lang "modern tech" styling pass.
2. The **pastel feature-pillar row** (Image #11): 4 squircle pastel icon tiles +
   two-line uppercase labels.
3. The **"Explore our tools" card grid** (Image #12): dark, two columns of
   colored-border cards with wordmarks, one-liners, and corner action icons.

## North Star

A visitor lands on openneo.org and immediately reads it as a **serious, modern,
open protocol** — a striking geometric hero, four pastel pillars they grasp at a
glance, and a tools grid that lets a developer jump straight into the Reader,
Translator, Cite SDK, CLI, relay, or payout runner — all in OpenNeo's own voice,
not a clone of someone else's brand.

## Milestones

### M1 — Design tokens & the "tech" type system
- **Goal:** Establish the geometric display font + the palette/spacing tokens the
  new sections need, and decide how they relate to the existing cream/dark themes.
- **Deliverables:**
  - [ ] Add an **open-licensed geometric display font** for headings (candidates:
        Space Grotesk, Chivo, or Hanken Grotesk — self-hosted `.woff2`, **not**
        Aleo's proprietary face). New token `--display`.
  - [ ] Body stays sans; `--serif` retained only if OQ-1 keeps warm surfaces.
  - [ ] Palette decision per OQ-1: either (a) a new dark "tech" theme, or (b) a
        third theme alongside cream/dark, or (c) restyle within existing dark.
  - [ ] Pastel accent tokens: `--p-yellow`, `--p-green`, `--p-lilac`, `--p-peach`
        (soft tints for the pillar tiles; per-card border accents for the grid).
  - [ ] Spacing/grid tokens for the wider, more spacious leo-lang rhythm.
- **CE Principle:** One token layer both new sections (and any future page) draw
  from — no per-section hardcoded colors/fonts to drift.
- **Key pitfalls:** Hotlinking or embedding the reference sites' proprietary font
  (license risk) — must use an open face. Font `.woff2` bloating the static
  bundle — subset + `font-display: swap`.
- **Definition of Done:** `pnpm --filter @neoark/landing build` OK; font loads
  from local asset (no external CDN to a proprietary font); tokens visible in a
  throwaway swatch.

### M2 — Pastel feature-pillar row (Image #11)
- **Goal:** Four pastel squircle icon tiles + two-line uppercase labels, OpenNeo's
  four pillars.
- **Deliverables:**
  - [ ] Section markup: responsive 4-across row (2×2 on mobile), optional faint
        grid background like the reference.
  - [ ] Four **original** geometric SVG glyphs (black on pastel) — NOT the Aleo
        diamond. Proposed: hash/cube, chain-link/anchor, lightning bolt, eye/check.
  - [ ] Pillar copy (proposed, maps to the reference's 4 slots):
        `CONTENT-ADDRESSED` (yellow) · `BITCOIN-ANCHORED` (green) ·
        `LIGHTNING-PAID` (lilac) · `OPEN & VERIFIABLE` (peach).
  - [ ] `.squircle` tile style (border-radius ~28%, pastel bg, centered glyph).
  - [ ] Content test asserting the four labels + section presence.
- **CE Principle:** A reusable `.pillar`/`.squircle` component + an icon set the
  Reader/Translator can reuse.
- **Key pitfalls:** Pastel-on-light contrast for the *label text* (labels are
  dark on page bg, fine; but ensure the tiles read in dark theme too). Icons must
  be original, not traced from Aleo's marks.
- **Definition of Done:** row renders in both themes; `pnpm --filter @neoark/landing test` green; a11y contrast ≥ 4.5:1 on labels.

### M3 — "Explore our tools" card grid (Image #12)
- **Goal:** The two-column colored-border card grid, mapped to OpenNeo's **real**
  tools.
- **Deliverables:**
  - [ ] Eyebrow (e.g. `OPEN TOOLS FOR EVERY NEED`) + big display heading
        (e.g. `Explore the OpenNeo stack`).
  - [ ] Card grid, two columns, stacked cards each with: dark panel, rounded
        corners, **per-card colored 1px border**, an OpenNeo wordmark in a tinted
        gradient, a one-line description, and a **corner action icon** (arrow-out
        for internal links, GitHub mark for repos).
  - [ ] Cards map to shipped tools (no vaporware):
        **Reader** (/read) · **Translator** (/translate) · **Cite SDK**
        `@neoark/cite` (GitHub) · **Reader CLI** `@neoark/reader` (npm/GitHub) ·
        **Relay/Protocol** `@neoark/relay`+`manifest` (GitHub) · **Payout Runner**
        `@neoark/payout-runner` (GitHub).
  - [ ] Optional subtle dotted background — **original**, not the reference's globe.
  - [ ] Content test asserting the tool names + links resolve to real routes/repos.
- **CE Principle:** A tool registry (name, blurb, href, accent, icon) drives the
  grid — adding a future tool = one array entry.
- **Key pitfalls:** Claiming tools that aren't real (violates the "everything on
  the landing is real" rule from prior work) — every card links to a live route or
  an actual package. Corner GitHub icon only where a public repo exists.
- **Definition of Done:** grid renders responsively; every href is a real
  destination; tests green; build OK.

### M4 — Hero + nav "leo-lang" styling pass
- **Goal:** Bring the hero/nav in line with the reference's spacious geometric feel.
- **Deliverables:**
  - [ ] Hero heading in `--display`, larger scale, reference spacing.
  - [ ] Nav/CTA/button restyle to match; keep the theme toggle.
  - [ ] Reconcile the serif OpenNeo logo with the new type per OQ-1 (keep serif
        wordmark, or move to the geometric wordmark — affects Reader/Translator
        logo parity).
- **CE Principle:** Hero + nav become the canonical example of the token system.
- **Key pitfalls:** Breaking existing content tests (h1 text, chip, logo). Update
  tests intentionally, not by loosening assertions to nothing.
- **Definition of Done:** hero matches the intended look in both themes; all
  content tests updated + green.

### M5 — Integrate, verify, ship
- **Goal:** Section order, responsive/a11y polish, full gate, deploy.
- **Deliverables:**
  - [ ] Final section order (where do pillars + tools grid sit relative to
        `#features`/`#protocol`? Likely: hero → pillars → tools grid → protocol →
        stats → donate; possibly retire the old 6-card `#features`).
  - [ ] Mobile breakpoints for pillar row + card grid.
  - [ ] Contrast audit in both themes; keyboard focus states.
  - [ ] One PR (or a small stack M2/M3/M4), green CI, merge, verify live.
- **Definition of Done:** `pnpm --filter @neoark/landing test && pnpm --filter @neoark/landing build && pnpm lint` all green; CI green **before** merge; deployed and visually confirmed.

### M6 — Custom "N" lettermark + Brand page (added on request)
- **Goal:** An original geometric "N" mark for the *Neo* in the wordmark, and a
  `/brand` page documenting the identity (à la aleo.org/brand).
- **Deliverables:**
  - [ ] Original SVG **N lettermark** — geometric N with a small checker/notch
        accent (inspired by the general lettermark motif; **not** a copy of Aleo's
        trademarked "A" glyph). Used inline in the landing wordmark + as favicon/
        monogram.
  - [ ] `apps/landing/brand.html` (served at `/brand`): logo + N monogram, the
        wordmark, clear-space, color palette (theme + pastel tokens with hex),
        typography (Space Grotesk / serif / mono), do's & don'ts. All original.
  - [ ] Landing-only (Reader untouched → wordmark may diverge from Reader's serif).
- **Definition of Done:** `/brand` builds + renders in both themes; wordmark N
  renders crisp at nav size; tests green.

## Open Questions

| # | Question | Owner | Resolution Path |
|---|----------|-------|-----------------|
| **1** | ~~Replace warm brand, or new landing style only?~~ **RESOLVED (user):** "just change the homepage first and don't touch the reader." → Landing only gets the new aesthetic; **Reader stays warm/untouched**; Translator untouched too (out of scope this pass). | User | ✅ Settled. |
| 2 | Keep the serif OpenNeo wordmark, or switch the logo to the geometric display face? | User | Tie to OQ-1. If Reader stays warm, keeping the serif wordmark preserves cross-app logo parity (just fixed in #58). |
| 3 | Retire the existing 6-card `#features` section, or keep it below the new pillars + tools grid? | User | Recommend folding its content into the 4 pillars + tools grid to avoid redundancy; confirm on review. |
| 4 | Exact pillar labels + which glyph per pillar. | User/me | Proposed set in M2; adjust wording on review. |
| 5 | Which font (Space Grotesk vs Chivo vs Hanken Grotesk)? | User/me | I'll mock the hero in 1–2 and pick; all open-licensed. |
| 6 | Keep light/cream theme available on the landing at all, or dark-only like the references? | User | Recommend keeping the toggle (accessibility + brand consistency); the pastel tiles are designed to work in both. |

## Architectural Non-Negotiables

- **No third-party brand reproduction.** No Aleo/Leo logo marks, product names,
  proprietary fonts, illustrations, or copy. All glyphs, wordmarks, icons, and
  text are original OpenNeo assets. Design *patterns* (grids, pastel tiles, card
  structure) are fine; brand *assets* are not.
- **Everything on the landing stays real** (the standing rule): every tool card
  links to a live route or an actual shipped package; no claimed-but-unbuilt tools.
- **Token-driven, single source.** Colors/fonts/spacing come from CSS variables in
  one place; no per-section hardcoding.
- **Themeable + accessible.** Works in whatever themes OQ-1/OQ-6 settle on;
  label/text contrast ≥ 4.5:1; visible keyboard focus.
- **Gate stays green.** Content tests updated (not gutted); `pnpm lint` +
  `build` clean; **CI green before merge** (per the #59 lesson — branch protection
  isn't enforcing this yet).
- **Self-hosted fonts**, subset, `font-display: swap` — no external proprietary CDN.

## CE Feedback Loops

- **Content tests** (`test/content.test.ts`) pin the new copy (pillar labels, tool
  names, section presence) so regressions surface in CI.
- **Token layer** = the shared fixture every section reuses; new pages inherit it.
- **Tool registry array** drives the grid — future tools are one entry, tested.
- **ADR** at repo `docs/decisions/` recording the aesthetic direction + the
  reference-vs-reproduction boundary, so the decision isn't re-litigated.
- **Live visual check** post-deploy each PR.

## What to Do First

1. **Resolve OQ-1** (replace vs. dual-brand) — everything downstream depends on it.
2. Confirm OQ-3 (fate of `#features`), OQ-4 (pillar labels/glyphs), OQ-6 (keep toggle).
3. M1: land the display font + tokens behind the chosen theme decision.
4. M2 then M3 (independent; can parallelize), then M4, then M5 integrate + ship.

---
*Update this file when decisions change.*
