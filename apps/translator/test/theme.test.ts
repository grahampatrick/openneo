import { describe, it, expect, beforeEach, vi } from 'vitest'
import { theme, applyTheme, initialTheme } from '../src/lib/theme'

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    vi.unstubAllGlobals()
  })

  it('applyTheme sets data-theme and persists the choice', () => {
    applyTheme('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem('neoos.theme')).toBe('dark')
    applyTheme('cream')
    expect(document.documentElement.getAttribute('data-theme')).toBe('cream')
    expect(localStorage.getItem('neoos.theme')).toBe('cream')
  })

  it('initialTheme prefers a valid stored choice', () => {
    localStorage.setItem('neoos.theme', 'dark')
    expect(initialTheme()).toBe('dark')
    localStorage.setItem('neoos.theme', 'cream')
    expect(initialTheme()).toBe('cream')
  })

  it('initialTheme ignores a bad stored value and falls back to system, then cream', () => {
    localStorage.setItem('neoos.theme', 'nonsense')
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    expect(initialTheme()).toBe('dark')
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    expect(initialTheme()).toBe('cream')
  })

  it('exposes a theme store with a valid initial value', () => {
    let v: string | undefined
    const unsub = theme.subscribe((t) => (v = t))
    expect(v === 'cream' || v === 'dark').toBe(true)
    unsub()
  })
})
