import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { CanonicalTextbookPack } from './schema.ts'

interface CliOptions {
  proofPath: string
  correctionsPath: string
  outFile: string | null
  manifestPath: string
  skipAssets: boolean
  skipAnswers: boolean
}

const options = parseArgs(process.argv.slice(2))
const proof = await readJson<CanonicalTextbookPack>(resolveAppPath(options.proofPath))
const lesson = proof.lessons[0]
if (!lesson) throw new Error('Proof pack does not contain a lesson')

const outFile = options.outFile ?? path.join('tools/textbook-pack/out/reviewed-packs', `${lesson.id}.json`)

await run('npm', [
  'run',
  'textbook:corrections:apply',
  '--',
  '--proof',
  options.proofPath,
  '--corrections',
  options.correctionsPath,
  '--out',
  outFile,
])

if (!options.skipAssets) {
  await run('npm', ['run', 'textbook:assets:crop', '--', '--pack', outFile, '--manifest', options.manifestPath])
}

if (!options.skipAnswers) {
  await run('npm', ['run', 'textbook:answers:attach', '--', '--pack', outFile])
}

await run('npm', ['run', 'textbook:reviewed:validate', '--', '--pack', outFile, '--manifest', options.manifestPath])

console.log(
  JSON.stringify(
    {
      finalized: path.relative(process.cwd(), resolveAppPath(outFile)),
      proof: options.proofPath,
      corrections: options.correctionsPath,
    },
    null,
    2,
  ),
)

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: process.cwd(), stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} ${args.join(' ')} exited with ${code}`))
    })
  })
}

function parseArgs(rawArgs: string[]): CliOptions {
  const options: CliOptions = {
    proofPath: 'tools/textbook-pack/out/canonical-proofs/genki_1_lesson_1.json',
    correctionsPath: 'tools/textbook-pack/corrections/genki_1_lesson_1.corrections.json',
    outFile: null,
    manifestPath: 'tools/textbook-pack/out/source-manifest.json',
    skipAssets: false,
    skipAnswers: false,
  }

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index]
    if (arg === '--proof') options.proofPath = rawArgs[++index] ?? options.proofPath
    if (arg === '--corrections') options.correctionsPath = rawArgs[++index] ?? options.correctionsPath
    if (arg === '--out') options.outFile = rawArgs[++index] ?? options.outFile
    if (arg === '--manifest') options.manifestPath = rawArgs[++index] ?? options.manifestPath
    if (arg === '--skip-assets') options.skipAssets = true
    if (arg === '--skip-answers') options.skipAnswers = true
  }

  return options
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, 'utf8')) as T
}

function resolveAppPath(filePath: string): string {
  if (path.isAbsolute(filePath)) return filePath
  return path.resolve(process.cwd(), filePath)
}
