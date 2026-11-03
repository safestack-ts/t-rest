import {
  BagOfRoutes,
  json,
  Route,
  VersionHistory,
  Versioning,
} from '@t-rest/core'
import { describe, expect, test } from 'vitest'
import { z } from 'zod'
import { codes, golden } from '../route/golden.js'
import { pipeline, typeNames } from '../spec/testing.js'

const ref = (target: string) => ({ kind: 'ref', target })
const bodyOf = (operation: {
  requestBody?: { content: Record<string, { shape: unknown }> }
}) => operation.requestBody?.content['application/json'].shape
const responseOf = (
  operation: { responses: Record<string, unknown> },
  status = '200'
) =>
  (operation.responses[status] as any).response.content['application/json']
    .shape

/** A route that takes `schema` as body and returns it. */
const echo = (path: string, schema: z.ZodType) =>
  Route.post(path)
    .validate(z.object({ body: schema }))
    .responses({ 200: json(schema) })

describe('direction merge', () => {
  test('a type that reads the same in both directions is one component', () => {
    const User = z.object({ name: z.string() }).meta({ id: 'User' })
    const result = pipeline(
      BagOfRoutes.withoutVersioning().addRoute(echo('/users', User)).build()
    )
    const operation = result.named.model.operations[0]

    expect(result.named.model.types).toEqual({
      User: {
        kind: 'named',
        id: 'User',
        direction: 'output',
        shape: {
          kind: 'object',
          fields: [{ name: 'name', required: true, shape: { kind: 'string' } }],
        },
      },
    })
    expect(bodyOf(operation)).toEqual(ref('User'))
    expect(responseOf(operation)).toEqual(ref('User'))
    expect(result.named.diagnostics).toEqual([])
  })

  test('recursion through a merged pair stays merged', () => {
    const Node = z
      .object({
        name: z.string(),
        get children() {
          return z.array(Node)
        },
      })
      .meta({ id: 'Node' })
    const result = pipeline(
      BagOfRoutes.withoutVersioning().addRoute(echo('/trees', Node)).build()
    )

    expect(typeNames(result.named.model)).toEqual(['Node'])
  })

  test('a nested .default() splits the type and every type above it', async () => {
    const Tag = z.object({ name: z.string() }).meta({ id: 'Tag' })
    const Item = z
      .object({ quantity: z.number().default(1) })
      .meta({ id: 'Item' })
    const Order = z
      .object({ items: z.array(Item), tag: Tag })
      .meta({ id: 'Order' })
    const result = pipeline(
      BagOfRoutes.withoutVersioning().addRoute(echo('/orders', Order)).build()
    )
    const { types, operations } = result.named.model

    expect(Object.keys(types).sort()).toEqual([
      'Item',
      'ItemInput',
      'Order',
      'OrderInput',
      'Tag',
    ])
    expect(bodyOf(operations[0])).toEqual(ref('OrderInput'))
    expect(responseOf(operations[0])).toEqual(ref('Order'))
    expect((types as any).OrderInput.shape.fields).toEqual([
      {
        name: 'items',
        required: true,
        shape: { kind: 'array', items: ref('ItemInput') },
      },
      { name: 'tag', required: true, shape: ref('Tag') },
    ])
    expect(codes(result.named).map(({ code, data }) => [code, data])).toEqual([
      ['naming/direction-split', { id: 'Item', input: 'ItemInput' }],
      ['naming/direction-split', { id: 'Order', input: 'OrderInput' }],
    ])
    await golden(result.named.model, 'direction-split')
  })

  test('inputSuffix names the split input', () => {
    const Item = z
      .object({ quantity: z.number().default(1) })
      .meta({ id: 'Item' })
    const result = pipeline(
      BagOfRoutes.withoutVersioning().addRoute(echo('/items', Item)).build(),
      {},
      { inputSuffix: '_Write' }
    )

    expect(typeNames(result.named.model).sort()).toEqual(['Item', 'Item_Write'])
  })
})

describe('aliases', () => {
  const Person = z.object({ name: z.string() }).meta({ id: 'Shared_Person' })
  const bag = BagOfRoutes.withoutVersioning()
    .addRoute(
      Route.get('/admin/person').responses({
        200: json(Person.meta({ id: 'Admin_Person' })),
      })
    )
    .build()

  test('reference: the alias refers to its target, which is still emitted', () => {
    const spec = pipeline(bag).spec()

    expect(spec.model.types).toEqual({
      Admin_Person: {
        kind: 'named',
        id: 'Admin_Person',
        direction: 'output',
        shape: ref('Shared_Person'),
      },
      Shared_Person: expect.objectContaining({
        kind: 'named',
        id: 'Shared_Person',
      }),
    })
  })

  test('materialize: the alias is a shallow copy and the target is not reached', () => {
    const spec = pipeline(bag, {}, { aliases: 'materialize' }).spec()

    expect(spec.model.types).toEqual({
      Admin_Person: {
        kind: 'named',
        id: 'Admin_Person',
        direction: 'output',
        shape: {
          kind: 'object',
          fields: [{ name: 'name', required: true, shape: { kind: 'string' } }],
        },
      },
    })
  })
})

describe('anonymous types', () => {
  const page = <T extends z.ZodType>(item: T) =>
    z.object({ items: z.array(item), next: z.string().nullable() })
  const Person = z.object({ name: z.string() }).meta({ id: 'Person' })
  const bag = BagOfRoutes.withoutVersioning()
    .addRoute(Route.get('/people').responses({ 200: json(page(Person)) }))
    .addRoute(Route.get('/admins').responses({ 200: json(page(Person)) }))
    .build()

  test('are inlined and reported as probable models without the hook', () => {
    const result = pipeline(bag)

    expect(responseOf(result.named.model.operations[0])).toEqual(
      expect.objectContaining({ kind: 'object' })
    )
    expect(codes(result.named)).toEqual([
      {
        code: 'naming/probable-model-without-id',
        at: { operation: 'GET /admins', slot: 'response 200' },
        data: {
          fields: ['items', 'next'],
          operations: ['GET /admins', 'GET /people'],
        },
      },
    ])
  })

  test('nameAnonymous names slot roots; one name and one shape is one type', () => {
    const result = pipeline(
      bag,
      {},
      {
        nameAnonymous: (context) =>
          context.kind === 'slot' ? 'PersonPage' : undefined,
      }
    )
    const [admins, people] = result.named.model.operations

    expect(responseOf(admins)).toEqual(ref('PersonPage'))
    expect(responseOf(people)).toEqual(ref('PersonPage'))
    expect(typeNames(result.named.model).sort()).toEqual([
      'Person',
      'PersonPage',
    ])
    expect(result.named.diagnostics).toEqual([])
  })

  test('one hook name for two shapes is a conflict', () => {
    const result = pipeline(
      BagOfRoutes.withoutVersioning()
        .addRoute(
          Route.get('/a').responses({ 200: json(z.object({ a: z.string() })) })
        )
        .addRoute(
          Route.get('/b').responses({ 200: json(z.object({ b: z.string() })) })
        )
        .build(),
      {},
      { nameAnonymous: () => 'Page' }
    )

    expect(typeNames(result.named.model).sort()).toEqual(['Page', 'Page_2'])
    expect(codes(result.named).map(({ code }) => code)).toEqual([
      'naming/component-conflict',
    ])
  })

  const Tree = z.object({
    label: z.string(),
    get children(): z.ZodArray<typeof Tree> {
      return z.array(Tree)
    },
  })
  const trees = BagOfRoutes.withoutVersioning()
    .addRoute(
      Route.get('/tree').responses({ 200: json(z.object({ root: Tree })) })
    )
    .build()

  test('recursion without id falls back to the operationId, slot and pointer, with a warning', () => {
    const result = pipeline(trees)

    expect(typeNames(result.named.model)).toEqual([
      'getTree_response_200_properties_root',
    ])
    expect(codes(result.named)).toEqual([
      {
        code: 'naming/anonymous-recursion',
        at: {
          operation: 'GET /tree',
          slot: 'response 200',
          pointer: '/properties/root',
        },
        data: { name: 'getTree_response_200_properties_root' },
      },
    ])
  })

  const Chain: z.ZodType<{ value: string; next?: unknown }> = z.object({
    value: z.string(),
    get next() {
      return Chain.optional()
    },
  })
  const Ring: z.ZodType<{ count: number; next?: unknown }> = z.object({
    count: z.number(),
    get next() {
      return Ring.optional()
    },
  })

  const Loop: z.ZodType<{ flag: boolean; next?: unknown }> = z.object({
    flag: z.boolean(),
    get next() {
      return Loop.optional()
    },
  })

  test('equal recursion in every slot and revision is one component', () => {
    const history = VersionHistory(['1.0.0', '2.0.0'] as const)
    const result = pipeline(
      BagOfRoutes.withVersioning(Versioning.SEMVER, history)
        .addRoute(
          Route.version('1.0.0')
            .post('/chains')
            .validate(z.object({ body: Chain }))
            .responses({ 200: json(Chain), 400: json(Chain) })
        )
        .addRoute(
          Route.version('2.0.0')
            .post('/chains')
            .validate(z.object({ body: Chain }))
            .responses({ 200: json(Chain) })
        )
        .build()
    )
    const name = 'postChains_request_properties_body'

    expect(typeNames(result.named.model)).toEqual([name])
    for (const operation of result.named.model.operations) {
      expect(bodyOf(operation)).toEqual(ref(name))
      expect(responseOf(operation)).toEqual(ref(name))
    }
    expect(codes(result.named)).toEqual([
      {
        code: 'naming/anonymous-recursion',
        at: {
          operation: 'POST /chains @1.0.0',
          slot: 'request',
          pointer: '/properties/body',
        },
        data: { name },
      },
    ])
  })

  test('a named type with anonymous recursion is one component in both directions', () => {
    const Tree = z.object({ root: Chain }).meta({ id: 'Tree' })
    const result = pipeline(
      BagOfRoutes.withoutVersioning()
        .addRoute(echo('/a', Tree))
        .addRoute(Route.get('/b').responses({ 200: json(Tree) }))
        .build()
    )

    expect(typeNames(result.named.model)).toEqual([
      'Tree',
      'Tree_properties_root',
    ])
    expect(codes(result.named)).toEqual([
      {
        code: 'naming/anonymous-recursion',
        at: { pointer: '/properties/root' },
        data: { name: 'Tree_properties_root' },
      },
    ])
  })

  test('different recursion gets names by slot; a clash of fallbacks is no error', () => {
    const history = VersionHistory(['1.0.0', '2.0.0'] as const)
    const result = pipeline(
      BagOfRoutes.withVersioning(Versioning.SEMVER, history)
        .addRoute(
          Route.version('1.0.0')
            .get('/loops')
            .responses({ 200: json(Chain), 404: json(Ring) })
        )
        .addRoute(
          Route.version('2.0.0')
            .get('/loops')
            .responses({ 200: json(Loop) })
        )
        .build()
    )

    expect(typeNames(result.named.model)).toEqual([
      'getLoops_response_200',
      'getLoops_response_200_2',
      'getLoops_response_404',
    ])
    expect(codes(result.named).map(({ code, data }) => [code, data])).toEqual([
      ['naming/anonymous-recursion', { name: 'getLoops_response_200' }],
      ['naming/anonymous-recursion', { name: 'getLoops_response_404' }],
      ['naming/anonymous-recursion', { name: 'getLoops_response_200_2' }],
    ])
  })

  test('nameAnonymous names recursion', () => {
    const result = pipeline(
      trees,
      {},
      {
        nameAnonymous: (context) =>
          context.kind === 'recursive' ? 'Tree' : undefined,
      }
    )

    expect(typeNames(result.named.model)).toEqual(['Tree'])
    expect(result.named.diagnostics).toEqual([])
  })
})

describe('probable models', () => {
  const bag = (...routes: [string, z.ZodType][]) =>
    routes
      .reduce(
        (bag, [path, schema]) =>
          bag.addRoute(
            Route.post(path)
              .validate(z.object({ body: schema }))
              .response(204)
          ),
        BagOfRoutes.withoutVersioning() as any
      )
      .build()

  test('need two fields and two operations', () => {
    const two = () => z.object({ a: z.string(), b: z.number() })
    const one = () => z.object({ a: z.string() })

    expect(
      pipeline(bag(['/x', two()], ['/y', z.object({ nested: two() })])).named
        .diagnostics
    ).toHaveLength(1)
    expect(
      pipeline(bag(['/x', one()], ['/y', one()])).named.diagnostics
    ).toEqual([])
    expect(
      pipeline(bag(['/x', z.object({ p: two(), q: two() })])).named.diagnostics
    ).toEqual([])
  })
})

describe('component names', () => {
  test('are sanitized; author ids win over derived names; a collision is reported', () => {
    const route = (path: string, schema: z.ZodType) =>
      Route.get(path).responses({ 200: json(schema) })
    const result = pipeline(
      BagOfRoutes.withoutVersioning()
        .addRoute(
          route('/a', z.object({ a: z.string() }).meta({ id: 'Shop Item' }))
        )
        .addRoute(
          route('/b', z.object({ b: z.string() }).meta({ id: 'Shop_Item' }))
        )
        .addRoute(
          echo(
            '/c',
            z.object({ c: z.string().default('') }).meta({ id: 'Cart' })
          )
        )
        .addRoute(
          route('/d', z.object({ d: z.string() }).meta({ id: 'CartInput' }))
        )
        .build()
    )

    expect(typeNames(result.named.model).sort()).toEqual([
      'Cart',
      'CartInput',
      'CartInput_2',
      'Shop_Item',
      'Shop_Item_2',
    ])
    expect((result.named.model.types as any).CartInput.id).toBe('CartInput')
    expect(
      codes(result.named)
        .filter(({ code }) => code === 'naming/component-conflict')
        .map(({ data }) => data)
    ).toEqual([
      { name: 'Shop_Item', owners: ['output:Shop_Item', 'output:Shop Item'] },
      { name: 'CartInput', owners: ['output:CartInput', 'input:Cart'] },
    ])
  })
})

describe('names across specs', () => {
  test('are computed once, so filtered specs of one bag share them', () => {
    const Product = z
      .object({ id: z.number(), stock: z.number().default(0) })
      .meta({ id: 'Product' })
    const bag = BagOfRoutes.withoutVersioning()
      .addRoute(
        Route.get('/products')
          .metaData({ public: true })
          .responses({ 200: json(z.array(Product)) })
      )
      .addRoute(echo('/internal/products', Product))
      .build()
    const { spec } = pipeline(bag)
    const publicSpec = spec({
      filter: ({ meta }) =>
        (meta as { public?: boolean } | null)?.public === true,
    })
    const internalSpec = spec()

    expect(typeNames(publicSpec.model)).toEqual(['Product'])
    expect(typeNames(internalSpec.model).sort()).toEqual([
      'Product',
      'ProductInput',
    ])
    expect(publicSpec.model.types).toEqual({
      Product: (internalSpec.model.types as any).Product,
    })
  })
})
