import { BagOfRoutes, json, Route } from '@t-rest/core'
import { z } from 'zod'

export type TreeNode = {
  label: string
  children: TreeNode[]
  parent: TreeNode | null
}

export type Circle = { kind: 'circle'; radius: number }
export type Square = { kind: 'square'; side: number }
export type Figure = Circle | Square

export type Drawing = {
  id: number
  title: string | null
  figures: Figure[]
  origin: [number, number]
  status: 'draft' | 'published'
  layer: 1 | 2 | 3
  version: 2
  tags: Record<string, string>
  note?: string
}

export type TreeInput = {
  label: string
  children?: TreeInput[]
}

const treeInput: z.ZodType<TreeInput> = z.object({
  label: z.string(),
  children: z.array(z.lazy(() => treeInput)).optional(),
})

const figure = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('circle'), radius: z.number() }),
  z.object({ kind: z.literal('square'), side: z.number() }),
])

export default BagOfRoutes.withoutVersioning()
  .addRoute(
    Route.post('/drawings')
      .validate(
        z.object({
          body: z.object({
            title: z.string().nullable(),
            figures: z.array(figure),
            origin: z.tuple([z.number(), z.number()]),
            status: z.enum(['draft', 'published']),
            layer: z.union([z.literal(1), z.literal(2), z.literal(3)]),
            tags: z.record(z.string(), z.string()).optional(),
          }),
        })
      )
      .responses({ 201: json<Drawing>(), 400: json<{ issues: string[] }>() })
  )
  .addRoute(Route.get('/tree').response<TreeNode>())
  .addRoute(
    Route.put('/tree')
      .validate(z.object({ body: treeInput }))
      .response<TreeNode>()
  )
  .build()
