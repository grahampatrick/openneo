import { describe, it, expect, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MemoryPaidStore, FilePaidStore } from '../src/paid-store'

describe('MemoryPaidStore', () => {
  it('adds, checks, and removes keys', () => {
    const s = new MemoryPaidStore()
    expect(s.has('k')).toBe(false)
    s.add('k')
    expect(s.has('k')).toBe(true)
    s.remove('k')
    expect(s.has('k')).toBe(false)
  })
})

describe('FilePaidStore', () => {
  const dirs: string[] = []
  afterEach(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true })
    dirs.length = 0
  })

  it('persists across instances (restart-safe)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'neoark-paid-'))
    dirs.push(dir)
    const path = join(dir, 'nested', 'paid.json')
    const a = new FilePaidStore(path)
    a.add('merge1:recipientA')
    // a fresh instance over the same file sees it (simulated restart)
    const b = new FilePaidStore(path)
    expect(b.has('merge1:recipientA')).toBe(true)
    b.remove('merge1:recipientA')
    expect(new FilePaidStore(path).has('merge1:recipientA')).toBe(false)
  })
})
