import { readdirSync, readFileSync } from 'fs'
import path from 'path'
import { describe, expect, test } from 'vitest'

const examplesDir = __dirname
const repoRoot = path.join(__dirname, '../../../..')

const pages = [
  'packages/open-api-generator/README.md',
  'docs/open-api-generator/naming-components.md',
  'docs/open-api-generator/documenting-routes.md',
  'docs/open-api-generator/security.md',
  'docs/open-api-generator/validator-support.md',
  'docs/open-api-generator/migration.md',
]

const EXAMPLE = /^<!-- example: (\S+) -->$/
const NOT_COMPILED = '<!-- removed API, not compiled -->'
const FENCE = /^\s*```(.*)$/
const TYPESCRIPT_FENCE = /^\s*```(ts|typescript)/

interface Snippet {
  readonly page: string
  readonly line: number
  readonly marker: string | undefined
  readonly code: string
}

interface Page {
  readonly snippets: readonly Snippet[]
  /** Fences this test would not read: `page:line` and why. */
  readonly unread: readonly string[]
}

const readPage = (page: string): Page => {
  const lines = readFileSync(path.join(repoRoot, page), 'utf8').split('\n')
  const snippets: Snippet[] = []
  const unread: string[] = []
  let open: number | undefined
  lines.forEach((text, index) => {
    const fence = FENCE.exec(text)
    if (!fence) return
    if (open === undefined) {
      open = index
      return
    }
    // a fence line with an info string inside a block is content, not a close
    if (fence[1].trim() !== '') return
    if (lines[open] === '```ts')
      snippets.push({
        page,
        line: open + 1,
        marker: lines.slice(0, open).reverse().find(Boolean),
        code: lines.slice(open + 1, index).join('\n'),
      })
    else if (TYPESCRIPT_FENCE.test(lines[open]))
      unread.push(`${page}:${open + 1} opens with "${lines[open].trim()}"`)
    open = undefined
  })
  if (open !== undefined) unread.push(`${page}:${open + 1} is not closed`)
  return { snippets, unread }
}

const read = pages.map(readPage)
const snippets = read.flatMap((page) => page.snippets)

const exampleFiles = (dir: string): string[] =>
  readdirSync(path.join(examplesDir, dir), { withFileTypes: true }).flatMap(
    (entry) =>
      entry.isDirectory()
        ? exampleFiles(path.join(dir, entry.name))
        : dir === ''
        ? []
        : [path.join(dir, entry.name)]
  )

describe('docs code blocks', () => {
  test('every TypeScript block is a closed "```ts" fence', () => {
    expect(read.flatMap((page) => page.unread)).toEqual([])
  })

  test.each(snippets.map((s) => [`${s.page}:${s.line}`, s] as const))(
    '%s is a compiled example file',
    (_, { page, marker, code }) => {
      if (marker === NOT_COMPILED) {
        expect(page).toBe('docs/open-api-generator/migration.md')
        return
      }
      const file = EXAMPLE.exec(marker ?? '')?.[1]
      expect(
        file,
        `no "<!-- example: <file> -->" above the block`
      ).toBeDefined()
      expect(code).toBe(
        readFileSync(path.join(examplesDir, file as string), 'utf8').trimEnd()
      )
    }
  )

  test('every example file is shown on a page', () => {
    const shown = new Set(
      snippets.map(({ marker }) => EXAMPLE.exec(marker ?? '')?.[1])
    )

    expect(exampleFiles('').filter((file) => !shown.has(file))).toEqual([])
  })
})
