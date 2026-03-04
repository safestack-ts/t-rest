import path from 'node:path'

import { glob } from 'glob'
import ts from 'typescript'

import fs from 'node:fs/promises'

const workspaceRoot = process.cwd()
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const scopeArg = args.find((arg) => arg.startsWith('--scope='))?.split('=')[1]

const targetScope = scopeArg ? path.resolve(workspaceRoot, scopeArg) : workspaceRoot

const shouldRewriteSpecifier = (specifier: string): boolean =>
  (specifier.startsWith('./') || specifier.startsWith('../')) &&
  !specifier.endsWith('.js') &&
  !specifier.endsWith('.mjs') &&
  !specifier.endsWith('.cjs') &&
  !specifier.endsWith('.json') &&
  !specifier.endsWith('.node')

const resolveJsSpecifier = async (filePath: string, specifier: string): Promise<string | undefined> => {
  if (!shouldRewriteSpecifier(specifier)) {
    return undefined
  }

  const sourceDir = path.dirname(filePath)
  const absoluteBase = path.resolve(sourceDir, specifier)

  const candidates = [
    `${absoluteBase}.ts`,
    `${absoluteBase}.tsx`,
    `${absoluteBase}.mts`,
    `${absoluteBase}.cts`,
    `${absoluteBase}.js`,
    `${absoluteBase}.mjs`,
    `${absoluteBase}.cjs`,
  ]

  for (const candidate of candidates) {
    try {
      const stats = await fs.stat(candidate)
      if (stats.isFile()) {
        return `${specifier}.js`
      }
    } catch {
      // ignore
    }
  }

  const indexCandidates = [
    path.join(absoluteBase, 'index.ts'),
    path.join(absoluteBase, 'index.tsx'),
    path.join(absoluteBase, 'index.mts'),
    path.join(absoluteBase, 'index.cts'),
    path.join(absoluteBase, 'index.js'),
    path.join(absoluteBase, 'index.mjs'),
    path.join(absoluteBase, 'index.cjs'),
  ]

  for (const candidate of indexCandidates) {
    try {
      const stats = await fs.stat(candidate)
      if (stats.isFile()) {
        return `${specifier}/index.js`
      }
    } catch {
      // ignore
    }
  }

  return undefined
}

const processFile = async (absolutePath: string): Promise<number> => {
  const content = await fs.readFile(absolutePath, 'utf8')
  const sourceFile = ts.createSourceFile(absolutePath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)

  const replacements: Array<{ start: number; end: number; text: string }> = []

  const handleLiteral = async (literal: ts.StringLiteralLike) => {
    const currentSpecifier = literal.text
    const rewritten = await resolveJsSpecifier(absolutePath, currentSpecifier)
    if (!rewritten || rewritten === currentSpecifier) {
      return
    }

    replacements.push({
      start: literal.getStart(sourceFile) + 1,
      end: literal.getEnd() - 1,
      text: rewritten,
    })
  }

  const visit = async (node: ts.Node): Promise<void> => {
    if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
      await handleLiteral(node.moduleSpecifier)
    }

    if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
      await handleLiteral(node.moduleSpecifier)
    }

    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const firstArg = node.arguments.at(0)
      if (firstArg && ts.isStringLiteralLike(firstArg)) {
        await handleLiteral(firstArg)
      }
    }

    if (ts.isImportTypeNode(node) && node.argument && ts.isLiteralTypeNode(node.argument)) {
      const literal = node.argument.literal
      if (literal && ts.isStringLiteralLike(literal)) {
        await handleLiteral(literal)
      }
    }

    await Promise.all(node.getChildren(sourceFile).map((child) => visit(child)))
  }

  await visit(sourceFile)

  if (replacements.length === 0) {
    return 0
  }

  const sorted = replacements.sort((a, b) => b.start - a.start)
  let updated = content
  for (const replacement of sorted) {
    updated = `${updated.slice(0, replacement.start)}${replacement.text}${updated.slice(replacement.end)}`
  }

  if (!dryRun) {
    await fs.writeFile(absolutePath, updated, 'utf8')
  }

  return replacements.length
}

const run = async () => {
  const pattern = '**/*.{ts,tsx,mts,cts}'
  const files = await glob(pattern, {
    cwd: targetScope,
    nodir: true,
    ignore: [
      '**/node_modules/**',
      '**/dist/**',
      '**/dist-bundle/**',
      '**/.git/**',
      '**/.cursor/**',
      '**/coverage/**',
      '**/*.d.ts',
    ],
    absolute: true,
  })

  let changedFiles = 0
  let rewrittenSpecifiers = 0

  for (const file of files) {
    const rewrittenInFile = await processFile(file)
    if (rewrittenInFile > 0) {
      changedFiles += 1
      rewrittenSpecifiers += rewrittenInFile
    }
  }

  process.stdout.write(
    `${dryRun ? 'dry-run: ' : ''}rewrote ${rewrittenSpecifiers} specifiers across ${changedFiles} files in ${targetScope}\n`
  )
}

run().catch((error) => {
  process.stderr.write(`${String(error)}\n`)
  process.exit(1)
})