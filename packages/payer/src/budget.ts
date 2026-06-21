/**
 * Monthly budget tracking with a pluggable store.
 *
 * The CLI persists `BudgetState` to disk, the browser to IndexedDB; both
 * implement `BudgetStore`. `MemoryBudgetStore` is the in-memory default used by
 * tests and short-lived processes. The budget resets when the UTC month rolls
 * over.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import type { BudgetState, BudgetStore } from './types'

/** "YYYY-MM" for a Date (UTC). */
export function monthKey(date: Date): string {
  return `${String(date.getUTCFullYear())}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export function emptyState(month: string): BudgetState {
  return { monthKey: month, spentSats: 0, dustMsat: {} }
}

/** Reset the state if it belongs to a previous month. */
export function rollOver(state: BudgetState, month: string): BudgetState {
  return state.monthKey === month ? state : emptyState(month)
}

export class MemoryBudgetStore implements BudgetStore {
  private state: BudgetState
  constructor(initial?: BudgetState) {
    this.state = initial ?? emptyState(monthKey(new Date(0)))
  }
  load(): BudgetState {
    return this.state
  }
  save(state: BudgetState): void {
    this.state = state
  }
}
