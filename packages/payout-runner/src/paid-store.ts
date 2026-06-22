/**
 * Persistent paid-state stores for the runner. The in-memory one is for tests;
 * the file-backed one survives restarts so a crash never causes a double-pay.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { PaidStore } from '@neoark/payouts'

export class MemoryPaidStore implements PaidStore {
  private readonly set = new Set<string>()
  has(key: string): boolean {
    return this.set.has(key)
  }
  add(key: string): void {
    this.set.add(key)
  }
  remove(key: string): void {
    this.set.delete(key)
  }
}

/** A JSON-file-backed PaidStore (one key per paid (merge,recipient)). */
export class FilePaidStore implements PaidStore {
  private readonly set: Set<string>
  constructor(private readonly path: string) {
    this.set = existsSync(path) ? new Set(JSON.parse(readFileSync(path, 'utf8')) as string[]) : new Set()
  }
  private flush(): void {
    mkdirSync(dirname(this.path), { recursive: true })
    writeFileSync(this.path, JSON.stringify([...this.set]))
  }
  has(key: string): boolean {
    return this.set.has(key)
  }
  add(key: string): void {
    this.set.add(key)
    this.flush()
  }
  remove(key: string): void {
    this.set.delete(key)
    this.flush()
  }
}
