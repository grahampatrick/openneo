<!--
SPDX-License-Identifier: CC-BY-SA-4.0
-->

# NeoOS — Hebrew Naming Conventions

The NeoOS translation restores Hebrew transliterations of divine names, key
figures, places, and appointed times, and applies a small set of accuracy-first
term corrections. These are **transliterations and organizational choices, not
copyrightable prose** (see [`docs/legal/SOURCES.md`](../legal/SOURCES.md)).

The machine-readable map lives at
[`data/neoos/naming-map.json`](../../data/neoos/naming-map.json) (version
`neoos-naming-1`). The importer applies it deterministically; every applied
rule and every deliberately-skipped rule is recorded in the generated audit
trail [`data/neoos/accuracy-corrections.json`](../../data/neoos/accuracy-corrections.json).

## How the engine applies the map

Implemented in [`tools/importer/src/naming.ts`](../../tools/importer/src/naming.ts):

1. **Longest match wins.** `"Jesus Christ" → "Yahusha HaMashiach"` is applied
   before `"Jesus" → "Yahusha"`; `"LORD God" → "Yahuah Elohiym"` before `"LORD"`.
2. **Case-sensitive.** All-caps `LORD` (the Tetragrammaton in BSB) → `Yahuah`;
   title-case `Lord` → `Adonai`; lowercase `god` (pagan) is left untouched.
3. **Single pass.** A replacement's output is never re-scanned, so
   `"LORD God" → "Yahuah Elohiym"` does not cascade further.
4. **Word-boundary anchored.** Substrings inside other words are never rewritten
   (`Godhead` stays `Godhead`).
5. **Article agreement.** When a substitution changes the following word's
   initial sound, a preceding `a`/`an` is corrected
   (`"an expanse" → "a firmament"`).

## Categories

| Category | Examples |
|---|---|
| Divine names | LORD→Yahuah, Jesus→Yahusha, God→Elohiym, Holy Spirit→Ruach HaQodesh |
| People | Moses→Mosheh, Isaac→Yitschaq, Jacob→Ya'aqov, David→Dauid, Paul→Sha'ul |
| Places | Jerusalem→Yerushalayim, Egypt→Mitsrayim, Zion→Tsiyon |
| Accuracy terms | expanse→firmament, angel→messenger, church→assembly |
| Appointed times | Passover→Pecach, Pentecost→Shavu'oth, Sabbath→Shabbath |

## Rules NOT auto-applied (and why)

Some entries require human/context judgement and are **recorded as skipped**, not
applied, so the audit trail is honest:

| Reason | Example | Why skipped |
|---|---|---|
| context-dependent | `hell → CONTEXT_DEPENDENT` | Must resolve to Sheol / Hades / Gehenna / Tartarus by passage — a future per-verse correction, not a blind find/replace. |
| ambiguous dual form | `baptize → "immerse / immersion"` | Noun/verb choice needs per-occurrence judgement. |
| identity (retain) | `Sheol → Sheol` | A "keep the Hebrew" marker, not a substitution. |
| metadata-only | `Old Testament → Tanakh` | Applies to headings/metadata, never verse text. |

These are the seeds of the community accuracy-correction process (M4/M5): each
becomes a per-verse `kind:30702` revision proposal with a rationale and source
reference, rather than a global rewrite.

## Marquee accuracy corrections

| Reference | Change | Rationale |
|---|---|---|
| Genesis 1:6–20 | expanse → **firmament** | Hebrew *raqia* = a beaten/stretched solid surface; "expanse" is a modern softening. |
| Isaiah 14:12 | (BSB reads "day star"; "Lucifer"→**Heylel** rule stands ready) | *Heylel* = shining one; "Lucifer" is a Latin mistranslation. |

> Note: BSB Isaiah 14:12 already renders "day star, son of the dawn" rather than
> "Lucifer," so no substitution fires there — the rule exists to catch sources
> that do use "Lucifer."

---

*Naming map version: `neoos-naming-1`. Changes go through the community
translation protocol once it lands (M5).*
