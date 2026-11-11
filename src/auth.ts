import { sign } from 'hono/jwt'

export interface AuthEnv {
  SECRET_KEY: string
  ALGORITHM: string
  ACCESS_TOKEN_EXPIRE_MINUTES: string
}

const PBKDF2_ITERATIONS = 100_000
const KEY_LENGTH_BITS = 256
const SALT_LENGTH_BYTES = 16
const HASH_PREFIX = 'pbkdf2-sha256'
const encoder = new TextEncoder()

export const DUMMY_PASSWORD_HASH =
  'pbkdf2-sha256$100000$Q0RFxx6bSCTg7h2Aa311DQ==$pkJOGZeicicITtSVZcHfmk/AxvbKowUS4tAoOjCAjpE='

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function deriveKeyBits(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    KEY_LENGTH_BITS,
  )
  return new Uint8Array(bits)
}

export async function getPasswordHash(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH_BYTES))
  const bits = await deriveKeyBits(password, salt, PBKDF2_ITERATIONS)
  return [HASH_PREFIX, PBKDF2_ITERATIONS, toBase64(salt), toBase64(bits)].join('$')
}

export async function verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
  const parts = hashedPassword.split('$')
  if (parts.length !== 4 || parts[0] !== HASH_PREFIX) return false
  const iterations = Number(parts[1])
  if (!Number.isInteger(iterations) || iterations < 1) return false
  const salt = fromBase64(parts[2])
  const expected = fromBase64(parts[3])
  const actual = await deriveKeyBits(plainPassword, salt, iterations)
  if (actual.length !== expected.length) return false
  let difference = 0
  for (let i = 0; i < expected.length; i++) difference |= actual[i] ^ expected[i]
  return difference === 0
}

export async function createAccessToken(
  env: AuthEnv,
  data: Record<string, unknown>,
  expiresDeltaSeconds?: number,
): Promise<string> {
  const expire =
    Math.floor(Date.now() / 1000) +
    (expiresDeltaSeconds ?? Number(env.ACCESS_TOKEN_EXPIRE_MINUTES) * 60)
  return sign({ ...data, exp: expire }, env.SECRET_KEY, env.ALGORITHM as 'HS256')
}
