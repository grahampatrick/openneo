/**
 * Minimal self-contained JWT (HS256). We implement it with @noble/hashes rather
 * than pulling a JWT library — the spec is small and this keeps the package free
 * of any auth/JWT vendor dependency (ADR-008).
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { hmac } from '@noble/hashes/hmac'
import { sha256 } from '@noble/hashes/sha2'
import { utf8ToBytes } from '@noble/hashes/utils'

function b64urlEncode(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function b64urlJson(value: unknown): string {
  return b64urlEncode(utf8ToBytes(JSON.stringify(value)))
}

function sign(signingInput: string, secret: string): string {
  return b64urlEncode(hmac(sha256, utf8ToBytes(secret), utf8ToBytes(signingInput)))
}

/** Constant-time string comparison (both already base64url, ASCII). */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** Sign a payload object into a compact JWT (HS256). */
export function signJwt(payload: Record<string, unknown>, secret: string): string {
  if (!secret) throw new Error('jwt: secret is required')
  const header = b64urlJson({ alg: 'HS256', typ: 'JWT' })
  const body = b64urlJson(payload)
  const signingInput = `${header}.${body}`
  return `${signingInput}.${sign(signingInput, secret)}`
}

export type JwtVerifyResult<T> = { ok: true; payload: T } | { ok: false; error: string }

/** Verify a JWT's signature, structure, and (if present) `exp`. */
export function verifyJwt<T>(
  token: string,
  secret: string,
  opts: { now?: number } = {},
): JwtVerifyResult<T & { exp?: number }> {
  const parts = token.split('.')
  if (parts.length !== 3) return { ok: false, error: 'malformed token' }
  const [header, body, sig] = parts as [string, string, string]
  const signingInput = `${header}.${body}`
  if (!timingSafeEqual(sig, sign(signingInput, secret))) {
    return { ok: false, error: 'signature does not verify' }
  }
  let payload: T & { exp?: number }
  try {
    const h = JSON.parse(new TextDecoder().decode(b64urlDecode(header))) as { alg?: string }
    if (h.alg !== 'HS256') return { ok: false, error: `unsupported alg ${String(h.alg)}` }
    payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body))) as T & { exp?: number }
  } catch {
    return { ok: false, error: 'invalid token encoding' }
  }
  const now = opts.now ?? Math.floor(Date.now() / 1000)
  if (typeof payload.exp === 'number' && now >= payload.exp) {
    return { ok: false, error: 'token expired' }
  }
  return { ok: true, payload }
}
