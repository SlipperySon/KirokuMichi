import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

interface CliOptions {
  packsRoot: string
  snapshotPath: string
  update: boolean
}

interface Snapshot {
  schemaVersion: 1
  generatedAt: string
  packs: Array<{
    file: string
    sha256: string
    bytes: number
  }>
}

const options = parseArgs(process.argv.slice(2))
const current = await buildSnapshot()

if (options.update) {
  const snapshotPath = resolveAppPath(options.snapshotPath)
  await mkdir(path.dirname(snapshotPath), { recursive: true })
  await writeFile(snapshotPath, `${JSON.stringify(current, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({ updated: path.relative(process.cwd(), snapshotPath), packs: current.packs.length }, null, 2))
} else {
  const expected = await readJson<Snapshot>(resolveAppPath(options.snapshotPath))
  const findings = compareSnapshots(expected, current)
  console.log(JSON.stringify({ snapshot: options.snapshotPath, packs: current.packs.length, findings }, null, 2))
  if (findings.length > 0) process.exit(1)
}

async function buildSnapshot(): Promise<Snapshot> {
  const root = resolveAppPath(options.packsRoot)
  const entries = await readdir(root, { withFileTypes: true })
  const snapshotFileName = path.basename(options.snapshotPath)
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json') && entry.name !== snapshotFileName)
    .map((entry) => path.join(root, entry.name))
    .sort()
  const packs: Snapshot['packs'] = []
  for (const file of files) {
    const bytes = await readFile(file)
    packs.push({
      file: path.relative(process.cwd(), file),
      sha256: createHash('sha256').update(bytes).digest('hex'),
      bytes: bytes.byteLength,
    })
  }
  return { schemaVersion: 1, generatedAt: new Date().toISOString(), packs }
}

function compareSnapshots(expected: Snapshot, current: Snapshot): string[] {
  const findings: string[] = []
  const expectedByFile = new Map(expected.packs.map((pack) => [pack.file, pack]))
  const currentByFile = new Map(current.packs.map((pack) => [pack.file, pack]))
  for (const expectedPack of expected.packs) {
    const currentPack = currentByFile.get(expectedPack.file)
    if (!currentPack) {
      findings.push(`missing pack ${expectedPack.file}`)
      continue
    }
    if (currentPack.sha256 !== expectedPack.sha256) findings.push(`changed pack ${expectedPack.file}`)
  }
  for (const currentPack of current.packs) {
    if (!expectedByFile.has(currentPack.file)) findings.push(`new pack ${currentPack.file}`)
  }
  return findings
}

function parseArgs(rawArgs: string[]): CliOptions {
  const options: CliOptions = {
    packsRoot: 'app/tools/textbook-pack/out/reviewed-packs',
    snapshotPath: 'app/tools/textbook-pack/out/reviewed-packs/fingerprints.json',
    update: false,
  }

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index]
    if (arg === '--packs-root') options.packsRoot = rawArgs[++index] ?? options.packsRoot
    if (arg === '--snapshot') options.snapshotPath = rawArgs[++index] ?? options.snapshotPath
    if (arg === '--update') options.update = true
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
