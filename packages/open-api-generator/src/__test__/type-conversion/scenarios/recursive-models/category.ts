import { z } from 'zod'

// recursive zod schema whose output is inferred through a getter, without a hand-written interface
export const categorySchema = z.object({
  name: z.string(),
  get children() {
    return z.array(categorySchema)
  },
})

export type Category = z.infer<typeof categorySchema>

export interface TreeNode<TValue> {
  value: TValue
  children?: TreeNode<TValue>[]
}

export type Tree<TValue> = {
  value: TValue
  children: Tree<TValue>[]
}
