import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const DEFAULT_CACHE_DIR = path.resolve(process.cwd(), '.cache', 'tts')

export function ttsCacheKey(parts: {
  provider: string
  text: string
  voice?: string
  language?: string
  model?: string
}): string {
  const payload = JSON.stringify({
    provider: parts.provider,
    text: parts.text.trim(),
    voice: parts.voice ?? '',
    language: parts.language ?? 'ja',
    model: parts.model ?? '',
  })
  return createHash('sha256').update(payload).digest('hex')
}

export function ttsCacheDir(): string {
  return process.env.TTS_CACHE_DIR?.trim() || DEFAULT_CACHE_DIR
}

export async function readTtsCache(
  key: string,
  extension: string,
): Promise<{ audio: Buffer; contentType: string } | null> {
  const filePath = path.join(ttsCacheDir(), `${key}.${extension}`)
  try {
    const audio = await readFile(filePath)
    return { audio, contentType: contentTypeForExtension(extension) }
  } catch {
    return null
  }
}

export async function writeTtsCache(
  key: string,
  extension: string,
  audio: Buffer,
): Promise<void> {
  const dir = ttsCacheDir()
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, `${key}.${extension}`), audio)
}

function contentTypeForExtension(extension: string): string {
  switch (extension) {
    case 'mp3':
      return 'audio/mpeg'
    case 'ogg':
      return 'audio/ogg'
    case 'wav':
    default:
      return 'audio/wav'
  }
}
