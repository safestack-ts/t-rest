import { BagOfRoutes, Route } from '@t-rest/core'
import { z } from 'zod'
import {
  type AutoDiscountFilter,
  nestedFilterSchema,
} from './recursive-models/json.js'
import {
  categorySchema,
  type Category,
  type Tree,
  type TreeNode,
} from './recursive-models/category.js'

export default BagOfRoutes.withoutVersioning()
  .addRoute(
    Route.post('/recursive-across-modules')
      .validate(
        z.object({
          body: z.object({
            filter: nestedFilterSchema,
            category: categorySchema,
          }),
        })
      )
      .response<{
        autoDiscountFilter: AutoDiscountFilter
        category: Category
        treeNode: TreeNode<number>
        tree: Tree<string>
        json: z.core.util.JSONType
      }>()
  )
  .build()
