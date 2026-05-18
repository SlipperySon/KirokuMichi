import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import type { TextbookAsset, TextbookAssetManifest } from '../../src/content/textbookAssetService'

interface CanonicalPack {
  textbookKey: string
  lessons?: Array<{
    id: string
    lessonNumber: number
    pageRange?: { start?: number; end?: number }
    title?: string
    sources?: unknown[]
    contentBlocks?: Array<PackAssetCarrier>
    exercises?: Array<PackAssetCarrier>
  }>
  sources?: Array<{ sourceId: string; role?: string }>
}

interface PackAssetCarrier {
  id: string
  title?: string
  text?: string
  label?: string
  prompt?: string
  type?: string
  imageFile?: string
  imageSourceRef?: SourceRef
  sourceRef?: SourceRef
}

interface SourceRef {
  sourceId?: string
  pageNumber?: number
  coordinates?: [number, number, number, number]
}

const PACK_ROOT = resolve(process.cwd(), 'tools/textbook-pack/out/reviewed-packs')
const PUBLIC_ASSET_ROOT = resolve(process.cwd(), 'data/generated/assets/textbook')
const MANIFEST_PATH = resolve(process.cwd(), 'data/generated/assets/textbook-assets.json')
const PUBLIC_PREFIX = '/data/generated/assets/textbook'
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp'])

function main() {
  const assets: TextbookAsset[] = []
  if (!existsSync(PACK_ROOT)) {
    writeManifest(assets)
    console.log(JSON.stringify({ generated: 0, reason: 'reviewed pack root is missing', manifestPath: manifestDisplayPath() }, null, 2))
    return
  }

  const packFiles = readdirSync(PACK_ROOT)
    .filter(file => file.endsWith('.json') && file !== 'fingerprints.json')
    .sort()

  for (const file of packFiles) {
    const packPath = join(PACK_ROOT, file)
    const pack = JSON.parse(readFileSync(packPath, 'utf8')) as CanonicalPack
    const lesson = pack.lessons?.[0]
    if (!lesson) continue

    const explicitAssets = collectExplicitAssets(pack, lesson, packPath)
    if (explicitAssets.length > 0) {
      assets.push(...explicitAssets)
      continue
    }

    assets.push(...collectLooseAssets(pack, lesson, packPath, file))
  }

  const deduped = dedupeAssets(assets)
  writeManifest(deduped)
  console.log(JSON.stringify({ generated: deduped.length, manifestPath: manifestDisplayPath(), assets: deduped }, null, 2))
}

function collectExplicitAssets(pack: CanonicalPack, lesson: NonNullable<CanonicalPack['lessons']>[number], packPath: string): TextbookAsset[] {
  const contentBlocks = Array.isArray(lesson.contentBlocks) ? lesson.contentBlocks : []
  const exercises = Array.isArray(lesson.exercises) ? lesson.exercises : []
  const carriers = [...contentBlocks, ...exercises]
  return carriers.flatMap(carrier => {
    if (!carrier.imageFile) return []
    const sourcePath = resolve(dirname(packPath), carrier.imageFile)
    if (!existsSync(sourcePath)) return []
    return [
      buildAsset({
        pack,
        lesson,
        sourcePath,
        sourceRef: carrier.imageSourceRef ?? carrier.sourceRef,
        carrier,
      }),
    ]
  })
}

function collectLooseAssets(pack: CanonicalPack, lesson: NonNullable<CanonicalPack['lessons']>[number], packPath: string, fileName: string): TextbookAsset[] {
  const siblingAssetDir = join(dirname(packPath), fileName.replace(/\.json$/, ''), 'assets')
  const legacyAssetDir = join(dirname(packPath), 'assets')
  const assetDir = existsSync(siblingAssetDir) ? siblingAssetDir : legacyAssetDir
  if (!existsSync(assetDir)) return []

  return readdirSync(assetDir)
    .filter(file => IMAGE_EXTENSIONS.has(extname(file).toLowerCase()))
    .sort()
    .map((file, index) => {
      const sourcePath = join(assetDir, file)
      const sourceId = inferSourceId(pack, file)
      const pageNumber = inferLooseAssetPage(lesson, sourceId)
      return buildAsset({
        pack,
        lesson,
        sourcePath,
        sourceRef: { sourceId, pageNumber },
        carrier: {
          id: `${lesson.id}_asset_${index + 1}`,
          label: humanizeAssetName(file),
          type: inferKind(file),
        },
      })
    })
}

function buildAsset(options: {
  pack: CanonicalPack
  lesson: NonNullable<CanonicalPack['lessons']>[number]
  sourcePath: string
  sourceRef?: SourceRef
  carrier: PackAssetCarrier
}): TextbookAsset {
  const { pack, lesson, sourcePath, sourceRef, carrier } = options
  const sourceId = sourceRef?.sourceId ?? inferSourceId(pack, sourcePath)
  const publicFile = `${sourceId}/${lesson.id}/${sourceId}_${lesson.id}_${sanitizeBasename(sourcePath)}`
  const destinationPath = join(PUBLIC_ASSET_ROOT, publicFile)
  mkdirSync(dirname(destinationPath), { recursive: true })
  copyFileSync(sourcePath, destinationPath)

  const page = sourceRef?.pageNumber ?? inferLooseAssetPage(lesson, sourceId)
  const sourceRect = sourceRef?.coordinates
    ? {
        x: sourceRef.coordinates[0],
        y: sourceRef.coordinates[1],
        width: Math.max(0, sourceRef.coordinates[2] - sourceRef.coordinates[0]),
        height: Math.max(0, sourceRef.coordinates[3] - sourceRef.coordinates[1]),
      }
    : undefined

  return {
    id: `${sourceId}_${lesson.id}_${carrier.id}`.replace(/[^a-zA-Z0-9_-]+/g, '_'),
    textbookKey: sourceId,
    lessonId: normalizeLessonId(lesson.id),
    page,
    kind: inferAssetKind(carrier, sourcePath),
    src: `${PUBLIC_PREFIX}/${publicFile}`,
    alt: buildAltText(pack, lesson, carrier, page),
    caption: buildCaption(carrier, sourceId, page),
    ...(sourceRect ? { sourceRect } : {}),
  }
}

function inferSourceId(pack: CanonicalPack, text: string): string {
  const lower = text.toLowerCase()
  if (lower.includes('workbook')) {
    return pack.sources?.find(source => source.role === 'workbook')?.sourceId ?? `${pack.textbookKey}_workbook`
  }
  return pack.sources?.find(source => source.role === 'textbook')?.sourceId ?? `${pack.textbookKey}_textbook`
}

function inferLooseAssetPage(lesson: NonNullable<CanonicalPack['lessons']>[number], sourceId: string): number {
  const start = lesson.pageRange?.start ?? 0
  if (sourceId.includes('workbook')) return 0
  return start
}

function inferAssetKind(carrier: PackAssetCarrier, sourcePath: string): TextbookAsset['kind'] {
  const value = `${carrier.type ?? ''} ${carrier.label ?? ''} ${carrier.title ?? ''} ${carrier.prompt ?? ''} ${sourcePath}`.toLowerCase()
  const kind = inferKind(value)
  if (kind === 'image') return 'photo'
  return kind
}

function inferKind(value: string): TextbookAsset['kind'] | 'image' {
  if (value.includes('exercise') || value.includes('workbook') || value.includes('listening')) return 'exercise'
  if (value.includes('table')) return 'table'
  if (value.includes('diagram') || value.includes('chart')) return 'diagram'
  if (value.includes('page')) return 'page'
  if (value.includes('photo') || value.includes('picture')) return 'photo'
  return 'photo'
}

function normalizeLessonId(lessonId: string): string {
  return lessonId.replace(/_lesson_/, '_')
}

function sanitizeBasename(sourcePath: string): string {
  return sourcePath.split(/[\\/]/).pop()!.replace(/[^a-zA-Z0-9._-]+/g, '_')
}

function buildAltText(pack: CanonicalPack, lesson: NonNullable<CanonicalPack['lessons']>[number], carrier: PackAssetCarrier, page: number): string {
  const label = carrier.label ?? carrier.title ?? carrier.prompt ?? humanizeAssetName(sanitizeBasename(carrier.imageFile ?? carrier.id))
  const pageText = page > 0 ? ` page ${page}` : ''
  return `${pack.textbookKey.replace(/_/g, ' ')} lesson ${lesson.lessonNumber}${pageText}: ${label}`
}

function buildCaption(carrier: PackAssetCarrier, sourceId: string, page: number): string {
  const label = carrier.label ?? carrier.title ?? carrier.prompt ?? humanizeAssetName(carrier.id)
  const pageText = page > 0 ? ` p. ${page}` : ''
  return `${sourceId.replace(/_/g, ' ')}${pageText} - ${label}`.slice(0, 180)
}

function humanizeAssetName(file: string): string {
  return file
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function dedupeAssets(assets: TextbookAsset[]): TextbookAsset[] {
  const seen = new Set<string>()
  return assets
    .filter(asset => {
      const key = `${asset.textbookKey}:${asset.lessonId}:${asset.src}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => a.textbookKey.localeCompare(b.textbookKey) || a.lessonId.localeCompare(b.lessonId) || a.page - b.page || a.id.localeCompare(b.id))
}

function writeManifest(assets: TextbookAsset[]) {
  const manifest: TextbookAssetManifest = {
    generatedAt: new Date().toISOString(),
    assets,
  }
  mkdirSync(dirname(MANIFEST_PATH), { recursive: true })
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`)
}

function manifestDisplayPath() {
  return relative(process.cwd(), MANIFEST_PATH)
}

main()
