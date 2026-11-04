#!/usr/bin/env node
// Guards the public type surface of the published packages. `update` copies the
// built `dist/<entry>.d.ts` of every package entry point to
// `packages/<name>/api/<entry>.d.ts`, `check` fails with a diff when the built declarations differ from the snapshot.
// Packages with several entries get declarations shared between them bundled
// into chunks named `<name>-<hash>.d.ts`, these are snapshotted as `<name>.d.ts`
// with the hash also stripped from the imports, so a snapshot names them stably.
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
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
  'open-api-generator',
]
// entry points besides `index` (subpath exports)
const extraEntries = { core: ['zod'], client: ['axios'] }
const mode = process.argv[2]

if (mode !== 'check' && mode !== 'update') {
  console.error('Usage: api-snapshot.mjs <check|update>')
  process.exit(2)
}

const chunkPattern = /^(.+)-[A-Za-z0-9_-]{8}\.d\.ts$/

// hashed declaration chunks of a package, by their file name without the hash
const chunksOf = (name) => {
  const dist = path.join(root, 'packages', name, 'dist')
  const entries = new Set(
    ['index', ...(extraEntries[name] ?? [])].map((entry) => `${entry}.d.ts`)
  )

  return existsSync(dist)
    ? readdirSync(dist)
        .filter((file) => !entries.has(file))
        .flatMap((file) => {
          const match = chunkPattern.exec(file)
          return match ? [{ file, entry: match[1] }] : []
        })
    : []
}

const stripChunkHashes = (source, chunks) =>
  chunks.reduce(
    (result, { file, entry }) =>
      result.replaceAll(
        `./${file.replace(/\.d\.ts$/, '.js')}`,
        `./${entry}.js`
      ),
    source
  )

const normalize = (source) =>
  source
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((line) => !line.startsWith('//# sourceMappingURL='))
    .join('\n')
    .trimEnd() + '\n'

let failed = false

for (const name of packages) {
  const chunks = chunksOf(name)
  const expected = new Set(
    [
      'index',
      ...(extraEntries[name] ?? []),
      ...chunks.map(({ entry }) => entry),
    ].map((entry) => `${entry}.d.ts`)
  )
  const apiDir = path.join(root, 'packages', name, 'api')

  for (const file of existsSync(apiDir) ? readdirSync(apiDir) : []) {
    if (expected.has(file)) continue

    if (mode === 'update') {
      rmSync(path.join(apiDir, file))
      console.log(`${name}/${file}: stale snapshot removed`)
    } else {
      console.error(`${name}/${file}: stale snapshot, run pnpm api:update`)
      failed = true
    }
  }
}

for (const { name, entry, file, chunks } of packages.flatMap((name) => {
  const chunks = chunksOf(name)

  return [
    ...['index', ...(extraEntries[name] ?? [])].map((entry) => ({
      entry,
      file: `${entry}.d.ts`,
    })),
    ...chunks,
  ].map((target) => ({ name, chunks, ...target }))
})) {
  const built = path.join(root, 'packages', name, 'dist', file)
  const snapshot = path.join(root, 'packages', name, 'api', `${entry}.d.ts`)

  if (!existsSync(built)) {
    console.error(
      `${name}: ${path.relative(root, built)} is missing, run pnpm build first`
    )
    failed = true
    continue
  }

  const current = normalize(
    stripChunkHashes(readFileSync(built, 'utf8'), chunks)
  )

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
