export interface LockedTextbookPack {
  version: 1
  title: string
  createdAt: string
  kdf: 'PBKDF2-SHA256'
  iterations: number
  salt: string
  iv: string
  ciphertext: string
}

export interface UnlockedTextbookPack<T = unknown> {
  title: string
  createdAt: string
  payload: T
}

const ENCODER = new TextEncoder()
const DECODER = new TextDecoder()

export async function unlockTextbookPack<T = unknown>(
  pack: LockedTextbookPack,
  passphrase: string
): Promise<UnlockedTextbookPack<T>> {
  validatePack(pack)
  const salt = decodeBase64(pack.salt)
  const iv = decodeBase64(pack.iv)
  const ciphertext = decodeBase64(pack.ciphertext)
  const key = await deriveKey(passphrase, salt, pack.iterations)
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  )
  return {
    title: pack.title,
    createdAt: pack.createdAt,
    payload: JSON.parse(DECODER.decode(plaintext)) as T,
  }
}

export async function createLockedTextbookPack<T>(
  title: string,
  payload: T,
  passphrase: string,
  iterations = 210_000
): Promise<LockedTextbookPack> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(passphrase, salt, iterations)
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    ENCODER.encode(JSON.stringify(payload))
  )
  return {
    version: 1,
    title,
    createdAt: new Date().toISOString(),
    kdf: 'PBKDF2-SHA256',
    iterations,
    salt: encodeBase64(salt),
    iv: encodeBase64(iv),
    ciphertext: encodeBase64(new Uint8Array(ciphertext)),
  }
}

function validatePack(pack: LockedTextbookPack) {
  if (pack.version !== 1) throw new Error('Unsupported textbook pack version')
  if (pack.kdf !== 'PBKDF2-SHA256') throw new Error('Unsupported textbook pack key derivation')
  if (!pack.salt || !pack.iv || !pack.ciphertext) throw new Error('Textbook pack is missing encryption fields')
  if (!Number.isFinite(pack.iterations) || pack.iterations < 100_000) throw new Error('Textbook pack KDF is too weak or invalid')
}

async function deriveKey(passphrase: string, salt: BufferSource, iterations: number) {
  if (!passphrase.trim()) throw new Error('Passphrase is required')
  const baseKey = await crypto.subtle.importKey(
    'raw',
    ENCODER.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

function decodeBase64(value: string): ArrayBuffer {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.slice().buffer
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}
