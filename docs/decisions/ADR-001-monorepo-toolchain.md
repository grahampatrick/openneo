# ADR-001: Monorepo Toolchain

**Date:** 2026-06-17
**Status:** Accepted

## Decision

- **Package manager:** `pnpm` workspaces — faster installs, strict dependency isolation, workspace protocol
- **Test runner:** `vitest` — native ESM, fast, compatible with TypeScript, shared config across packages
- **Linter:** `eslint` v9 flat config + `typescript-eslint` strict — type-aware linting catches real bugs
- **Formatter:** `prettier` — non-negotiable style consistency, no debates
- **TypeScript:** strict mode + `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess` — catches the class of bugs that crypto code cannot afford

## Alternatives Considered

- `npm`/`yarn` workspaces — rejected, pnpm has better isolation and performance
- `jest` — rejected, slower than vitest, ESM support is painful
- `bun` — considered, but pnpm+vitest is more stable for monorepo cross-package testing today

## Consequences

Every package must include a `test`, `typecheck`, and `build` script. CI enforces all three.
