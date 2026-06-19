# ADR-002: License Strategy

**Date:** 2026-06-17
**Status:** Accepted

## Decision

| Layer | License |
|---|---|
| Protocol software (packages, apps, tools) | AGPL-3.0 |
| NeoOS translation text | CC-BY-SA 4.0 |
| Spec documents | CC-BY-SA 4.0 |

## Rationale

- **AGPL-3.0** for software: ensures that any hosted derivative (e.g. someone running a modified NeoArk relay) must publish their source. Aligns with the Odysseus upstream (also AGPL-3.0).
- **CC-BY-SA 4.0** for text: allows free use, remixing, and embedding in any app while requiring attribution and share-alike. No gatekeeper. Fork-friendly.
- **BSB compliance:** The Berean Standard Bible (base text for 66 books) is CC-BY 4.0. NeoOS is a derivative work — CC-BY-SA 4.0 is compatible (more restrictive share-alike satisfies BY attribution requirement). Every distribution must credit: *"Based on the Berean Standard Bible, © Bible Hub, used under CC-BY 4.0."*

## What We Cannot License Away

- The BSB attribution requirement is non-waivable. `docs/legal/SOURCES.md` is CI-gated.
- The Cepher Bible text is NOT used — commercially copyrighted. Only naming conventions (not copyrightable) and book ordering (not copyrightable) are inspired by it.

## Consequences

- License header required in every `.ts` source file: `// SPDX-License-Identifier: AGPL-3.0`
- `docs/legal/SOURCES.md` must be complete and CI checks for its existence
- Every package `README.md` must state the license
