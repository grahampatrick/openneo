/**
 * Secret storage for the NWC connection URI.
 *
 * The production CLI stores it in the OS keychain (keytar); here we abstract a
 * `SecretStore` so the engine is testable, with a file-backed default (0600)
 * and an in-memory store for tests. See ADR-007.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export interface SecretStore {
  get(key: string): string | undefined
  set(key: string, value: string): void
  delete(key: string): void
}

export class MemorySecretStore implements SecretStore {
  private readonly map = new Map<string, string>()
  get(key: string): string | undefined {
    return this.map.get(key)
  }
  set(key: string, value: string): void {
    this.map.set(key, value)
  }
  delete(key: string): void {
    this.map.delete(key)
  }
}

/** JSON file with 0600 perms. A simple fallback when no OS keychain is wired. */
export class FileSecretStore implements SecretStore {
  constructor(private readonly path: string) {}
  private read(): Record<string, string> {
    if (!existsSync(this.path)) return {}
    return JSON.parse(readFileSync(this.path, 'utf8')) as Record<string, string>
  }
  private write(data: Record<string, string>): void {
    mkdirSync(dirname(this.path), { recursive: true })
    writeFileSync(this.path, JSON.stringify(data, null, 2), { mode: 0o600 })
  }
  get(key: string): string | undefined {
    return this.read()[key]
  }
  set(key: string, value: string): void {
    const data = this.read()
    data[key] = value
    this.write(data)
  }
  delete(key: string): void {
    const { [key]: _removed, ...rest } = this.read()
    this.write(rest)
  }
}

export const NWC_KEY = 'nwc-uri'
