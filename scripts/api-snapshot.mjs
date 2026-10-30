#!/usr/bin/env node
// Guards the public type surface of the published packages. `update` copies the
// built `dist/<entry>.d.ts` of every package entry point to
// `packages/<name>/api/<entry>.d.ts`, `check` fails with a diff when the built declarations differ from the snapshot.
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const packages = [
  'core',
  'client-utils',
  'client',
  'express-server',
  'supertest-adapter',
  'protocol',
]
// entry points besides `index` (subpath exports)
const extraEntries = { core: ['zod'] }
const mode = process.argv[2]

if (mode !== 'check' && mode !== 'update') {
  console.error('Usage: api-snapshot.mjs <check|update>')
  process.exit(2)
}

const normalize = (source) =>
  source
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((line) => !line.startsWith('//# sourceMappingURL='))
    .join('\n')
    .trimEnd() + '\n'

let failed = false

for (const { name, entry } of packages.flatMap((name) =>
  ['index', ...(extraEntries[name] ?? [])].map((entry) => ({ name, entry }))
)) {
  const built = path.join(root, 'packages', name, 'dist', `${entry}.d.ts`)
  const snapshot = path.join(root, 'packages', name, 'api', `${entry}.d.ts`)

  if (!existsSync(built)) {
    console.error(
      `${name}: ${path.relative(root, built)} is missing, run pnpm build first`
    )
    failed = true
    continue
  }

  const current = normalize(readFileSync(built, 'utf8'))

  if (mode === 'update') {
    mkdirSync(path.dirname(snapshot), { recursive: true })
    writeFileSync(snapshot, current)
    console.log(`${name}/${entry}: snapshot updated`)
    continue
  }

  if (!existsSync(snapshot)) {
    console.error(`${name}/${entry}: no snapshot, run pnpm api:update`)
    failed = true
    continue
  }

  if (normalize(readFileSync(snapshot, 'utf8')) === current) continue

  failed = true
  const tmp = path.join(
    mkdtempSync(path.join(tmpdir(), 'api-snapshot-')),
    'current.d.ts'
  )
  writeFileSync(tmp, current)
  console.error(`${name}/${entry}: public API changed (snapshot -> build)`)
  console.error(
    spawnSync('diff', ['-u', snapshot, tmp], { encoding: 'utf8' }).stdout
  )
}

if (failed) {
  console.error('Run `pnpm api:update` to accept intended API changes.')
  process.exit(1)
}

if (mode === 'check') console.log('Public API snapshots are up to date.')
