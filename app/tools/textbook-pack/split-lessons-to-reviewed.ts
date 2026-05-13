import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { CanonicalLesson, CanonicalTextbookPack } from './schema.ts'

const ALL_LESSONS_PATH = 'app/tools/textbook-pack/out/canonical-proofs/genki_1_all_lessons.json'
const REVIEWED_OUT_DIR = 'app/tools/textbook-pack/out/reviewed-packs'

async function main() {
  const content = await readFile(path.resolve(process.cwd(), ALL_LESSONS_PATH), 'utf-8')
  const pack = JSON.parse(content) as CanonicalTextbookPack

  await mkdir(path.resolve(process.cwd(), REVIEWED_OUT_DIR), { recursive: true })

  for (const lesson of pack.lessons) {
    const singlePack: CanonicalTextbookPack = {
      ...pack,
      lessons: [lesson],
    }

    const filename = lesson.id + '.json'
    const filepath = path.resolve(process.cwd(), REVIEWED_OUT_DIR, filename)
    await writeFile(filepath, JSON.stringify(singlePack, null, 2))
    console.log(`✓ ${filename} (${lesson.contentBlocks.length} blocks, ${lesson.exercises.length} exercises)`)
  }

  console.log(`\n✓ Split ${pack.lessons.length} lessons to ${REVIEWED_OUT_DIR}`)
}

main().catch(console.error)
