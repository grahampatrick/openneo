/**
 * Deterministic JSON canonicalization for signing.
 *
 * Object keys are emitted in sorted order, recursively, so the byte string a
 * signature covers is independent of property insertion order. Arrays keep
 * their order (it is semantically significant). This is a pragmatic subset of
 * RFC 8785 / JCS sufficient for AVM-1 manifests and UP-1 proofs, which contain
 * only JSON-safe strings, integers, booleans, null, arrays, and objects.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

type Json = string | number | boolean | null | Json[] | { [k: string]: Json }

function canon(value: Json): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canon).join(',') + ']'
  }
  const parts = Object.entries(value)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => JSON.stringify(k) + ':' + canon(v))
  return '{' + parts.join(',') + '}'
}

/** Canonical JSON string of a value (sorted object keys, recursively). */
export function canonicalJson(value: unknown): string {
  return canon(value as Json)
}
