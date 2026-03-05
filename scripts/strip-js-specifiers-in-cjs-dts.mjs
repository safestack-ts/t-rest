import fs from 'node:fs/promises'
import path from 'node:path'

const workspaceRoot = process.cwd()

const walk = async (directoryPath) => {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const absoluteEntryPath = path.join(directoryPath, entry.name)
      if (entry.isDirectory()) {
        return walk(absoluteEntryPath)
      }
      return [absoluteEntryPath]
    })
  )

  return files.flat()
}

const rewriteSpecifier = (source) =>
  source
    .replaceAll(/(from\s+['"])(\.[^'"]+?)\.js(['"])/g, '$1$2$3')
    .replaceAll(/(import\(['"])(\.[^'"]+?)\.js(['"]\))/g, '$1$2$3')

const isCjsDeclarationFile = (filePath) => {
  const normalizedPath = filePath.split(path.sep).join('/')
  return normalizedPath.includes('/dist/cjs/') && normalizedPath.endsWith('.d.ts')
}

const run = async () => {
  const targetArg = process.argv[2]

  if (!targetArg) {
    throw new Error('Missing dist/cjs path argument')
  }

  const absoluteTargetPath = path.resolve(workspaceRoot, targetArg)
  const files = await walk(absoluteTargetPath)
  const declarationFiles = files.filter((filePath) => isCjsDeclarationFile(filePath))

  await Promise.all(
    declarationFiles.map(async (filePath) => {
      const originalContent = await fs.readFile(filePath, 'utf8')
      const updatedContent = rewriteSpecifier(originalContent)

      if (updatedContent !== originalContent) {
        await fs.writeFile(filePath, updatedContent, 'utf8')
      }
    })
  )
}

run().catch((error) => {
  process.stderr.write(`${String(error)}\n`)
  process.exit(1)
})
