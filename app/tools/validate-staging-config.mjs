#!/usr/bin/env node
/**
 * Offline validation for staging deploy artifacts.
 * Does not call Render or hit a live URL — safe for CI without secrets.
 */
import { readFileSync, accessSync, constants } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const appRoot = resolve(__dirname, '..')
const repoRoot = resolve(appRoot, '..')

const REQUIRED_RENDER_KEYS = [
  'NODE_ENV',
  'HOST',
  'TRUST_PROXY',
  'BETA_INVITE_CODES',
  'DEEPSEEK_API_KEY',
  'GITHUB_REPORT_REPO',
  'GITHUB_REPORT_TOKEN',
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'OPENROUTER_API_KEY',
  'PUBLIC_ORIGIN',
  'CORS_ORIGINS',
]

const REQUIRED_SYNC_FALSE = [
  'BETA_INVITE_CODES',
  'DEEPSEEK_API_KEY',
  'GITHUB_REPORT_REPO',
  'GITHUB_REPORT_TOKEN',
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'OPENROUTER_API_KEY',
  'PUBLIC_ORIGIN',
  'CORS_ORIGINS',
]

const REQUIRED_LITERALS = {
  NODE_ENV: 'production',
  HOST: '0.0.0.0',
  TRUST_PROXY: '1',
}

let failed = 0
function ok(msg) {
  console.log(`ok  ${msg}`)
}
function fail(msg) {
  console.error(`FAIL ${msg}`)
  failed = 1
}

// --- files exist ---
const renderPath = join(repoRoot, 'render.yaml')
const smokePath = join(appRoot, 'tools/staging-smoke.sh')
const checklistPath = join(appRoot, 'tools/staging-checklist.sh')
const envExamplePath = join(appRoot, '.env.example')
const stagingDocPath = join(repoRoot, 'STAGING.md')

for (const [label, path] of [
  ['render.yaml', renderPath],
  ['staging-smoke.sh', smokePath],
  ['staging-checklist.sh', checklistPath],
  ['.env.example', envExamplePath],
  ['STAGING.md', stagingDocPath],
]) {
  try {
    accessSync(path, constants.R_OK)
    ok(`exists ${label}`)
  } catch {
    fail(`missing ${label} (${path})`)
  }
}

for (const path of [smokePath, checklistPath]) {
  try {
    accessSync(path, constants.X_OK)
    ok(`executable ${path.split('/').pop()}`)
  } catch {
    fail(`not executable ${path}`)
  }
}

// --- parse render.yaml lightly (no yaml dependency) ---
const yaml = readFileSync(renderPath, 'utf8')

const checks = [
  [/type:\s*web/, 'type: web'],
  [/name:\s*kirokumichi-staging/, 'service name kirokumichi-staging'],
  [/runtime:\s*node/, 'runtime: node'],
  [/rootDir:\s*app/, 'rootDir: app'],
  [/buildCommand:\s*npm ci && npm run build/, 'buildCommand'],
  [/startCommand:\s*npm run start/, 'startCommand'],
  [/healthCheckPath:\s*\/api\/health/, 'healthCheckPath'],
  [/autoDeploy:\s*true/, 'autoDeploy: true'],
]
for (const [re, label] of checks) {
  if (re.test(yaml)) ok(`render.yaml ${label}`)
  else fail(`render.yaml missing ${label}`)
}

/** @returns {Map<string, { syncFalse: boolean, value: string | null }>} */
function parseEnvKeys(text) {
  const map = new Map()
  const blocks = text.split(/\n\s*-\s+key:\s*/)
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i]
    const keyMatch = block.match(/^([A-Z0-9_]+)/)
    if (!keyMatch) continue
    const key = keyMatch[1]
    const syncFalse = /^\s*sync:\s*false\s*$/m.test(block.split(/\n\s*-\s+/)[0] ?? block)
    // Only look at this key's fields until next sibling list item at same indent
    const own = block.split(/\n\s*-\s+(?:key:|fromGroup:)/)[0]
    const valueMatch = own.match(/^\s*value:\s*(?:"([^"]*)"|'([^']*)'|(\S+))\s*$/m)
    const value = valueMatch ? (valueMatch[1] ?? valueMatch[2] ?? valueMatch[3]) : null
    const syncFalseOwn = /^\s*sync:\s*false\s*$/m.test(own)
    map.set(key, { syncFalse: syncFalseOwn || syncFalse, value })
  }
  return map
}

const envMap = parseEnvKeys(yaml)
for (const key of REQUIRED_RENDER_KEYS) {
  if (envMap.has(key)) ok(`env key declared: ${key}`)
  else fail(`env key missing from render.yaml: ${key}`)
}

for (const key of REQUIRED_SYNC_FALSE) {
  const entry = envMap.get(key)
  if (entry?.syncFalse) ok(`sync:false ${key}`)
  else fail(`expected sync:false for ${key}`)
}

for (const [key, expected] of Object.entries(REQUIRED_LITERALS)) {
  const entry = envMap.get(key)
  if (entry?.value === expected) ok(`literal ${key}=${expected}`)
  else fail(`expected ${key}=${expected}, got ${entry?.value ?? '(missing)'}`)
}

// --- .env.example / STAGING.md document PUBLIC_ORIGIN + TRUST_PROXY ---
const envExample = readFileSync(envExamplePath, 'utf8')
const stagingDoc = readFileSync(stagingDocPath, 'utf8')
for (const [name, text] of [
  ['.env.example', envExample],
  ['STAGING.md', stagingDoc],
]) {
  for (const key of ['PUBLIC_ORIGIN', 'TRUST_PROXY', 'BETA_INVITE_CODES']) {
    if (text.includes(key)) ok(`${name} documents ${key}`)
    else fail(`${name} missing ${key}`)
  }
}

// --- package.json scripts ---
const pkg = JSON.parse(readFileSync(join(appRoot, 'package.json'), 'utf8'))
for (const script of ['staging:smoke', 'staging:checklist', 'staging:env-required', 'staging:validate-config']) {
  if (pkg.scripts?.[script]) ok(`npm script ${script}`)
  else fail(`package.json missing script ${script}`)
}

if (failed) {
  console.error('Staging config validation failed')
  process.exit(1)
}
console.log('Staging config validation passed')
