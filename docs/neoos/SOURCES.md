<!--
SPDX-License-Identifier: CC-BY-SA-4.0
NeoOS corpus — per-book source attribution.
-->

# NeoOS — Per-Book Source Attribution

Every book in the NeoOS corpus, its source text, and its license. This is the
granular companion to [`docs/legal/SOURCES.md`](../legal/SOURCES.md) (the
project-level license summary). It is generated against
[`data/neoos/book-order.json`](../../data/neoos/book-order.json) and the
importer's source registry.

> **Required attribution (every distribution):**
> *"Based on the Berean Standard Bible (BSB), berean.bible — dedicated to the
> public domain. NeoOS translation text is licensed CC-BY-SA 4.0."*

---

## Source acquisition policy

- **No third-party Bible APIs.** Source texts are pulled from first-party /
  canonical public-domain sources only and cached in
  `tools/importer/sources/raw/` for reproducible builds.
- **BSB** is fetched directly from `https://bereanbible.com/bsb.txt`
  (`pnpm --filter @neoark/importer run fetch`).
- **Apocrypha / pseudepigrapha** are added as USFM files under
  `tools/importer/sources/raw/extra/<BOOKID>.usfm`. They are public domain; see
  per-book rows below.

---

## Status legend

| Status | Meaning |
|---|---|
| ✅ ingested | Text present in `verses.jsonl` |
| ⏳ pending | Book declared in canon + importer registry; source USFM not yet placed |

---

## Books 1–39 — Hebrew Scriptures (Tanakh)

**Source:** Berean Standard Bible (BSB) · **License:** Public-domain dedication
(berean.bible) · **Status:** ✅ ingested

Genesis · Exodus · Leviticus · Numbers · Deuteronomy · Joshua · Judges · Ruth ·
1–2 Samuel · 1–2 Kings · 1–2 Chronicles · Ezra · Nehemiah · Esther · Job ·
Psalms · Proverbs · Ecclesiastes · Song of Solomon · Isaiah · Jeremiah ·
Lamentations · Ezekiel · Daniel · Hosea · Joel · Amos · Obadiah · Jonah · Micah ·
Nahum · Habakkuk · Zephaniah · Haggai · Zechariah · Malachi

## Books 40–55 — Deuterocanon / Apocrypha — ✅ ingested

**Sources (first-party static USFM from eBible.org, cached in `sources/raw/extra/`,
no third-party Bible APIs):**
- **`KJV-CPB-PD`** — King James Version, **Cambridge Paragraph Bible** (F.H.A.
  Scrivener), eBible.org `engkjvcpb`. Public Domain (KJV is PD in the US).
- **`LXX2012-PD`** — the **2012 LXX** translation, eBible.org `eng-lxx2012`.
  Public Domain. Used for Baruch + the Letter of Jeremiah (cleanly separated) and
  3–4 Maccabees, which the KJV lacks.

| # | Book | id | Source tag |
|---|---|---|---|
| 40 | Tobit | TOB | KJV-CPB-PD |
| 41 | Judith | JDT | KJV-CPB-PD |
| 42 | 1 Esdras | 1ES | KJV-CPB-PD |
| 43 | 2 Esdras | 2ES | KJV-CPB-PD |
| 44 | Wisdom of Solomon | WIS | KJV-CPB-PD |
| 45 | Sirach | SIR | KJV-CPB-PD |
| 46 | Baruch | BAR | LXX2012-PD |
| 47 | Letter of Jeremiah | LJE | LXX2012-PD |
| 48 | Prayer of Azariah | S3Y | KJV-CPB-PD |
| 49 | Susanna | SUS | KJV-CPB-PD |
| 50 | Bel and the Dragon | BEL | KJV-CPB-PD |
| 51 | 1 Maccabees | 1MA | KJV-CPB-PD |
| 52 | 2 Maccabees | 2MA | KJV-CPB-PD |
| 53 | 3 Maccabees | 3MA | LXX2012-PD |
| 54 | 4 Maccabees | 4MA | LXX2012-PD |
| 55 | Prayer of Manasseh | MAN | KJV-CPB-PD |

## Books 56–59 — Pseudepigrapha (Hebrew Scriptures era)

| # | Book | id | Source | Status |
|---|---|---|---|---|
| 56 | 1 Enoch (Chanok) | ENO | R.H. Charles translation, 1913 (Oxford) — public domain | ⏳ pending |
| 57 | Jubilees (Yovheliym) | JUB | R.H. Charles translation, 1913 (Oxford) — public domain | ⏳ pending |
| 58 | Jasher (Sefer haYashar) | JSR | J.H. Parry & Co. 1887 edition — public domain | ⏳ pending |
| 59 | Psalm 151 | PSL | 2012 LXX (eBible.org `eng-lxx2012`), Public Domain | ✅ ingested |

**Pending note:** Enoch, Jubilees, Jasher, and 2 Baruch (below) exist only as
prose transcriptions of 1887/1913 public-domain translations (no USFM). They need
careful verse-segmentation parsing and are a focused follow-up; the importer
registry + parser already reserve their book ids, so they ingest the moment clean
text is placed in `sources/raw/extra/`.

## Books 60–86 — Renewed Covenant (Brit Chadashah)

**Source:** Berean Standard Bible (BSB) · **License:** Public-domain dedication ·
**Status:** ✅ ingested

Matthew · Mark · Luke · John · Acts · Romans · 1–2 Corinthians · Galatians ·
Ephesians · Philippians · Colossians · 1–2 Thessalonians · 1–2 Timothy · Titus ·
Philemon · Hebrews · James · 1–2 Peter · 1–3 John · Jude · Revelation

## Book 87 — 2 Baruch

**Source:** R.H. Charles translation, 1913 · **License:** Public domain ·
**Status:** ⏳ pending (see pseudepigrapha note above)

---

## Current corpus

| Metric | Value |
|---|---|
| Books ingested | **83 / 87** |
| Verses ingested | **37,419** |
| Naming map | `neoos-naming-1` (applied to all books) |
| Hash algorithm | BLAKE3 (verse → chapter → book → canon root) |
| Translation id | `neoos-en-2026` |

Ingested: 66 BSB canonical + 17 deuterocanonical/apocryphal books (16 KJV-CPB /
LXX2012 + Psalm 151). The 4 remaining pseudepigrapha (1 Enoch, Jubilees, Jasher,
2 Baruch) are wired into the canon (`book-order.json`), the importer registry
(`src/parse-extra.ts`), and the parser; they ingest automatically once their
public-domain text is placed in `tools/importer/sources/raw/extra/`.

---

*Generated for translation `neoos-en-2026`. Update when sources change.*
