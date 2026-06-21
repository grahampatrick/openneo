import { describe, it, expect } from 'vitest'
import { canonicalJson } from '../src/canonical'

describe('canonicalJson', () => {
  it('sorts object keys regardless of insertion order', () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}')
    expect(canonicalJson({ a: 2, b: 1 })).toBe(canonicalJson({ b: 1, a: 2 }))
  })

  it('sorts nested object keys recursively', () => {
    expect(canonicalJson({ z: { y: 1, x: 2 } })).toBe('{"z":{"x":2,"y":1}}')
  })

  it('preserves array order', () => {
    expect(canonicalJson([3, 1, 2])).toBe('[3,1,2]')
  })

  it('handles primitives and null', () => {
    expect(canonicalJson(null)).toBe('null')
    expect(canonicalJson(true)).toBe('true')
    expect(canonicalJson(42)).toBe('42')
    expect(canonicalJson('hi')).toBe('"hi"')
  })

  it('escapes strings via JSON semantics', () => {
    expect(canonicalJson({ k: 'a"b' })).toBe('{"k":"a\\"b"}')
  })
})
