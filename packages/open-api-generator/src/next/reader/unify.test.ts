import { describe, expect, test } from 'vitest'
import { z } from 'zod'
import { createReaderRun, readSchema } from './read-schema.js'

const read = (schema: z.ZodType) =>
  readSchema(
    schema,
    { operation: 'GET /x', slot: 'response', direction: 'output' },
    createReaderRun()
  )

const string = { kind: 'string' } as const
const number = { kind: 'number', integer: false } as const
const ref = (target: string) => ({ kind: 'ref', target } as const)
const field = (name: string, shape: unknown, required = true) => ({
  name,
  required,
  shape,
})
const object = (...fields: unknown[]) => ({ kind: 'object', fields })

describe('generated-def unification', () => {
  test('array recursion through a clone unifies with the named def', () => {
    const Node0 = z.object({
      name: z.string(),
      get children() {
        return z.array(Node0)
      },
    })

    expect(read(z.object({ root: Node0.meta({ id: 'Node' }) }))).toEqual({
      shape: object(field('root', ref('output:Node'))),
      types: {
        'output:Node': {
          kind: 'named',
          id: 'Node',
          direction: 'output',
          shape: object(
            field('name', string),
            field('children', { kind: 'array', items: ref('output:Node') })
          ),
        },
      },
      diagnostics: [],
    })
  })

  test('a recursive copy without an id unifies with a self-recursive named def', () => {
    const Node = z
      .object({
        name: z.string(),
        get children() {
          return z.array(Node)
        },
      })
      .meta({ id: 'Node' })
    const Node0 = z.object({
      name: z.string(),
      get children() {
        return z.array(Node0)
      },
    })

    expect(read(z.object({ root: Node, copy: Node0 }))).toEqual({
      shape: object(
        field('root', ref('output:Node')),
        field('copy', ref('output:Node'))
      ),
      types: {
        'output:Node': {
          kind: 'named',
          id: 'Node',
          direction: 'output',
          shape: object(
            field('name', string),
            field('children', { kind: 'array', items: ref('output:Node') })
          ),
        },
      },
      diagnostics: [],
    })
  })

  test('an object around a named recursive def stays inline', () => {
    const Tree = z
      .object({
        get children() {
          return z.array(Tree)
        },
      })
      .meta({ id: 'Tree' })
    const Forest = z.object({ tree: Tree }).meta({ id: 'Forest' })

    expect(
      read(z.object({ forest: Forest, copy: z.object({ tree: Tree }) })).shape
    ).toEqual(
      object(
        field('forest', ref('output:Forest')),
        field('copy', object(field('tree', ref('output:Tree'))))
      )
    )
  })

  test('a use without the deprecated flag of a named def is not unified with it', () => {
    const T = z.object({
      name: z.string(),
      get kids() {
        return z.array(T)
      },
    })
    const kids = 'anon:output:A#/properties/kids'

    expect(
      read(
        z.object({
          a: T.meta({ id: 'A', description: 'named A', deprecated: true }),
          b: T,
        })
      )
    ).toEqual({
      shape: object(
        field('a', ref('output:A')),
        field('b', object(field('name', string), field('kids', ref(kids))))
      ),
      types: {
        'output:A': {
          kind: 'named',
          id: 'A',
          direction: 'output',
          shape: {
            ...object(field('name', string), field('kids', ref(kids))),
            docs: { description: 'named A', deprecated: true },
          },
        },
        [kids]: {
          kind: 'anonymous',
          direction: 'output',
          shape: {
            kind: 'array',
            items: object(field('name', string), field('kids', ref(kids))),
          },
        },
      },
      diagnostics: [],
    })
  })

  test('use-site docs other than annotations separate the objects that hold them', () => {
    const Node = z.object({ id: z.string() }).meta({ id: 'Node' })
    const Named = z
      .object({
        node: Node,
        get self() {
          return Named.optional()
        },
      })
      .meta({ id: 'Named' })
    const Copy = z.object({
      node: Node.meta({ readOnly: true }),
      get self() {
        return Copy.optional()
      },
    })

    expect(read(z.object({ named: Named, copy: Copy })).shape).toEqual(
      object(
        field('named', ref('output:Named')),
        field('copy', ref('anon:GET /x#response#/properties/copy'))
      )
    )
  })

  test('a recursive copy bisimilar to two named defs refs the smallest id', () => {
    const Node0 = z.object({
      name: z.string(),
      get children() {
        return z.array(Node0)
      },
    })

    const { types } = read(
      z.object({
        b: Node0.meta({ id: 'B_Node' }),
        a: Node0.meta({ id: 'A_Node' }),
      })
    )

    expect(types).toEqual({
      'output:A_Node': {
        kind: 'named',
        id: 'A_Node',
        direction: 'output',
        shape: object(
          field('name', string),
          field('children', { kind: 'array', items: ref('output:A_Node') })
        ),
      },
      'output:B_Node': {
        kind: 'named',
        id: 'B_Node',
        direction: 'output',
        shape: object(
          field('name', string),
          field('children', { kind: 'array', items: ref('output:A_Node') })
        ),
      },
    })
  })

  test('nullable recursion without an id becomes an anonymous type', () => {
    const List = z.object({
      value: z.number(),
      get next() {
        return List.nullable()
      },
    })
    const key = 'anon:GET /x#response#/properties/list'

    expect(read(z.object({ list: List }))).toEqual({
      shape: object(field('list', ref(key))),
      types: {
        [key]: {
          kind: 'anonymous',
          direction: 'output',
          shape: object(
            field('value', number),
            field('next', {
              kind: 'union',
              exclusive: false,
              members: [ref(key), { kind: 'null' }],
            })
          ),
        },
      },
      diagnostics: [],
    })
  })

  test('optional recursion without an id becomes an anonymous type', () => {
    const List = z.object({
      value: z.number(),
      get next() {
        return List.optional()
      },
    })
    const key = 'anon:GET /x#response#/properties/list'

    expect(read(z.object({ list: List })).types).toEqual({
      [key]: {
        kind: 'anonymous',
        direction: 'output',
        shape: object(field('value', number), field('next', ref(key), false)),
      },
    })
  })

  test('mutual recursion with one side named inlines the other side', () => {
    const A = z
      .object({
        get b() {
          return B.optional()
        },
      })
      .meta({ id: 'A' })
    const B = z.object({
      get a() {
        return A
      },
    })

    expect(read(z.object({ y: B }))).toEqual({
      shape: object(field('y', object(field('a', ref('output:A'))))),
      types: {
        'output:A': {
          kind: 'named',
          id: 'A',
          direction: 'output',
          shape: object(field('b', object(field('a', ref('output:A'))), false)),
        },
      },
      diagnostics: [],
    })
  })

  test('a z.lazy root tree refs "#" and becomes an anonymous type at the root', () => {
    type Tree = { label: string; children?: Tree[] }
    const Tree: z.ZodType<Tree> = z.lazy(() =>
      z.object({ label: z.string(), children: z.array(Tree).optional() })
    )
    const key = 'anon:GET /x#response#'

    expect(read(Tree)).toEqual({
      shape: ref(key),
      types: {
        [key]: {
          kind: 'anonymous',
          direction: 'output',
          shape: object(
            field('label', string),
            field('children', { kind: 'array', items: ref(key) }, false)
          ),
        },
      },
      diagnostics: [],
    })
  })

  test('two distinct structures that share one unfolding become one anonymous type', () => {
    type Chain = { next?: Chain }
    const X: z.ZodType<Chain> = z.object({
      get next() {
        return X.optional()
      },
    })
    const Y: z.ZodType<Chain> = z.object({
      get next() {
        return z
          .object({
            get next() {
              return Y.optional()
            },
          })
          .optional()
      },
    })
    const key = 'anon:GET /x#response#/properties/x'

    expect(read(z.object({ x: X, y: Y }))).toEqual({
      shape: object(field('x', ref(key)), field('y', ref(key))),
      types: {
        [key]: {
          kind: 'anonymous',
          direction: 'output',
          shape: object(field('next', ref(key), false)),
        },
      },
      diagnostics: [],
    })
  })

  test('annotation-only differences do not separate a copy from its named def', () => {
    const Node0 = z.object({
      name: z.string(),
      get children() {
        return z.array(Node0)
      },
    })
    const Node = Node0.meta({ id: 'Node', description: 'A node' })

    expect(
      read(z.object({ root: Node })).types['output:Node' as never]
    ).toEqual({
      kind: 'named',
      id: 'Node',
      direction: 'output',
      shape: {
        ...object(
          field('name', string),
          field('children', { kind: 'array', items: ref('output:Node') })
        ),
        docs: { description: 'A node' },
      },
    })
  })

  test('a named primitive does not capture other values of the same type', () => {
    const Name = z.string().meta({ id: 'Name' })

    expect(read(z.object({ name: Name, city: z.string() })).shape).toEqual(
      object(field('name', ref('output:Name')), field('city', string))
    )
  })

  test('a non-recursive copy of a named def stays inline', () => {
    const Point = z.object({ x: z.number() }).meta({ id: 'Point' })

    expect(
      read(z.object({ named: Point, copy: z.object({ x: z.number() }) })).shape
    ).toEqual(
      object(
        field('named', ref('output:Point')),
        field('copy', object(field('x', number)))
      )
    )
  })
})
