#!/usr/bin/env tsx
/**
 * build-encrypted-packs.ts
 *
 * Reads canonical proof JSON files from tools/textbook-pack/out/canonical-proofs/
 * and produces AES-GCM encrypted .kiroku-pack files in public/packs/.
 *
 * Usage:
 *   npx tsx tools/build-encrypted-packs.ts
 *
 * Passphrases are loaded from PACK_PASSPHRASES in tools/pack-passphrases.local.json
 * (not committed to git). If a passphrase is not provided for a textbook, that
 * pack is skipped and a warning is printed.
 *
 * The pack-passphrases.local.json format:
 *   {
 *     "genki_1": "your-passphrase-here",
 *     "genki_2": "your-passphrase-here",
 *     ...
 *   }
 *
 * Alternatively, set env vars: PACK_PASSPHRASE_GENKI_1, PACK_PASSPHRASE_GENKI_2, etc.
 * (key uppercased and hyphens → underscores)
 */

import { readFile, writeFile, mkdir, access } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { existsSync } from 'node:fs'

// ---------------------------------------------------------------------------
// Crypto helpers (mirrors textbookPackUnlock.ts but in Node)
// ---------------------------------------------------------------------------

interface LockedTextbookPack {
  version: 1
  title: string
  createdAt: string
  kdf: 'PBKDF2-SHA256'
  iterations: number
  salt: string
  iv: string
  ciphertext: string
}

const ENCODER = new TextEncoder()

function encodeBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64')
}

async function deriveKey(passphrase: string, salt: BufferSource, iterations: number): Promise<CryptoKey> {
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
    ['encrypt']
  )
}

async function createLockedPack<T>(
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

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const PROOFS_DIR = resolve('tools/textbook-pack/out/canonical-proofs')
const OUTPUT_DIR = resolve('public/packs')
const PASSPHRASES_FILE = resolve('tools/pack-passphrases.local.json')

interface ProofManifest {
  textbookKey: string
  title: string
  [key: string]: unknown
}

function envKeyForTextbook(textbookKey: string): string {
  return `PACK_PASSPHRASE_${textbookKey.toUpperCase().replace(/-/g, '_')}`
}

async function loadPassphrases(): Promise<Record<string, string>> {
  const passphrases: Record<string, string> = {}

  // Load from local JSON file if present
  if (existsSync(PASSPHRASES_FILE)) {
    const raw = await readFile(PASSPHRASES_FILE, 'utf8')
    const parsed = JSON.parse(raw) as Record<string, string>
    Object.assign(passphrases, parsed)
    console.log(`  Loaded passphrases from ${PASSPHRASES_FILE}`)
  }

  // Override/supplement from environment variables
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('PACK_PASSPHRASE_') && value) {
      const textbookKey = key.slice('PACK_PASSPHRASE_'.length).toLowerCase()
      passphrases[textbookKey] = value
    }
  }

  return passphrases
}

// Canonical proof files can be named <textbookKey>_all_lessons.json
// or <textbookKey>_pre_*.json (which we skip — they're partial proofs)
// We prefer <textbookKey>_all_lessons.json
async function findProofFiles(): Promise<{ textbookKey: string; filePath: string }[]> {
  const { readdir } = await import('node:fs/promises')
  let entries: string[]
  try {
    entries = await readdir(PROOFS_DIR)
  } catch {
    console.error(`Proofs directory not found: ${PROOFS_DIR}`)
    return []
  }

  // Only process _all_lessons files (full packs)
  const results: { textbookKey: string; filePath: string }[] = []
  for (const entry of entries) {
    const match = entry.match(/^(.+)_all_lessons\.json$/)
    if (match) {
      results.push({
        textbookKey: match[1],
        filePath: join(PROOFS_DIR, entry),
      })
    }
  }
  return results
}

async function main() {
  console.log('\n🔐  KirokuMichi — Encrypted Textbook Pack Builder\n')

  const passphrases = await loadPassphrases()
  const proofFiles = await findProofFiles()

  if (proofFiles.length === 0) {
    console.error('No *_all_lessons.json files found in', PROOFS_DIR)
    process.exit(1)
  }

  await mkdir(OUTPUT_DIR, { recursive: true })

  let built = 0
  let skipped = 0

  for (const { textbookKey, filePath } of proofFiles) {
    const passphrase = passphrases[textbookKey] ?? process.env[envKeyForTextbook(textbookKey)]

    if (!passphrase) {
      console.log(`  ⚠️  ${textbookKey}: no passphrase — skipped`)
      console.log(`       Set in pack-passphrases.local.json or env ${envKeyForTextbook(textbookKey)}`)
      skipped++
      continue
    }

    console.log(`  🔒  ${textbookKey}: encrypting…`)
    const raw = await readFile(filePath, 'utf8')
    const proof = JSON.parse(raw) as ProofManifest
    const title = proof.title ?? textbookKey

    const pack = await createLockedPack(title, proof, passphrase)
    const outputPath = join(OUTPUT_DIR, `${textbookKey}.kiroku-pack`)
    await writeFile(outputPath, JSON.stringify(pack, null, 2), 'utf8')

    const sizeKb = Math.round(Buffer.byteLength(JSON.stringify(pack)) / 1024)
    console.log(`  ✅  ${textbookKey} → public/packs/${textbookKey}.kiroku-pack (${sizeKb} KB)`)
    built++
  }

  console.log(`\n  Done: ${built} built, ${skipped} skipped\n`)

  if (built === 0 && proofFiles.length > 0) {
    console.log('💡  Quick start: create tools/pack-passphrases.local.json with content like:')
    console.log('    {')
    for (const { textbookKey } of proofFiles) {
      console.log(`      "${textbookKey}": "your-passphrase-here",`)
    }
    console.log('    }')
    console.log('    Then re-run: npx tsx tools/build-encrypted-packs.ts\n')
  }
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
