import { describe, it, expect, afterEach } from 'vitest'
import { mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MemorySecretStore, FileSecretStore, NWC_KEY } from '../src/secret-store'

describe('MemorySecretStore', () => {
  it('gets, sets, and deletes', () => {
    const s = new MemorySecretStore()
    expect(s.get(NWC_KEY)).toBeUndefined()
    s.set(NWC_KEY, 'nostr+walletconnect://abc')
    expect(s.get(NWC_KEY)).toBe('nostr+walletconnect://abc')
    s.delete(NWC_KEY)
    expect(s.get(NWC_KEY)).toBeUndefined()
  })
})

describe('FileSecretStore', () => {
  const dirs: string[] = []
  afterEach(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true })
    dirs.length = 0
  })

  it('persists secrets to a 0600 file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'neoark-'))
    dirs.push(dir)
    const path = join(dir, 'nested', 'secrets.json')
    const store = new FileSecretStore(path)
    store.set(NWC_KEY, 'uri-1')
    expect(new FileSecretStore(path).get(NWC_KEY)).toBe('uri-1')
    expect(statSync(path).mode & 0o777).toBe(0o600)
    store.delete(NWC_KEY)
    expect(new FileSecretStore(path).get(NWC_KEY)).toBeUndefined()
  })

  it('returns undefined when the file does not exist', () => {
    expect(new FileSecretStore('/nonexistent/neoark/secrets.json').get(NWC_KEY)).toBeUndefined()
  })
})
