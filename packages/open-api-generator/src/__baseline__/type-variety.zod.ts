import { z } from 'zod'

export const TreeNode = z
  .object({
    label: z.string(),
    get children() {
      return z.array(TreeNode)
    },
    get parent() {
      return TreeNode.nullable()
    },
  })
  .meta({ id: 'TreeNode' })

export const TreeInput = z
  .object({
    label: z.string(),
    get children() {
      return z.array(TreeInput).optional()
    },
  })
  .meta({ id: 'TreeInput' })

export const Circle = z
  .object({ kind: z.literal('circle'), radius: z.number() })
  .meta({ id: 'Circle' })

export const Square = z
  .object({ kind: z.literal('square'), side: z.number() })
  .meta({ id: 'Square' })

export const Drawing = z
  .object({
    id: z.number(),
    title: z.string().nullable(),
    figures: z.array(z.discriminatedUnion('kind', [Circle, Square])),
    origin: z.tuple([z.number(), z.number()]),
    status: z.enum(['draft', 'published']),
    layer: z.literal([1, 2, 3]),
    version: z.literal(2),
    tags: z.record(z.string(), z.string()),
    note: z.string().optional(),
  })
  .meta({ id: 'Drawing' })

const figure = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('circle'), radius: z.number() }),
  z.object({ kind: z.literal('square'), side: z.number() }),
])

/** The bag of `type-variety.bag.ts`, every request and JSON response as a zod schema. */
export const routes = {
  'POST /drawings': {
    validator: z.object({
      body: z.object({
        title: z.string().nullable(),
        figures: z.array(figure),
        origin: z.tuple([z.number(), z.number()]),
        status: z.enum(['draft', 'published']),
        layer: z.union([z.literal(1), z.literal(2), z.literal(3)]),
        tags: z.record(z.string(), z.string()).optional(),
      }),
    }),
    responses: {
      201: Drawing,
      400: z.object({ issues: z.array(z.string()) }),
    },
  },
  'GET /tree': { responses: { 200: TreeNode } },
  'PUT /tree': {
    validator: z.object({ body: TreeInput }),
    responses: { 200: TreeNode },
  },
}
