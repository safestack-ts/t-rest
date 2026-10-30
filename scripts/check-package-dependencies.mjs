#!/usr/bin/env node
// Verifies that every package imported by the published build output of a
// workspace package is declared as dependency or peer dependency. Packages only
// listed as dev dependencies resolve inside the monorepo but not for consumers.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { builtinModules } from 'node:module'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const packagesDir = path.join(root, 'packages')

const importPattern =
  /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)['"]([^'"]+)['"]/g

const listFiles = (dir) =>
  readdirSync(dir).flatMap((entry) => {
    const entryPath = path.join(dir, entry)
    return statSync(entryPath).isDirectory()
      ? listFiles(entryPath)
      : [entryPath]
  })

const toPackageName = (specifier) =>
  specifier.startsWith('@')
    ? specifier.split('/').slice(0, 2).join('/')
    : specifier.split('/')[0]

const isExternal = (specifier) =>
  !specifier.startsWith('.') &&
  !specifier.startsWith('/') &&
  !specifier.startsWith('node:') &&
  !builtinModules.includes(toPackageName(specifier))

let failed = false

for (const packageDir of readdirSync(packagesDir)) {
  const packageJsonPath = path.join(packagesDir, packageDir, 'package.json')

  if (!existsSync(packageJsonPath)) continue

  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))

  if (packageJson.private) continue

  const distDir = path.join(packagesDir, packageDir, 'dist')
  const declared = new Set([
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.peerDependencies ?? {}),
  ])
  const missing = new Map()

  for (const file of listFiles(distDir)) {
    if (!/\.(c|m)?(js|ts)$/.test(file)) continue

    for (const [, specifier] of readFileSync(file, 'utf8').matchAll(
      importPattern
    )) {
      if (!isExternal(specifier)) continue

      const packageName = toPackageName(specifier)
      // type only imports of `@types/x` packages are provided by `x`
      const typesFor = packageName.startsWith('@types/')
        ? packageName.slice('@types/'.length)
        : undefined

      if (
        packageName !== packageJson.name &&
        !declared.has(packageName) &&
        !declared.has(`@types/${packageName}`) &&
        !(typesFor && declared.has(typesFor))
      ) {
        missing.set(packageName, path.relative(root, file))
      }
    }
  }

  for (const [packageName, file] of missing) {
    failed = true
    console.error(
      `${packageJson.name}: imports "${packageName}" (${file}) without declaring it as dependency or peer dependency`
    )
  }
}

if (failed) {
  process.exit(1)
}

console.log('All imports of published packages are declared.')
