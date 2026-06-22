/**
 * Word-level diff for the proposal "before vs after" view. A small LCS over
 * whitespace-split tokens — enough to highlight what changed in a verse.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
export type DiffOp = 'equal' | 'add' | 'remove'
export interface DiffToken {
  op: DiffOp
  text: string
}

function tokenize(s: string): string[] {
  return s.split(/(\s+)/).filter((t) => t.length > 0)
}

/** Longest-common-subsequence word diff of `before` → `after`. */
export function wordDiff(before: string, after: string): DiffToken[] {
  const a = tokenize(before)
  const b = tokenize(after)
  const n = a.length
  const m = b.length

  // LCS length table.
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!)
    }
  }

  const out: DiffToken[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ op: 'equal', text: a[i]! })
      i++
      j++
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      out.push({ op: 'remove', text: a[i]! })
      i++
    } else {
      out.push({ op: 'add', text: b[j]! })
      j++
    }
  }
  while (i < n) out.push({ op: 'remove', text: a[i++]! })
  while (j < m) out.push({ op: 'add', text: b[j++]! })
  return out
}

/** True if the two texts differ (after trimming). */
export function hasChange(before: string, after: string): boolean {
  return before.trim() !== after.trim()
}
