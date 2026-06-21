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

## Books 40–55 — Deuterocanon / Apocrypha

**Source:** KJV Apocrypha (1611) + other public-domain translations ·
**License:** Public domain · **Status:** ⏳ pending (drop USFM in `sources/raw/extra/`)

| # | Book | id | Source tag |
|---|---|---|---|
| 40 | Tobit | TOB | KJV-Apocrypha-PD |
| 41 | Judith | JDT | KJV-Apocrypha-PD |
| 42 | 1 Esdras | 1ES | KJV-Apocrypha-PD |
| 43 | 2 Esdras | 2ES | KJV-Apocrypha-PD |
| 44 | Wisdom of Solomon | WIS | KJV-Apocrypha-PD |
| 45 | Sirach | SIR | KJV-Apocrypha-PD |
| 46 | Baruch | BAR | KJV-Apocrypha-PD |
| 47 | Letter of Jeremiah | LJE | KJV-Apocrypha-PD |
| 48 | Prayer of Azariah | S3Y | KJV-Apocrypha-PD |
| 49 | Susanna | SUS | KJV-Apocrypha-PD |
| 50 | Bel and the Dragon | BEL | KJV-Apocrypha-PD |
| 51 | 1 Maccabees | 1MA | KJV-Apocrypha-PD |
| 52 | 2 Maccabees | 2MA | KJV-Apocrypha-PD |
| 53 | 3 Maccabees | 3MA | PD |
| 54 | 4 Maccabees | 4MA | PD |
| 55 | Prayer of Manasseh | MAN | KJV-Apocrypha-PD |

## Books 56–59 — Pseudepigrapha (Hebrew Scriptures era)

**License:** Public domain · **Status:** ⏳ pending

| # | Book | id | Source |
|---|---|---|---|
| 56 | 1 Enoch (Chanok) | ENO | R.H. Charles translation, 1913 (Oxford) — public domain |
| 57 | Jubilees (Yovheliym) | JUB | R.H. Charles translation, 1913 (Oxford) — public domain |
| 58 | Jasher (Sefer haYashar) | JSR | J.H. Parry & Co. 1887 edition — public domain |
| 59 | Psalm 151 | PSL | Public-domain translation |

## Books 60–86 — Renewed Covenant (Brit Chadashah)

**Source:** Berean Standard Bible (BSB) · **License:** Public-domain dedication ·
**Status:** ✅ ingested

Matthew · Mark · Luke · John · Acts · Romans · 1–2 Corinthians · Galatians ·
Ephesians · Philippians · Colossians · 1–2 Thessalonians · 1–2 Timothy · Titus ·
Philemon · Hebrews · James · 1–2 Peter · 1–3 John · Jude · Revelation

## Book 87 — 2 Baruch

**Source:** R.H. Charles translation, 1913 · **License:** Public domain ·
**Status:** ⏳ pending

---

## Current corpus

| Metric | Value |
|---|---|
| Books ingested | 66 / 87 (all 66 BSB canonical) |
| Verses ingested | 31,086 |
| Naming map | `neoos-naming-1` |
| Hash algorithm | BLAKE3 (verse → chapter → book → canon root) |
| Translation id | `neoos-en-2026` |

The 21 deuterocanonical / pseudepigraphal books are wired into the canon
(`book-order.json`), the importer registry (`src/parse-extra.ts`), and the USFM
parser. They ingest automatically once their public-domain USFM files are placed
in `tools/importer/sources/raw/extra/`. The build, hashes, and DoD do not depend
on them being present.

---

*Generated for translation `neoos-en-2026`. Update when sources change.*
